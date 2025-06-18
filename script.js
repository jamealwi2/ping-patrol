document.addEventListener('DOMContentLoaded', () => {
    const sourceInput = document.getElementById('source');
    const destinationsTextarea = document.getElementById('destinations');
    const prepopulatedDestsSelect = document.getElementById('prepopulated-destinations');
    const testButton = document.getElementById('test-button');
    const resultsOutput = document.getElementById('results-output');

    // Sample prepopulated destinations (replace with actual data source if available)
    const samplePrepopulatedDests = [
        { name: "Google DNS", address: "8.8.8.8" },
        { name: "Cloudflare DNS", address: "1.1.1.1" },
        { name: "Example.com", address: "example.com" },
        { name: "Internal Service A (Prod)", address: "service-a.prod.svc.cluster.local:8080" },
        { name: "Internal Service B (Dev)", address: "service-b.dev.svc.cluster.local:3000" }
    ];

    // Populate prepopulated destinations
    function populatePrepopulatedDestinations() {
        samplePrepopulatedDests.forEach(dest => {
            const option = document.createElement('option');
            option.value = dest.address;
            option.textContent = `${dest.name} (${dest.address})`;
            prepopulatedDestsSelect.appendChild(option);
        });
    }

    populatePrepopulatedDestinations();

    testButton.addEventListener('click', async () => {
        const source = sourceInput.value.trim();
        const manualDestinations = destinationsTextarea.value.trim().split(/[\s,]+/).filter(Boolean);
        const selectedPrepopulated = Array.from(prepopulatedDestsSelect.selectedOptions).map(option => option.value);

        const allDestinations = [...new Set([...manualDestinations, ...selectedPrepopulated])]; // Combine and remove duplicates

        if (!source) {
            resultsOutput.textContent = "Error: Source (Kubernetes Cluster Name) cannot be empty.";
            return;
        }

        if (allDestinations.length === 0) {
            resultsOutput.textContent = "Error: Please provide at least one destination.";
            return;
        }

        resultsOutput.textContent = "Testing connectivity...\n";
        resultsOutput.textContent += `Source: ${source}\n`;
        resultsOutput.textContent += `Destinations: ${allDestinations.join(', ')}\n\n`;

        // Placeholder for actual backend API call
        // For now, simulate results after a delay

        // Simulate API call and display mock results
        // In a real application, this would be an asynchronous call to a backend API
        // e.g., const response = await fetch('/api/test-connectivity', { /* ... */ });
        // const data = await response.json();
        // displayResults(data);

        resultsOutput.textContent += "Simulating backend call...\n";
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay

        const mockResults = allDestinations.map(dest => {
            const isSuccess = Math.random() > 0.3; // Simulate success/failure
            return {
                destination: dest,
                status: isSuccess ? "SUCCESS" : "FAILED",
                details: isSuccess ? "Connection successful." : "Connection timed out."
            };
        });

        displayResults(mockResults, source);
    });

    function displayResults(results, sourceCluster) {
        resultsOutput.textContent = `Connectivity Test Results from ${sourceCluster}:\n\n`;
        if (results.length === 0) {
            resultsOutput.textContent += "No results to display.";
            return;
        }
        results.forEach(result => {
            resultsOutput.textContent += `Destination: ${result.destination}\n`;
            resultsOutput.textContent += `Status: ${result.status}\n`;
            resultsOutput.textContent += `Details: ${result.details}\n\n`;
        });
    }

    // Allow users to add destinations from select to textarea by double clicking
    prepopulatedDestsSelect.addEventListener('dblclick', () => {
        const selectedValues = Array.from(prepopulatedDestsSelect.selectedOptions).map(option => option.value);
        if (selectedValues.length > 0) {
            const currentTextDests = destinationsTextarea.value.trim().split(/[\s,]+/).filter(Boolean);
            const newDests = [...new Set([...currentTextDests, ...selectedValues])];
            destinationsTextarea.value = newDests.join('\n');
        }
    });
});
