/*
 * Populates a <select> dropdown element with game options.
 * @param {HTMLSelectElement} selectElement - The dropdown element to populate.
 * @param {Object<string, string>} titleMap - An object mapping filenames (values) to display titles (text).
 */
export function populateDropdown(selectElement, titleMap) {
	if (!selectElement) return;
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
 * Sets initial default selections for the dropdowns and triggers the initial data load.
 * @param {Object} elements - Object containing required DOM elements { fileSelect1, fileSelect2, errorMessage, ... }.
 * @param {Function} handleSelectionChangeCallback - The event handler function.
 */
export function setDefaultSelections(elements, handleSelectionChangeCallback) {
	const { fileSelect1, fileSelect2, errorMessage } = elements;
	if (fileSelect1.options.length <= 1 || fileSelect2.options.length <= 1) {
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
	} else if (availableFiles.length === 1) {
		fileSelect1.value = availableFiles[0];
		fileSelect2.value = availableFiles[0];
	} else {
		if (errorMessage) {
			errorMessage.textContent = "No game data available to select.";
			errorMessage.style.display = "block";
			errorMessage.classList.add("error-message");
		}
		fileSelect1.disabled = true;
		fileSelect2.disabled = true;
		return;
	}
	if (fileSelect1.options.length > 0) fileSelect1.options[0].disabled = true;
	if (fileSelect2.options.length > 0) fileSelect2.options[0].disabled = true;
	requestAnimationFrame(() => {
		handleSelectionChangeCallback();
	});
}
