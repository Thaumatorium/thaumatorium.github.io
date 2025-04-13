/*
 * Populates a <select> dropdown element with game options.
 * @param {HTMLSelectElement} selectElement - The dropdown element to populate.
 * @param {Object<string, string>} titleMap - An object mapping filenames (values) to display titles (text).
 */
export function populateDropdown(selectElement, titleMap) {
	if (!selectElement) {
		console.error("populateDropdown: Invalid select element provided.");
		return;
	}
	selectElement.innerHTML = ""; // Clear existing options

	const filenames = Object.keys(titleMap).sort(); // Get and sort filenames

	if (filenames.length === 0) {
		const option = document.createElement("option");
		option.value = "";
		option.textContent = "No games configured";
		option.disabled = true;
		selectElement.appendChild(option);
		selectElement.disabled = true;
		return;
	}
	const placeholder = document.createElement("option");
	placeholder.value = "";
	placeholder.textContent = "-- Select a Game --";
	placeholder.disabled = true;
	placeholder.selected = true; // Make it the default display
	selectElement.appendChild(placeholder);
	filenames.forEach((filename) => {
		const option = document.createElement("option");
		option.value = filename; // The value is the filename
		option.textContent = titleMap[filename]; // The text is the friendly title
		selectElement.appendChild(option);
	});

	selectElement.disabled = false; // Enable the dropdown
}

/**
 * Creates the event handler function for changes in the game selection dropdowns.
 * @param {Object} elements - Object containing required DOM elements { fileSelect1, fileSelect2, errorMessage, svgContainer, tooltip, ...statsElements }.
 * @param {Object} state - Application state object { d3Simulation, lastFile1, lastFile2, stats1, stats2 }.
 * @param {Function} loadAndVisualizeCallback - The async function to call when selections change.
 * @param {Function} updateStatsUICallback - Function to update the stats display.
 * @returns {Function} The event handler function to attach to 'change' events.
 */
export function createHandleSelectionChange(
	elements,
	state,
	loadAndVisualizeCallback,
	updateStatsUICallback // <-- Add stats update callback
) {
	const { fileSelect1, fileSelect2, errorMessage, svgContainer, tooltip } = elements;

	return function handleSelectionChange() {
		const selectedFile1 = fileSelect1.value;
		const selectedFile2 = fileSelect2.value;
		const isFile1Selected = !!selectedFile1;
		const isFile2Selected = !!selectedFile2;
		if (fileSelect1.options.length > 0) fileSelect1.options[0].disabled = isFile1Selected;
		if (fileSelect2.options.length > 0) fileSelect2.options[0].disabled = isFile2Selected;

		if (!selectedFile1 || !selectedFile2) {
			if (state.d3Simulation) {
				state.d3Simulation.stop();
				state.d3Simulation = null;
				svgContainer.innerHTML = ""; // Clear the SVG content
			}
			tooltip.style.display = "none"; // Hide tooltip
			errorMessage.textContent = ""; // Clear error message text
			errorMessage.style.display = "none"; // Hide error message element
			errorMessage.classList.remove("error-message", "warning-message"); // Reset error classes
			updateStatsUICallback(null, null, elements); // <-- Clear stats display
			state.lastFile1 = null; // Reset last selected state
			state.lastFile2 = null;
			state.stats1 = null; // Clear stats state
			state.stats2 = null; // Clear stats state
			console.log("Selection incomplete, graph and stats cleared.");
			return; // Stop processing
		}
		if (selectedFile1 === state.lastFile1 && selectedFile2 === state.lastFile2) {
			console.log("Selection hasn't changed, skipping reload.");
			return;
		}

		console.log(`Selection changed. New selection: ${selectedFile1}, ${selectedFile2}`);
		state.lastFile1 = selectedFile1;
		state.lastFile2 = selectedFile2;
		loadAndVisualizeCallback(selectedFile1, selectedFile2);
	};
}

/**
 * Sets initial default selections for the dropdowns and triggers the initial data load.
 * @param {Object} elements - Object containing required DOM elements { fileSelect1, fileSelect2, errorMessage, ... }.
 * @param {Function} handleSelectionChangeCallback - The event handler function.
 */
export function setDefaultSelections(elements, handleSelectionChangeCallback) {
	const { fileSelect1, fileSelect2, errorMessage } = elements;
	if (fileSelect1.options.length <= 1 || fileSelect2.options.length <= 1) {
		console.warn("setDefaultSelections: Dropdowns not populated or empty.");
		if (errorMessage) {
			errorMessage.textContent = "Cannot set default games: No game data found or UI not ready.";
			errorMessage.style.display = "block";
			errorMessage.classList.add("error-message");
		}
		fileSelect1.disabled = true;
		fileSelect2.disabled = true;
		return;
	}
	const availableFiles = Array.from(fileSelect1.options)
		.map((opt) => opt.value)
		.filter((val) => val !== ""); // Filter out empty value from placeholder

	if (availableFiles.length >= 2) {
		fileSelect1.value = availableFiles[0];
		fileSelect2.value = availableFiles[1];
		console.log(`Default selections set (by filename): ${availableFiles[0]}, ${availableFiles[1]}`);
	} else if (availableFiles.length === 1) {
		fileSelect1.value = availableFiles[0];
		fileSelect2.value = availableFiles[0];
		console.log(`Single game available. Default selections set (by filename): ${availableFiles[0]}, ${availableFiles[0]}`);
	} else {
		if (errorMessage) {
			errorMessage.textContent = "No game data available to select.";
			errorMessage.style.display = "block";
			errorMessage.classList.add("error-message");
		}
		fileSelect1.disabled = true;
		fileSelect2.disabled = true;
		console.error("setDefaultSelections: No valid game files found after population.");
		return;
	}
	if (fileSelect1.options.length > 0) fileSelect1.options[0].disabled = true;
	if (fileSelect2.options.length > 0) fileSelect2.options[0].disabled = true;
	requestAnimationFrame(() => {
		handleSelectionChangeCallback();
	});
}
