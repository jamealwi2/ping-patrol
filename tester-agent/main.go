package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"net"
	"net/http"
	"os"
	"strings"
	"time"
)

// DestinationTestResult holds the outcome of a single test.
// Ensure JSON tags match frontend expectations.
type DestinationTestResult struct {
	Destination string `json:"destination"`
	Status      string `json:"status"`
	Details     string `json:"details"`
	Duration    string `json:"duration,omitempty"` // Added
}

// TestRunResults is a collection of all test results.
// The frontend currently expects a simple array of DestinationTestResult,
// so we might not need this top-level struct for JSON output directly to frontend,
// but it can be useful internally or if the output format evolves.
// For now, we'll aim to output a []DestinationTestResult directly.

// performTCPCheck attempts to connect to a given host and port.
// Returns status, details, and duration string.
func performTCPCheck(destination string) (string, string, string) {
	timeout := 5 * time.Second
	start := time.Now() // Record start time
	conn, err := net.DialTimeout("tcp", destination, timeout)
	duration := time.Since(start) // Calculate duration
	durationStr := fmt.Sprintf("%.0fms", duration.Seconds()*1000) // Format to milliseconds

	if err != nil {
		// Could be a variety of errors: refused, timeout, host not found, etc.
		return "FAILED", fmt.Sprintf("TCP connection to %s failed: %v", destination, err), durationStr
	}
	defer conn.Close() // Ensure the connection is closed
	return "SUCCESS", fmt.Sprintf("TCP connection to %s successful.", destination), durationStr
}

// performHTTPGetCheck attempts to make a GET request to a given URL.
// Returns status, details, and duration string.
func performHTTPGetCheck(url string) (string, string, string) {
	timeout := 10 * time.Second
	client := http.Client{
		Timeout: timeout,
	}

	start := time.Now() // Record start time
	resp, err := client.Get(url)
	duration := time.Since(start) // Calculate duration
	durationStr := fmt.Sprintf("%.0fms", duration.Seconds()*1000) // Format to milliseconds

	if err != nil {
		return "FAILED", fmt.Sprintf("HTTP GET request to %s failed: %v", url, err), durationStr
	}
	defer resp.Body.Close()

	// We consider any 2xx status code as success for a basic check.
	if resp.StatusCode >= 200 && resp.StatusCode <= 299 {
		return "SUCCESS", fmt.Sprintf("HTTP GET request to %s successful (Status: %s).", url, resp.Status), durationStr
	}
	return "FAILED", fmt.Sprintf("HTTP GET request to %s returned non-success status: %s.", url, resp.Status), durationStr
}

func main() {
	destinationsStr := flag.String("destinations", "", "A comma-separated list of destinations to test (e.g., 'google.com:443,http://example.com')")
	flag.Parse()

	if *destinationsStr == "" {
		fmt.Fprintln(os.Stderr, "Error: --destinations flag is required and cannot be empty.")
		os.Exit(1)
	}

	destinations := strings.Split(*destinationsStr, ",")
	if len(destinations) == 0 {
		fmt.Fprintln(os.Stderr, "Error: No destinations provided after splitting.")
		os.Exit(1)
	}

	for i, dest := range destinations {
		destinations[i] = strings.TrimSpace(dest)
	}

	var results []DestinationTestResult
	for _, dest := range destinations {
		if dest == "" {
			continue
		}

		var status, details, durationStr string // Add durationStr

		if strings.HasPrefix(dest, "http://") || strings.HasPrefix(dest, "https://") {
			status, details, durationStr = performHTTPGetCheck(dest) // Capture durationStr
		} else {
			if !strings.Contains(dest, ":") {
				status = "FAILED"
				details = fmt.Sprintf("Invalid destination format for TCP check: '%s'. Expected 'host:port'.", dest)
				durationStr = "0ms" // Or some indicator that test wasn't really run
			} else {
				status, details, durationStr = performTCPCheck(dest) // Capture durationStr
			}
		}

		results = append(results, DestinationTestResult{
			Destination: dest,
			Status:      status,
			Details:     details,
			Duration:    durationStr, // Assign duration
		})
	}

	jsonData, err := json.MarshalIndent(results, "", "  ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error marshaling JSON: %v\n", err)
		os.Exit(1)
	}
	fmt.Println(string(jsonData))
}
