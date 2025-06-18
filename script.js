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
            const response = await fetch('http://localhost:5000/api/destinations');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} while fetching http://localhost:5000/api/destinations`);
            }

            const destinations = await response.json();

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
            console.error('Error fetching prepopulated destinations from API:', error);
            prepopulatedDestsSelect.innerHTML = '<option value="">Error loading destinations</option>';
            if (noResultsMessage) {
                noResultsMessage.textContent = 'Could not load prepopulated destinations from the backend. Please ensure the backend server is running and check console for details.';
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

        // Clear previous results from display areas
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

        // Prepare UI for testing
        successfulResultsDiv.innerHTML = `<p>Requesting tests from backend for ${source} to ${allDestinations.join(', ')}...</p>`;
        // failedResultsDiv.innerHTML = ''; // Already cleared above
        // celebrationBanner.classList.add('hidden'); // Already cleared above
        // noResultsMessage.classList.add('hidden'); // Already cleared above

        try {
            const response = await fetch('http://localhost:5000/api/test-connectivity', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    source: source,
                    destinations: allDestinations
                }),
            });

            if (!response.ok) {
                // Try to get error message from backend response body if possible
                let errorData;
                try {
                    errorData = await response.json();
                } catch (e) {
                    // Ignore if response is not JSON
                }
                const errorMessage = errorData && errorData.error ? errorData.error : `HTTP error! status: ${response.status}`;
                throw new Error(errorMessage);
            }

            const results = await response.json();
            displayResults(results, source); // Use existing displayResults function

        } catch (error) {
            console.error('Error during connectivity test:', error);
            // Display error in the UI
            failedResultsDiv.innerHTML = ''; // Clear any "testing..." message from successfulResultsDiv if it was used for that
            successfulResultsDiv.innerHTML = ''; // Clear "Requesting tests..." message
            noResultsMessage.textContent = `Error during connectivity test: ${error.message}. Please check the console for more details. Ensure the backend is running and reachable.`;
            noResultsMessage.classList.remove('hidden');
            celebrationBanner.classList.add('hidden');
        }
    });

    function displayResults(results, sourceCluster) {
        successfulResultsDiv.innerHTML = ''; // Clear any previous messages like "testing..."
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
