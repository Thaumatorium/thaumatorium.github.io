function createStatValue() {
	const value = document.createElement("span");
	value.className = "stat-value";
	value.textContent = "--";
	return value;
}

function createStatItem(labelText, valueElement) {
	const item = document.createElement("span");
	item.className = "stat-item";

	const label = document.createElement("span");
	label.className = "stat-label";
	label.textContent = `${labelText}:`;

	item.append(label, valueElement);
	return item;
}

/*
 * Populates a <select> dropdown element with game options.
 * @param {HTMLSelectElement} selectElement - The dropdown element to populate.
 * @param {Object<string, string>} titleMap - An object mapping filenames (values) to display titles (text).
 * @param {string} [selectedValue] - Optional value to preserve after repopulating.
 */
export function populateDropdown(selectElement, titleMap, selectedValue = "") {
	if (!selectElement) return;

	selectElement.innerHTML = "";
	const filenames = Object.keys(titleMap).sort();

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
	selectElement.appendChild(placeholder);

	filenames.forEach((filename) => {
		const option = document.createElement("option");
		option.value = filename;
		option.textContent = titleMap[filename];
		selectElement.appendChild(option);
	});

	selectElement.value = filenames.includes(selectedValue) ? selectedValue : "";
	selectElement.disabled = false;
}

export function createGameSelectionRow(rowId, rowIndex, titleMap, onChange, onRemove) {
	const row = document.createElement("div");
	row.className = "game-selection-row";
	row.dataset.rowId = String(rowId);

	const label = document.createElement("label");
	const select = document.createElement("select");
	select.id = `game-select-${rowId}`;
	select.setAttribute("aria-label", `Select game ${rowIndex}`);
	label.htmlFor = select.id;
	label.textContent = `Select Game ${rowIndex}:`;

	populateDropdown(select, titleMap);

	const personCount = createStatValue();
	const roleCount = createStatValue();

	const statsBox = document.createElement("div");
	statsBox.className = "stats-box";
	statsBox.setAttribute("aria-live", "polite");
	statsBox.setAttribute("aria-atomic", "true");
	statsBox.append(createStatItem("People", personCount), createStatItem("Unique Roles", roleCount));

	const removeButton = document.createElement("button");
	removeButton.type = "button";
	removeButton.className = "row-action-button remove-game-button";
	removeButton.textContent = "Remove";
	removeButton.setAttribute("aria-label", `Remove game ${rowIndex}`);

	select.addEventListener("change", () => onChange(rowId));
	removeButton.addEventListener("click", () => onRemove(rowId));

	row.append(label, select, statsBox, removeButton);

	return {
		rowId,
		row,
		label,
		select,
		personCount,
		roleCount,
		removeButton,
	};
}

export function updateGameSelectionRow(rowController, rowIndex) {
	if (!rowController) return;
	rowController.label.textContent = `Select Game ${rowIndex}:`;
	rowController.label.htmlFor = rowController.select.id;
	rowController.select.setAttribute("aria-label", `Select game ${rowIndex}`);
	rowController.removeButton.setAttribute("aria-label", `Remove game ${rowIndex}`);
}

export function updateRemoveButtons(rowControllers, minimumRows = 1) {
	const disableRemove = rowControllers.length <= minimumRows;
	rowControllers.forEach((rowController) => {
		rowController.removeButton.disabled = disableRemove;
	});
}

export function updateStatsForRows(rowControllers, statsByFilename) {
	rowControllers.forEach((rowController) => {
		const stats = statsByFilename.get(rowController.select.value);
		rowController.personCount.textContent = stats ? stats.personCount.toLocaleString() : "--";
		rowController.roleCount.textContent = stats ? stats.uniqueRoleCount.toLocaleString() : "--";
	});
}

export function syncDisabledGameOptions(rowControllers) {
	const selectedValues = rowControllers.map((rowController) => rowController.select.value).filter(Boolean);
	const selectedSet = new Set(selectedValues);

	rowControllers.forEach((rowController) => {
		Array.from(rowController.select.options).forEach((option) => {
			if (!option.value) {
				option.disabled = false;
				return;
			}
			option.disabled = option.value !== rowController.select.value && selectedSet.has(option.value);
		});
	});
}

export function setDefaultSelections(rowControllers, titleMap) {
	const availableFiles = Object.keys(titleMap).sort();

	rowControllers.forEach((rowController, index) => {
		rowController.select.value = availableFiles[index] ?? availableFiles[0] ?? "";
	});
}
