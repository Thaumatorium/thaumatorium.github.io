import { gameTitleMap } from "./config.js";
import { visualizeGraphD3 } from "./graphVisualizer.js";
import { populateDropdown, setDefaultSelections } from "./ui.js";

const MAX_NODES_FOR_LINKS = 20000;
const FILTER_DEBOUNCE_MS = 750;

function debounce(func, wait) {
	let timeout;
	return function executedFunction(...args) {
		const later = () => {
			clearTimeout(timeout);
			func(...args);
		};
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
}

document.addEventListener("DOMContentLoaded", () => {
	console.log("DOM fully loaded and parsed.");

	const elements = {
		fileSelect1: document.getElementById("fileSelect1"),
		fileSelect2: document.getElementById("fileSelect2"),
		svgContainer: document.getElementById("d3-graph-container"),
		loadingMessage: document.getElementById("loadingMessage"),
		errorMessage: document.getElementById("errorMessage"),
		tooltip: document.getElementById("tooltip"),
		stopButton: document.getElementById("stopButton"),
		resumeButton: document.getElementById("resumeButton"),
		personCount1: document.getElementById("personCount1"),
		roleCount1: document.getElementById("roleCount1"),
		personCount2: document.getElementById("personCount2"),
		roleCount2: document.getElementById("roleCount2"),
		statsBox1: document.getElementById("statsBox1"),
		statsBox2: document.getElementById("statsBox2"),
		nameFilterInput: document.getElementById("nameFilterInput"),
		nameFilterMode: document.getElementById("nameFilterMode"),
		roleFilterInput: document.getElementById("roleFilterInput"),
		roleFilterMode: document.getElementById("roleFilterMode"),
	};

	let missingElement = false;
	for (const key in elements) {
		if (!elements[key]) {
			console.error(`Fatal Error: DOM element with ID '${key}' not found.`);
			if (!missingElement) {
				const errDiv = document.createElement("div");
				errDiv.className = "status-message error-message";
				errDiv.style.display = "block";
				errDiv.textContent = `Required element '${key}' is missing. Cannot start application. Check HTML IDs.`;
				document.body.prepend(errDiv);
				missingElement = true;
			}
		}
	}
	if (missingElement) return;

	const setSimulationButtonState = (isRunning) => {
		if (elements.stopButton) elements.stopButton.disabled = !isRunning;
		if (elements.resumeButton) elements.resumeButton.disabled = isRunning;
	};

	const state = {
		d3Simulation: null,
		lastFile1: null,
		lastFile2: null,
		personRolesMap: new Map(),
		normalizedRolePositions: new Map(),
		activeWorker: null,
		isShiftPressed: false,
		isSimulationStoppedByUser: false,
		stats1: null,
		stats2: null,
		currentFilters: {
			name: { text: "", mode: "contains" }, // Text might contain commas now
			role: { text: "", mode: "contains" }, // Text might contain commas now
		},
	};

	const handleDragRestart = () => {
		if (state.isSimulationStoppedByUser && state.d3Simulation && state.d3Simulation.alpha() < state.d3Simulation.alphaMin()) {
			console.log("Main: Simulation restarted by drag, updating state and buttons.");
			state.isSimulationStoppedByUser = false; // Mark as running again
			setSimulationButtonState(true); // Update buttons
		} else if (!state.isSimulationStoppedByUser && state.d3Simulation && state.d3Simulation.alpha() < state.d3Simulation.alphaMin()) {
			console.log("Main: Simulation restarted by drag from cooled state, ensuring buttons are correct.");
			setSimulationButtonState(true);
		}
	};
	const updateStatsUI = (stats1, stats2, els) => {
		const placeholder = "--";
		if (stats1 && typeof stats1.personCount === "number") {
			els.personCount1.textContent = stats1.personCount.toLocaleString();
			els.roleCount1.textContent = stats1.uniqueRoleCount.toLocaleString();
		} else {
			els.personCount1.textContent = placeholder;
			els.roleCount1.textContent = placeholder;
		}
		if (stats2 && typeof stats2.personCount === "number") {
			els.personCount2.textContent = stats2.personCount.toLocaleString();
			els.roleCount2.textContent = stats2.uniqueRoleCount.toLocaleString();
		} else {
			els.personCount2.textContent = placeholder;
			els.roleCount2.textContent = placeholder;
		}
	};

	async function runWorkerAndVisualize(filename1, filename2, filters) {
		console.log(`Main: Attempting D3 load via worker: ${filename1}, ${filename2}`, "Filters:", filters);
		elements.errorMessage.textContent = "";
		elements.errorMessage.style.display = "none";
		elements.errorMessage.classList.remove("error-message", "warning-message");
		elements.loadingMessage.style.display = "block";
		elements.tooltip.style.display = "none";
		elements.svgContainer.classList.remove("links-hidden", "show-all-labels");
		state.isShiftPressed = false;
		setSimulationButtonState(!!state.d3Simulation && !state.isSimulationStoppedByUser);

		if (state.activeWorker) {
			console.log("Main: Terminating previous worker.");
			state.activeWorker.terminate();
			state.activeWorker = null;
		}

		// Stop simulation *before* clearing SVG if it exists
		if (state.d3Simulation) {
			console.log("Main: Stopping previous simulation before update.");
			state.d3Simulation.stop();
			state.d3Simulation = null; // Nullify the simulation reference
		}
		// Clear SVG *after* stopping simulation, before starting worker
		elements.svgContainer.innerHTML = "";

		try {
			if (typeof window.d3 === "undefined") {
				throw new Error("D3.js library (window.d3) is not available.");
			}

			const worker = new Worker("./worker.js", { type: "module" });
			state.activeWorker = worker;

			worker.onmessage = (event) => {
				if (worker !== state.activeWorker) {
					console.log("Main: Received message from outdated D3 worker, ignoring.");
					return;
				}
				const {
					status,
					graphData,
					personRolesMapData,
					normalizedRolePositionsData,
					stats1,
					stats2,
					message,
					effectiveFilters, // Worker sends back the parsed/validated filters
				} = event.data;

				// Update state's filters if the worker changed them (e.g., sanitized)
				if (effectiveFilters) {
					// Reflect the potentially split/trimmed filter text back in state
					// but maybe not in the UI input to avoid surprising the user.
					state.currentFilters = effectiveFilters;
					console.log("Main: Updated state with effective filters from worker:", state.currentFilters);
				}

				state.stats1 = stats1;
				state.stats2 = stats2;
				updateStatsUI(state.stats1, state.stats2, elements);

				if (status === "success" && graphData?.nodes) {
					console.log("Main: Worker returned success.");
					// elements.svgContainer.innerHTML = ""; // Already cleared before worker starts

					state.personRolesMap = new Map();
					if (Array.isArray(personRolesMapData)) {
						personRolesMapData.forEach(([key, rolesArray]) => {
							if (key && Array.isArray(rolesArray)) {
								state.personRolesMap.set(key, new Set(rolesArray));
							}
						});
					}
					console.log(`Main: Reconstructed personRolesMap with ${state.personRolesMap.size} entries (post-filter).`);

					state.normalizedRolePositions = new Map();
					if (Array.isArray(normalizedRolePositionsData)) {
						normalizedRolePositionsData.forEach(([role, positionObject]) => {
							if (role && positionObject && typeof positionObject.normX === "number" && typeof positionObject.normY === "number") {
								state.normalizedRolePositions.set(role, positionObject);
							}
						});
					}
					console.log(`Main: Reconstructed normalizedRolePositions with ${state.normalizedRolePositions.size} entries (post-filter).`);

					let shouldHideLinks = false;
					if (graphData.nodes.length > MAX_NODES_FOR_LINKS) {
						console.warn(`Node count (${graphData.nodes.length}) exceeds limit (${MAX_NODES_FOR_LINKS}). Links will be visually hidden.`);
						shouldHideLinks = true;
						elements.errorMessage.textContent = `Links visually hidden for performance (${graphData.nodes.length} nodes > ${MAX_NODES_FOR_LINKS}). Filtering applied.`;
						elements.errorMessage.style.display = "block";
						elements.errorMessage.classList.add("warning-message");
						elements.errorMessage.classList.remove("error-message");
					} else if (elements.errorMessage.classList.contains("warning-message") && !elements.errorMessage.classList.contains("error-message")) {
						// Clear only link warning if count is now okay and no other error exists
						elements.errorMessage.textContent = "";
						elements.errorMessage.style.display = "none";
						elements.errorMessage.classList.remove("warning-message");
					}

					const visualizerDomElements = {
						svgContainer: elements.svgContainer,
						tooltipElement: elements.tooltip,
						errorMessageElement: elements.errorMessage,
					};
					state.d3Simulation = visualizeGraphD3(graphData, visualizerDomElements, state.personRolesMap, state.normalizedRolePositions, handleDragRestart);

					if (!state.d3Simulation) {
						console.warn("Main: visualizeGraphD3 returned null or failed.");
						const filterText = state.currentFilters.name.text || state.currentFilters.role.text ? " with current filters" : "";
						if (!elements.errorMessage.textContent || (!elements.errorMessage.classList.contains("warning-message") && !elements.errorMessage.classList.contains("error-message"))) {
							elements.errorMessage.textContent = `D3 Graph visualization failed to initialize${filterText}. Check console for details.`;
							elements.errorMessage.style.display = "block";
							elements.errorMessage.classList.add("error-message");
							elements.errorMessage.classList.remove("warning-message"); // Ensure it's an error
						}
						setSimulationButtonState(false);
					} else {
						console.log("Main: D3 Graph visualization initiated.");
						// Don't reset stop state here, keep user's preference
						if (shouldHideLinks) {
							elements.svgContainer.classList.add("links-hidden");
						} else {
							elements.svgContainer.classList.remove("links-hidden");
						}
						if (state.isShiftPressed) {
							// Apply shift state if held during load
							elements.svgContainer.classList.add("show-all-labels");
						}
						setSimulationButtonState(!state.isSimulationStoppedByUser);
					}
				} else {
					// Worker failed or returned no nodes
					const errorMsg = message || (status === "error" ? "Worker reported an error." : "Worker returned invalid data or no nodes passed filters.");
					console.error("Main: D3 Worker reported error or invalid data:", errorMsg, event.data);
					elements.errorMessage.textContent = `Error processing data: ${errorMsg}`;
					elements.errorMessage.style.display = "block";
					elements.errorMessage.classList.add("error-message");
					elements.errorMessage.classList.remove("warning-message");
					setSimulationButtonState(false);
					// elements.svgContainer.innerHTML = ""; // Already clear
				}
				elements.loadingMessage.style.display = "none";
				if (state.activeWorker === worker) {
					worker.terminate();
					state.activeWorker = null;
					console.log("Main: D3 Worker terminated after processing message.");
				}
			};

			worker.onerror = (error) => {
				if (worker !== state.activeWorker) {
					return;
				}
				console.error("Main: D3 Worker onerror event:", error);
				elements.errorMessage.textContent = `D3 Worker failed unexpectedly. (${error.message || "Unknown error"}) Check console.`;
				elements.errorMessage.style.display = "block";
				elements.errorMessage.classList.add("error-message");
				elements.errorMessage.classList.remove("warning-message");
				setSimulationButtonState(false);
				elements.loadingMessage.style.display = "none";
				updateStatsUI(null, null, elements);
				// elements.svgContainer.innerHTML = ""; // Already clear
				if (state.activeWorker === worker) {
					worker.terminate();
					state.activeWorker = null;
					console.log("Main: D3 Worker terminated after onerror.");
				}
			};

			worker.postMessage({ filename1, filename2, filters });
			console.log("Main: Sent job to D3 worker with filters.");
		} catch (error) {
			console.error("Main: Error setting up D3 worker or pre-check:", error);
			elements.errorMessage.textContent = `Initialization Error: ${error.message}`;
			elements.errorMessage.style.display = "block";
			elements.errorMessage.classList.add("error-message");
			elements.errorMessage.classList.remove("warning-message");
			setSimulationButtonState(false);
			elements.loadingMessage.style.display = "none";
			updateStatsUI(null, null, elements);
			state.lastFile1 = null;
			state.lastFile2 = null;
			state.currentFilters = { name: { text: "", mode: "contains" }, role: { text: "", mode: "contains" } };
			// Reset UI filters on major error
			elements.nameFilterInput.value = "";
			elements.nameFilterMode.value = "contains";
			elements.roleFilterInput.value = "";
			elements.roleFilterMode.value = "contains";
			if (state.activeWorker) {
				state.activeWorker.terminate();
				state.activeWorker = null;
			}
			if (state.d3Simulation) {
				state.d3Simulation.stop();
				state.d3Simulation = null;
			}
			elements.svgContainer.innerHTML = "";
		}
	}

	// Central trigger function
	function triggerLoad(forceReload = false) {
		const selectedFile1 = elements.fileSelect1.value;
		const selectedFile2 = elements.fileSelect2.value;
		// Get filter values directly from UI elements
		const nameFilterText = elements.nameFilterInput.value; // Don't trim here, let worker handle it
		const nameFilterMode = elements.nameFilterMode.value;
		const roleFilterText = elements.roleFilterInput.value; // Don't trim here
		const roleFilterMode = elements.roleFilterMode.value;

		// Check if filters *as typed in UI* differ from *state* filters
		const filtersChanged = nameFilterText !== state.currentFilters.name.text || nameFilterMode !== state.currentFilters.name.mode || roleFilterText !== state.currentFilters.role.text || roleFilterMode !== state.currentFilters.role.mode;

		const gamesChanged = selectedFile1 !== state.lastFile1 || selectedFile2 !== state.lastFile2;

		// Store the raw UI filter values in a temporary object to pass to worker
		const currentRawFilters = {
			name: { text: nameFilterText, mode: nameFilterMode },
			role: { text: roleFilterText, mode: roleFilterMode },
		};

		// Basic check for validity before proceeding
		if (!selectedFile1 || !selectedFile2) {
			if (state.d3Simulation) {
				state.d3Simulation.stop();
				state.d3Simulation = null;
				elements.svgContainer.innerHTML = "";
			}
			elements.tooltip.style.display = "none";
			elements.errorMessage.textContent = "";
			elements.errorMessage.style.display = "none";
			elements.errorMessage.classList.remove("error-message", "warning-message");
			updateStatsUI(null, null, elements);
			state.lastFile1 = null;
			state.lastFile2 = null; // Reset last selected
			state.stats1 = null;
			state.stats2 = null;
			// Keep current filters as they are in the UI
			console.log("Selection incomplete, graph and stats cleared.");
			if (elements.fileSelect1.options.length > 0) elements.fileSelect1.options[0].disabled = !!selectedFile1;
			if (elements.fileSelect2.options.length > 0) elements.fileSelect2.options[0].disabled = !!selectedFile2;
			return;
		}

		// Reload if forced, games changed, or filters changed
		if (forceReload || gamesChanged || filtersChanged) {
			console.log(`Triggering load. Games changed: ${gamesChanged}, Filters changed: ${filtersChanged}, Force reload: ${forceReload}`);
			state.lastFile1 = selectedFile1;
			state.lastFile2 = selectedFile2;
			// Update state filters *before* calling worker, so state reflects what was sent
			state.currentFilters = currentRawFilters;
			if (gamesChanged) {
				state.isSimulationStoppedByUser = false; // Reset stop only on game change
			}
			runWorkerAndVisualize(selectedFile1, selectedFile2, currentRawFilters); // Pass raw UI filters
		} else {
			console.log("No relevant changes detected, skipping reload.");
		}

		if (elements.fileSelect1.options.length > 0) elements.fileSelect1.options[0].disabled = true;
		if (elements.fileSelect2.options.length > 0) elements.fileSelect2.options[0].disabled = true;
	}

	// Debounced version specifically for text inputs
	const debouncedTriggerLoadForFilters = debounce(() => {
		console.log("Debounced filter trigger fired.");
		triggerLoad(false); // Don't force reload, let triggerLoad decide based on changes
	}, FILTER_DEBOUNCE_MS);

	try {
		populateDropdown(elements.fileSelect1, gameTitleMap);
		populateDropdown(elements.fileSelect2, gameTitleMap);

		// Attach event listeners
		elements.fileSelect1.addEventListener("change", () => triggerLoad(false));
		elements.fileSelect2.addEventListener("change", () => triggerLoad(false));

		// Filter MODE changes trigger immediately
		elements.nameFilterMode.addEventListener("change", () => triggerLoad(false));
		elements.roleFilterMode.addEventListener("change", () => triggerLoad(false));

		// Filter TEXT changes trigger the debounced function
		elements.nameFilterInput.addEventListener("input", debouncedTriggerLoadForFilters);
		elements.roleFilterInput.addEventListener("input", debouncedTriggerLoadForFilters);

		// Set initial state and load data
		setDefaultSelections(elements, () => triggerLoad(true)); // Use force=true for initial load
	} catch (uiError) {
		console.error("Error setting up UI:", uiError);
		elements.errorMessage.textContent = `Fatal UI Setup Error: ${uiError.message}`;
		elements.errorMessage.style.display = "block";
		elements.errorMessage.classList.add("error-message");
		elements.loadingMessage.style.display = "none";
		setSimulationButtonState(false);
		updateStatsUI(null, null, elements);
	}

	elements.stopButton.addEventListener("click", () => {
		if (state.d3Simulation) {
			console.log("Main: Stopping simulation via button.");
			state.d3Simulation.stop();
			state.isSimulationStoppedByUser = true;
			setSimulationButtonState(false);
		}
	});
	elements.resumeButton.addEventListener("click", () => {
		if (state.d3Simulation) {
			console.log("Main: Resuming simulation via button.");
			state.isSimulationStoppedByUser = false;
			state.d3Simulation.alphaTarget(0.3).restart();
			setSimulationButtonState(true);
		}
	});

	setSimulationButtonState(!!state.d3Simulation && !state.isSimulationStoppedByUser);
	window.addEventListener("keydown", (event) => {
		if (event.key === "Shift" && !state.isShiftPressed) {
			state.isShiftPressed = true;
			elements.svgContainer.classList.add("show-all-labels");
		}
		// Allow Enter in filter inputs to trigger the *debounced* function immediately
		if (event.key === "Enter" && (document.activeElement === elements.nameFilterInput || document.activeElement === elements.roleFilterInput)) {
			event.preventDefault();
			debouncedTriggerLoadForFilters();
		}
	});
	window.addEventListener("keyup", (event) => {
		if (event.key === "Shift") {
			state.isShiftPressed = false;
			elements.svgContainer.classList.remove("show-all-labels");
		}
	});
	window.addEventListener("blur", () => {
		if (state.isShiftPressed) {
			state.isShiftPressed = false;
			elements.svgContainer.classList.remove("show-all-labels");
		}
	});

	const styleEl = document.createElement("style");
	document.head.appendChild(styleEl);
	const styleSheet = styleEl.sheet;
	try {
		styleSheet.insertRule(`.warning-message { color: #8a6d3b; background-color: #fcf8e3; border: 1px solid #faebcc; font-weight: normal; }`, styleSheet.cssRules.length);
		styleSheet.insertRule(`.error-message { color: #a94442; background-color: #f2dede; border: 1px solid #ebccd1; font-weight: bold; }`, styleSheet.cssRules.length);
		styleSheet.insertRule(`.status-message.warning-message, .status-message.error-message { display: block; }`, styleSheet.cssRules.length);
	} catch (e) {
		console.error("Failed to insert status message styles:", e);
	}
});
