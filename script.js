document.addEventListener('DOMContentLoaded', () => {
    const sourceInput = document.getElementById('source');
    const destinationsTextarea = document.getElementById('destinations');
    const prepopulatedDestsSelect = document.getElementById('prepopulated-destinations');
    const testButton = document.getElementById('test-button');

    const successfulResultsDiv = document.getElementById('successful-results');
    const failedResultsDiv = document.getElementById('failed-results');
    const celebrationBanner = document.getElementById('celebration-banner');
    const noResultsMessage = document.getElementById('no-results-message');

    const k8sJobNameSpan = document.getElementById('k8s-job-name');
    const k8sPodNamesSpan = document.getElementById('k8s-pod-names');
    const executionDetailsSection = document.querySelector('.test-run-details details');

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

        successfulResultsDiv.innerHTML = '';
        failedResultsDiv.innerHTML = '';
        celebrationBanner.classList.add('hidden');
        celebrationBanner.textContent = '';
        noResultsMessage.classList.add('hidden');
        
        if (k8sJobNameSpan) k8sJobNameSpan.textContent = '-';
        if (k8sPodNamesSpan) k8sPodNamesSpan.textContent = '-';
        if (executionDetailsSection) executionDetailsSection.open = false; 


        if (!source) {
            noResultsMessage.textContent = "Error: Source (Kubernetes Cluster Name) cannot be empty. This is a mock field for now.";
            noResultsMessage.classList.remove('hidden');
            return;
        }

        if (allDestinations.length === 0) {
            noResultsMessage.textContent = "Error: Please provide at least one destination.";
            noResultsMessage.classList.remove('hidden');
            return;
        }
        
        successfulResultsDiv.innerHTML = `<p>Requesting tests from backend for destinations: ${allDestinations.join(', ')}...</p>`;
        
        try {
            const response = await fetch('http://localhost:5000/api/test-connectivity', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    destinations: allDestinations
                }),
            });

            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch (e) {
                }
                const errorMessage = errorData && errorData.error ? errorData.error : `HTTP error! status: ${response.status}`;
                throw new Error(errorMessage);
            }

            const responseData = await response.json(); 
            console.log("[DEBUG] Raw responseData from backend:", responseData); 
            handleTestResponse(responseData, source); 

        } catch (error) {
            console.error('Error during connectivity test:', error);
            failedResultsDiv.innerHTML = ''; 
            successfulResultsDiv.innerHTML = ''; 
            noResultsMessage.textContent = `Error during connectivity test: ${error.message}. Please check the console for more details. Ensure the backend is running and reachable.`;
            noResultsMessage.classList.remove('hidden');
            celebrationBanner.classList.add('hidden');
            if (k8sJobNameSpan) k8sJobNameSpan.textContent = '-';
            if (k8sPodNamesSpan) k8sPodNamesSpan.textContent = '-';
            if (executionDetailsSection) executionDetailsSection.open = false;
        }
    });

    function handleTestResponse(responseData, sourceCluster) { 
        console.log("[DEBUG] Entering handleTestResponse. responseData:", responseData, "sourceCluster:", sourceCluster);
        if (k8sJobNameSpan) k8sJobNameSpan.textContent = '-';
        if (k8sPodNamesSpan) k8sPodNamesSpan.textContent = '-';
        if (executionDetailsSection) executionDetailsSection.open = !!responseData.metadata;

        if (responseData.metadata) {
            if (k8sJobNameSpan) k8sJobNameSpan.textContent = responseData.metadata.kubernetesJobName || 'N/A';
            if (k8sPodNamesSpan) k8sPodNamesSpan.textContent = responseData.metadata.kubernetesPodNames ? responseData.metadata.kubernetesPodNames.join(', ') : 'N/A';
        }
        
        const resultsForDisplay = responseData.results || [];
        console.log("[DEBUG] In handleTestResponse, about to call displayResults with resultsForDisplay:", resultsForDisplay, "and sourceCluster:", sourceCluster);
        displayResults(resultsForDisplay, sourceCluster); 
    }

    function displayResults(results, sourceCluster) { 
        console.log("[DEBUG] Entering displayResults. Received results:", results, "Type of results:", typeof results, "Is Array:", Array.isArray(results), "sourceCluster:", sourceCluster);
        successfulResultsDiv.innerHTML = ''; 
        failedResultsDiv.innerHTML = '';
        celebrationBanner.classList.add('hidden');
        celebrationBanner.textContent = '';

        if (!results || results.length === 0) {
            noResultsMessage.textContent = `No test results to display for ${sourceCluster}. (Backend used its current kubectl context).`;
            noResultsMessage.classList.remove('hidden');
            successfulResultsDiv.innerHTML = '<p>None</p>'; 
            failedResultsDiv.innerHTML = '<p>None</p>';   
            return;
        } else {
            noResultsMessage.classList.add('hidden'); 
        }

        let failedCount = 0;
        let successCount = 0;

        results.forEach(result => {
            console.log("[DEBUG] Individual result object:", result); // <--- ADD THIS LINE
            const resultElement = document.createElement('div');
            resultElement.classList.add('result-item');
            
            let durationHtml = '';
            if (result.duration) {
                durationHtml = `<p><strong>Duration:</strong> ${result.duration}</p>`;
            }

            resultElement.innerHTML = `
                <p><strong>Destination:</strong> ${result.destination}</p>
                <p><strong>Status:</strong> <span class="status-${result.status.toLowerCase()}">${result.status}</span></p>
                ${durationHtml}
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
        
        if (failedCount === 0 && successCount > 0) {
            celebrationBanner.textContent = `🎉 Hooray! All ${successCount} connection(s) from the cluster were successful! 🎉`;
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
