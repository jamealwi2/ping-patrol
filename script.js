document.addEventListener('DOMContentLoaded', () => {
    const sourceInput = document.getElementById('source');
    const destinationsTextarea = document.getElementById('destinations');
    const prepopulatedDestsSelect = document.getElementById('prepopulated-destinations');
    const testButton = document.getElementById('test-button');

    const successfulResultsDiv = document.getElementById('successful-results');
    const failedResultsDiv = document.getElementById('failed-results');
    const celebrationBanner = document.getElementById('celebration-banner');
    const noResultsMessage = document.getElementById('no-results-message');

    // Populate prepopulated destinations
    async function populatePrepopulatedDestinations() {
        try {
            const response = await fetch('/api/destinations'); // Changed URL
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} while fetching /api/destinations`);
            }

            const destinations = await response.json(); // Get JSON data

            if (!destinations || destinations.length === 0) {
                console.warn('No prepopulated destinations received from API or API returned empty list.');
                prepopulatedDestsSelect.innerHTML = '<option value="">No prepopulated destinations found</option>';
                return;
            }

            destinations.forEach(dest => {
                if (dest.name && dest.address) {
                    const option = document.createElement('option');
                    option.value = dest.address;
                    option.textContent = `${dest.name} (${dest.address})`;
                    prepopulatedDestsSelect.appendChild(option);
                } else {
                    console.warn('Received a destination object with missing name or address:', dest);
                }
            });

        } catch (error) {
            console.error('Error fetching prepopulated destinations from API:', error); // Updated console message
            prepopulatedDestsSelect.innerHTML = '<option value="">Error loading destinations</option>';
            if (noResultsMessage) {
                noResultsMessage.textContent = 'Could not load prepopulated destinations from the backend. Please ensure the backend server is running and check console for details.'; // Updated user message
                noResultsMessage.classList.remove('hidden');
            }
        }
    }

    populatePrepopulatedDestinations();

    testButton.addEventListener('click', async () => {
        const source = sourceInput.value.trim();
        const manualDestinations = destinationsTextarea.value.trim().split(/[\s,]+/).filter(Boolean);
        const selectedPrepopulated = Array.from(prepopulatedDestsSelect.selectedOptions).map(option => option.value);

        const allDestinations = [...new Set([...manualDestinations, ...selectedPrepopulated])];

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

        successfulResultsDiv.innerHTML = `<p>Testing connectivity from ${source} to ${allDestinations.join(', ')}...</p>`;

        await new Promise(resolve => setTimeout(resolve, 1500));

        const mockResults = allDestinations.map(dest => {
            const isSuccess = Math.random() > 0.3;
            return {
                destination: dest,
                status: isSuccess ? "SUCCESS" : "FAILED",
                details: isSuccess ? "Connection successful." : "Connection timed out."
            };
        });

        displayResults(mockResults, source);
    });

    function displayResults(results, sourceCluster) {
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

        if (results.length === 0) {
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

    prepopulatedDestsSelect.addEventListener('dblclick', () => {
        const selectedValues = Array.from(prepopulatedDestsSelect.selectedOptions).map(option => option.value);
        if (selectedValues.length > 0) {
            const currentTextDests = destinationsTextarea.value.trim().split(/[\s,]+/).filter(Boolean);
            const newDests = [...new Set([...currentTextDests, ...selectedValues])];
            destinationsTextarea.value = newDests.join('\n');
        }
    });
});
