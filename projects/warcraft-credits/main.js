import { gameTitleMap } from "./config.js";
import { visualizeGraphD3 } from "./graphVisualizer.js";
import { populateDropdown, setDefaultSelections } from "./ui.js";

const MAX_NODES_FOR_LINKS = 20000;
const FILTER_DEBOUNCE_MS = 250;
const RESIZE_DEBOUNCE_MS = 150;

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
		sharedCount: document.getElementById("sharedCount"),
		sharedStats: document.getElementById("sharedStats"),
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
	const resetSharedStats = () => {
		if (!elements.sharedStats || !elements.sharedCount) return;
		elements.sharedCount.textContent = "0";
		elements.sharedStats.style.display = "none";
	};
	const updateSharedStats = (sharedCount) => {
		if (!elements.sharedStats || !elements.sharedCount) return;
		if (typeof sharedCount === "number" && sharedCount > 0) {
			elements.sharedCount.textContent = sharedCount.toLocaleString();
			elements.sharedStats.style.display = "";
			return;
		}
		resetSharedStats();
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
		currentGraphData: null,
		currentFilters: {
			name: { text: "", mode: "contains" }, // Text might contain commas now
			role: { text: "", mode: "contains" }, // Text might contain commas now
		},
	};
	const buildRenderState = () => {
		if (!state.currentGraphData?.nodes?.length || !state.d3Simulation) return {};
		const preservedPositions = new Map(state.currentGraphData.nodes.filter((node) => Number.isFinite(node.x) && Number.isFinite(node.y)).map((node) => [node.id, { x: node.x, y: node.y }]));
		return {
			preservedPositions,
			previousSize: state.d3Simulation.renderSize ?? elements.svgContainer.getBoundingClientRect(),
		};
	};
	const renderGraph = (graphData, renderState = {}) => {
		const visualizerDomElements = {
			svgContainer: elements.svgContainer,
			tooltipElement: elements.tooltip,
			errorMessageElement: elements.errorMessage,
		};
		state.d3Simulation = visualizeGraphD3(graphData, visualizerDomElements, state.personRolesMap, state.normalizedRolePositions, handleDragRestart, renderState);
		return state.d3Simulation;
	};

	const handleDragRestart = () => {
		if (state.d3Simulation && state.d3Simulation.alpha() < state.d3Simulation.alphaMin()) {
			state.isSimulationStoppedByUser = false;
			setSimulationButtonState(true);
		}
	};
	const rerenderGraph = () => {
		if (!state.currentGraphData?.nodes?.length) return;
		const renderState = buildRenderState();

		if (state.d3Simulation) {
			state.d3Simulation.stop();
			state.d3Simulation = null;
		}

		state.d3Simulation = renderGraph(state.currentGraphData, renderState);

		if (!state.d3Simulation) {
			setSimulationButtonState(false);
			return;
		}

		if (state.isShiftPressed) {
			elements.svgContainer.classList.add("show-all-labels");
		}
		if (state.isSimulationStoppedByUser) {
			state.d3Simulation.stop();
			setSimulationButtonState(false);
			return;
		}
		setSimulationButtonState(true);
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

	/** Show/hide the error/warning message element. Call with no args to clear. */
	const showMessage = (text, type) => {
		const el = elements.errorMessage;
		if (!text) {
			el.textContent = "";
			el.style.display = "none";
			el.classList.remove("error-message", "warning-message");
			return;
		}
		el.textContent = text;
		el.style.display = "block";
		el.classList.toggle("error-message", type === "error");
		el.classList.toggle("warning-message", type === "warning");
	};

	async function runWorkerAndVisualize(filename1, filename2, filters) {
		showMessage(); // clear
		elements.loadingMessage.style.display = "block";
		elements.tooltip.style.display = "none";
		elements.svgContainer.classList.remove("links-hidden", "show-all-labels");
		state.isShiftPressed = false;
		setSimulationButtonState(!!state.d3Simulation && !state.isSimulationStoppedByUser);

		if (state.activeWorker) {
			state.activeWorker.terminate();
			state.activeWorker = null;
		}

		// Stop simulation *before* clearing SVG if it exists
		if (state.d3Simulation) {
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
				if (worker !== state.activeWorker) return;
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

				if (effectiveFilters) {
					state.currentFilters = effectiveFilters;
				}

				state.stats1 = stats1;
				state.stats2 = stats2;
				updateStatsUI(state.stats1, state.stats2, elements);
				updateSharedStats(event.data.sharedCount);

				if (status === "success" && graphData?.nodes) {
					state.currentGraphData = graphData;

					state.personRolesMap = new Map();
					if (Array.isArray(personRolesMapData)) {
						personRolesMapData.forEach(([key, roleDetails]) => {
							if (key && roleDetails && typeof roleDetails === "object") {
								state.personRolesMap.set(key, {
									allRoles: new Set(roleDetails.allRoles ?? []),
									game1Roles: new Set(roleDetails.game1Roles ?? []),
									game2Roles: new Set(roleDetails.game2Roles ?? []),
									sharedRoles: new Set(roleDetails.sharedRoles ?? []),
									game1OnlyRoles: new Set(roleDetails.game1OnlyRoles ?? []),
									game2OnlyRoles: new Set(roleDetails.game2OnlyRoles ?? []),
								});
							}
						});
					}

					state.normalizedRolePositions = new Map();
					if (Array.isArray(normalizedRolePositionsData)) {
						normalizedRolePositionsData.forEach(([role, positionObject]) => {
							if (role && positionObject && typeof positionObject.normX === "number" && typeof positionObject.normY === "number") {
								state.normalizedRolePositions.set(role, positionObject);
							}
						});
					}

					let shouldHideLinks = false;
					if (graphData.nodes.length > MAX_NODES_FOR_LINKS) {
						shouldHideLinks = true;
						showMessage(`Links visually hidden for performance (${graphData.nodes.length} nodes > ${MAX_NODES_FOR_LINKS}). Filtering applied.`, "warning");
					} else if (elements.errorMessage.classList.contains("warning-message") && !elements.errorMessage.classList.contains("error-message")) {
						showMessage();
					}

					state.d3Simulation = renderGraph(graphData);

					if (!state.d3Simulation) {
						const filterText = state.currentFilters.name.text || state.currentFilters.role.text ? " with current filters" : "";
						if (!elements.errorMessage.textContent) {
							showMessage(`D3 Graph visualization failed to initialize${filterText}. Check console for details.`, "error");
						}
						setSimulationButtonState(false);
					} else {
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
					const errorMsg = message || (status === "error" ? "Worker reported an error." : "Worker returned invalid data or no nodes passed filters.");
					console.error("Main: D3 Worker reported error or invalid data:", errorMsg, event.data);
					state.currentGraphData = null;
					resetSharedStats();
					showMessage(`Error processing data: ${errorMsg}`, "error");
					setSimulationButtonState(false);
				}
				elements.loadingMessage.style.display = "none";
				if (state.activeWorker === worker) {
					worker.terminate();
					state.activeWorker = null;
				}
			};

			worker.onerror = (error) => {
				if (worker !== state.activeWorker) return;
				console.error("Main: D3 Worker onerror event:", error);
				showMessage(`D3 Worker failed unexpectedly. (${error.message || "Unknown error"}) Check console.`, "error");
				setSimulationButtonState(false);
				elements.loadingMessage.style.display = "none";
				updateStatsUI(null, null, elements);
				resetSharedStats();
				if (state.activeWorker === worker) {
					worker.terminate();
					state.activeWorker = null;
				}
			};

			worker.onmessageerror = () => {
				if (worker !== state.activeWorker) return;
				showMessage("Worker returned a malformed message. Check console.", "error");
				setSimulationButtonState(false);
				elements.loadingMessage.style.display = "none";
				updateStatsUI(null, null, elements);
				resetSharedStats();
				if (state.activeWorker === worker) {
					worker.terminate();
					state.activeWorker = null;
				}
			};

			worker.postMessage({ filename1, filename2, filters });
		} catch (error) {
			console.error("Main: Error setting up D3 worker or pre-check:", error);
			showMessage(`Initialization Error: ${error.message}`, "error");
			setSimulationButtonState(false);
			elements.loadingMessage.style.display = "none";
			updateStatsUI(null, null, elements);
			resetSharedStats();
			state.lastFile1 = null;
			state.lastFile2 = null;
			state.currentGraphData = null;
			state.currentFilters = {
				name: { text: "", mode: "contains" },
				role: { text: "", mode: "contains" },
			};
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
			showMessage();
			updateStatsUI(null, null, elements);
			resetSharedStats();
			state.lastFile1 = null;
			state.lastFile2 = null;
			state.stats1 = null;
			state.stats2 = null;
			state.currentGraphData = null;
			if (elements.fileSelect1.options.length > 0) elements.fileSelect1.options[0].disabled = !!selectedFile1;
			if (elements.fileSelect2.options.length > 0) elements.fileSelect2.options[0].disabled = !!selectedFile2;
			return;
		}

		// Reload if forced, games changed, or filters changed
		if (forceReload || gamesChanged || filtersChanged) {
			state.lastFile1 = selectedFile1;
			state.lastFile2 = selectedFile2;
			// Update state filters *before* calling worker, so state reflects what was sent
			state.currentFilters = currentRawFilters;
			if (gamesChanged) {
				state.isSimulationStoppedByUser = false; // Reset stop only on game change
			}
			runWorkerAndVisualize(selectedFile1, selectedFile2, currentRawFilters); // Pass raw UI filters
		}

		if (elements.fileSelect1.options.length > 0) elements.fileSelect1.options[0].disabled = true;
		if (elements.fileSelect2.options.length > 0) elements.fileSelect2.options[0].disabled = true;
	}

	// Debounced version specifically for text inputs
	const debouncedTriggerLoadForFilters = debounce(() => triggerLoad(false), FILTER_DEBOUNCE_MS);
	const debouncedRerender = debounce(rerenderGraph, RESIZE_DEBOUNCE_MS);

	try {
		populateDropdown(elements.fileSelect1, gameTitleMap);
		populateDropdown(elements.fileSelect2, gameTitleMap);
		resetSharedStats();

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
		showMessage(`Fatal UI Setup Error: ${uiError.message}`, "error");
		elements.loadingMessage.style.display = "none";
		setSimulationButtonState(false);
		updateStatsUI(null, null, elements);
	}

	elements.stopButton.addEventListener("click", () => {
		if (state.d3Simulation) {
			state.d3Simulation.stop();
			state.isSimulationStoppedByUser = true;
			setSimulationButtonState(false);
		}
	});
	elements.resumeButton.addEventListener("click", () => {
		if (state.d3Simulation) {
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
		// Allow Enter in filter inputs to trigger load immediately
		if (event.key === "Enter" && (document.activeElement === elements.nameFilterInput || document.activeElement === elements.roleFilterInput)) {
			event.preventDefault();
			triggerLoad(false);
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
	const resizeObserver = new ResizeObserver(() => {
		debouncedRerender();
	});
	resizeObserver.observe(elements.svgContainer);
});
