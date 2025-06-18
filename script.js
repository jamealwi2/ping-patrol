document.addEventListener('DOMContentLoaded', () => {
    const sourceInput = document.getElementById('source');
    const destinationsTextarea = document.getElementById('destinations');
    const prepopulatedDestsSelect = document.getElementById('prepopulated-destinations');
    const testButton = document.getElementById('test-button');

    const successfulResultsDiv = document.getElementById('successful-results');
    const failedResultsDiv = document.getElementById('failed-results');
    const celebrationBanner = document.getElementById('celebration-banner');
    const noResultsMessage = document.getElementById('no-results-message');

    // const samplePrepopulatedDests = [ ... ]; // Removed

    // Populate prepopulated destinations
    async function populatePrepopulatedDestinations() {
        try {
            const response = await fetch('pre-selected-destinations.txt');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} while fetching pre-selected-destinations.txt`);
            }
            const data = await response.text();
            const lines = data.trim().split('\n'); // Split by newline characters

            if (lines.length === 0 || (lines.length === 1 && lines[0].trim() === '')) {
                console.warn('pre-selected-destinations.txt is empty or contains only whitespace.');
                prepopulatedDestsSelect.innerHTML = '<option value="">No prepopulated destinations found</option>';
                return;
            }

            lines.forEach(line => {
                const parts = line.split(',');
                if (parts.length >= 2) { // Ensure there's at least a name and an address
                    const name = parts[0].trim();
                    const address = parts.slice(1).join(',').trim(); // Handle cases where name might have commas if not careful with input file
                    if (name && address) {
                        const option = document.createElement('option');
                        option.value = address;
                        option.textContent = `${name} (${address})`;
                        prepopulatedDestsSelect.appendChild(option);
                    } else {
                        console.warn(`Skipping malformed line in pre-selected-destinations.txt: ${line}`);
                    }
                } else {
                    console.warn(`Skipping malformed line (not enough parts) in pre-selected-destinations.txt: ${line}`);
                }
            });

        } catch (error) {
            console.error('Error loading or parsing prepopulated destinations:', error);
            // Display an error message in the dropdown or a dedicated status area
            prepopulatedDestsSelect.innerHTML = '<option value="">Error loading destinations</option>';
            // Optionally, display a more user-visible error message elsewhere on the page
            // const noResultsMessage = document.getElementById('no-results-message'); // Already defined above
            if (noResultsMessage) {
                noResultsMessage.textContent = 'Could not load prepopulated destinations. Please check the console for details.';
                noResultsMessage.classList.remove('hidden');
            }
        }
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

        if (successCount === 0 && results.length > 0) {
            successfulResultsDiv.innerHTML = '<p>No successful connections.</p>';
        }
        if (failedCount === 0 && results.length > 0) {
            failedResultsDiv.innerHTML = '<p>No failed connections.</p>';
        }

        if (results.length === 0) { // Should be covered by the first check, but as a safeguard
             noResultsMessage.textContent = `No test results to display for ${sourceCluster}.`;
             noResultsMessage.classList.remove('hidden');
             successfulResultsDiv.innerHTML = '<p>None</p>';
             failedResultsDiv.innerHTML = '<p>None</p>';
        }

        if (failedCount === 0 && successCount > 0) {
            celebrationBanner.textContent = `🎉 Hooray! All ${successCount} connection(s) from ${sourceCluster} were successful! 🎉`;
            celebrationBanner.classList.remove('hidden');
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
