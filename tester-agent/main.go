package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"net"
	"net/http" // Added
	"os"
	"strings"
	"time"
)

// DestinationTestResult holds the outcome of a single test.
// Ensure JSON tags match frontend expectations.
type DestinationTestResult struct {
	Destination string `json:"destination"`
	Status      string `json:"status"`    // e.g., "SUCCESS", "FAILED"
	Details     string `json:"details"`   // More specific information
	// Error       string `json:"error,omitempty"` // Optional: if there was an error during the test itself
}

// TestRunResults is a collection of all test results.
// The frontend currently expects a simple array of DestinationTestResult,
// so we might not need this top-level struct for JSON output directly to frontend,
// but it can be useful internally or if the output format evolves.
// For now, we'll aim to output a []DestinationTestResult directly.

// performTCPCheck attempts to connect to a given host and port.
// Returns status ("SUCCESS" or "FAILED") and details.
func performTCPCheck(destination string) (string, string) {
	// Default timeout for the connection attempt
	timeout := 5 * time.Second // Configurable if needed later

	conn, err := net.DialTimeout("tcp", destination, timeout)
	if err != nil {
		// Could be a variety of errors: refused, timeout, host not found, etc.
		return "FAILED", fmt.Sprintf("TCP connection to %s failed: %v", destination, err)
	}
	defer conn.Close() // Ensure the connection is closed
	return "SUCCESS", fmt.Sprintf("TCP connection to %s successful.", destination)
}

// performHTTPGetCheck attempts to make a GET request to a given URL.
// Returns status ("SUCCESS" or "FAILED") and details.
func performHTTPGetCheck(url string) (string, string) {
	timeout := 10 * time.Second // Configurable if needed later
	client := http.Client{
		Timeout: timeout,
	}

	resp, err := client.Get(url)
	if err != nil {
		return "FAILED", fmt.Sprintf("HTTP GET request to %s failed: %v", url, err)
	}
	defer resp.Body.Close()

	// We consider any 2xx status code as success for a basic check.
	// More specific checks (e.g., for 200 OK only) can be added if needed.
	if resp.StatusCode >= 200 && resp.StatusCode <= 299 {
		return "SUCCESS", fmt.Sprintf("HTTP GET request to %s successful (Status: %s).", url, resp.Status)
	}
	return "FAILED", fmt.Sprintf("HTTP GET request to %s returned non-success status: %s.", url, resp.Status)
}

func main() {
	destinationsStr := flag.String("destinations", "", "A comma-separated list of destinations to test (e.g., 'google.com:443,http://example.com')")
	flag.Parse()

	if *destinationsStr == "" {
		fmt.Fprintln(os.Stderr, "Error: --destinations flag is required and cannot be empty.")
		os.Exit(1) // Exit with error code if no destinations are provided
	}

	// Split the comma-separated string into a slice of individual destination strings
	destinations := strings.Split(*destinationsStr, ",")
	if len(destinations) == 0 {
		fmt.Fprintln(os.Stderr, "Error: No destinations provided after splitting.")
		os.Exit(1)
	}

	// Trim whitespace from each destination
	for i, dest := range destinations {
		destinations[i] = strings.TrimSpace(dest)
	}

	var results []DestinationTestResult
	for _, dest := range destinations {
		if dest == "" {
			continue
		}

		var status, details string

		if strings.HasPrefix(dest, "http://") || strings.HasPrefix(dest, "https://") {
			status, details = performHTTPGetCheck(dest)
		} else {
			// Assume TCP check for "host:port" format
			// Basic validation: check if it contains a colon, otherwise it's ambiguous
			if !strings.Contains(dest, ":") {
				status = "FAILED"
				details = fmt.Sprintf("Invalid destination format for TCP check: '%s'. Expected 'host:port'.", dest)
			} else {
				status, details = performTCPCheck(dest)
			}
		}

		results = append(results, DestinationTestResult{
			Destination: dest,
			Status:      status,
			Details:     details,
		})
	}

	// Marshal results to JSON and print to stdout
	jsonData, err := json.MarshalIndent(results, "", "  ") // Use MarshalIndent for pretty print
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error marshaling JSON: %v\n", err)
		os.Exit(1)
	}
	fmt.Println(string(jsonData))
}
