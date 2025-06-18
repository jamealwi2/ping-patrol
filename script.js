document.addEventListener('DOMContentLoaded', () => {
    const sourceInput = document.getElementById('source');
    const destinationsTextarea = document.getElementById('destinations');
    const prepopulatedDestsSelect = document.getElementById('prepopulated-destinations');
    const testButton = document.getElementById('test-button');
    // const resultsOutput = document.getElementById('results-output'); // Removed

    const successfulResultsDiv = document.getElementById('successful-results');
    const failedResultsDiv = document.getElementById('failed-results');
    const celebrationBanner = document.getElementById('celebration-banner');
    const noResultsMessage = document.getElementById('no-results-message');

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

        // Clear previous results and messages
        successfulResultsDiv.innerHTML = '';
        failedResultsDiv.innerHTML = '';
        celebrationBanner.classList.add('hidden');
        celebrationBanner.textContent = '';
        noResultsMessage.classList.add('hidden');


        if (!source) {
            noResultsMessage.textContent = "Error: Source (Kubernetes Cluster Name) cannot be empty.";
            noResultsMessage.classList.remove('hidden');
            return;
        }

        if (allDestinations.length === 0) {
            noResultsMessage.textContent = "Error: Please provide at least one destination.";
            noResultsMessage.classList.remove('hidden');
            return;
        }

        // Show a general "Testing..." message
        successfulResultsDiv.innerHTML = `<p>Testing connectivity from ${source} to ${allDestinations.join(', ')}...</p>`;

        // Placeholder for actual backend API call
        // For now, simulate results after a delay
        // resultsOutput.textContent += "Simulating backend call...\n"; // Removed
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
        // Clear previous results and messages
        successfulResultsDiv.innerHTML = '';
        failedResultsDiv.innerHTML = '';
        celebrationBanner.classList.add('hidden');
        celebrationBanner.textContent = '';
        noResultsMessage.classList.add('hidden');

        if (!results || results.length === 0) {
            noResultsMessage.textContent = `No test results to display for ${sourceCluster}.`;
            noResultsMessage.classList.remove('hidden');
            // Ensure other sections are not accidentally shown
            successfulResultsDiv.innerHTML = '<p>None</p>';
            failedResultsDiv.innerHTML = '<p>None</p>';
            return;
        }

        let failedCount = 0;
        let successCount = 0;

        results.forEach(result => {
            const resultElement = document.createElement('div');
            resultElement.classList.add('result-item');
            resultElement.innerHTML = `
                <p><strong>Destination:</strong> ${result.destination}</p>
                <p><strong>Status:</strong> <span class="status-${result.status.toLowerCase()}">${result.status}</span></p>
                <p><strong>Details:</strong> ${result.details}</p>
            `;
            if (result.status === "SUCCESS") {
                successfulResultsDiv.appendChild(resultElement);
                successCount++;
            } else {
                failedResultsDiv.appendChild(resultElement);
                failedCount++;
            }
        });

        if (successCount === 0 && results.length > 0) { // Check results.length to avoid overwriting "None" for empty initial results
            successfulResultsDiv.innerHTML = '<p>No successful connections.</p>';
        }
        if (failedCount === 0 && results.length > 0) {
            failedResultsDiv.innerHTML = '<p>No failed connections.</p>';
        }

        // If there were actually no results (e.g. initial state before any test), make sure "None" or "No results" is shown.
        // This is slightly redundant with the first check in this function but ensures clarity.
        if (results.length === 0) {
             noResultsMessage.textContent = `No test results to display for ${sourceCluster}.`;
             noResultsMessage.classList.remove('hidden');
             successfulResultsDiv.innerHTML = '<p>None</p>';
             failedResultsDiv.innerHTML = '<p>None</p>';
        }


        if (failedCount === 0 && successCount > 0) {
            celebrationBanner.textContent = `🎉 Hooray! All ${successCount} connection(s) from ${sourceCluster} were successful! 🎉`;
            celebrationBanner.classList.remove('hidden');
        } else if (failedCount > 0) {
            // Failed section is already populated, ensure banner is hidden (done at the start)
        }
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
