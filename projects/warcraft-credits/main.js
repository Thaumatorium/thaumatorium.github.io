import { gameTitleMap } from "./config.js";
import { visualizeGraphD3 } from "./graphVisualizer.js";
import { createGameSelectionRow, setDefaultSelections, syncDisabledGameOptions, updateGameSelectionRow, updateRemoveButtons, updateStatsForRows } from "./ui.js";

const MAX_NODES_FOR_LINKS = 20000;
const FILTER_DEBOUNCE_MS = 250;
const RESIZE_DEBOUNCE_MS = 150;
const MINIMUM_GAME_ROWS = 1;
const INITIAL_GAME_ROWS = 2;

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

function arraysEqual(left, right) {
	if (left.length !== right.length) return false;
	return left.every((value, index) => value === right[index]);
}

document.addEventListener("DOMContentLoaded", () => {
	const elements = {
		gameSelectionList: document.getElementById("gameSelectionList"),
		addGameButton: document.getElementById("addGameButton"),
		svgContainer: document.getElementById("d3-graph-container"),
		loadingMessage: document.getElementById("loadingMessage"),
		errorMessage: document.getElementById("errorMessage"),
		tooltip: document.getElementById("tooltip"),
		stopButton: document.getElementById("stopButton"),
		resumeButton: document.getElementById("resumeButton"),
		nameFilterInput: document.getElementById("nameFilterInput"),
		nameFilterMode: document.getElementById("nameFilterMode"),
		roleFilterInput: document.getElementById("roleFilterInput"),
		roleFilterMode: document.getElementById("roleFilterMode"),
		sharedCount: document.getElementById("sharedCount"),
		sharedStats: document.getElementById("sharedStats"),
		selectedGameCount: document.getElementById("selectedGameCount"),
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

	const state = {
		rows: [],
		nextRowId: 1,
		d3Simulation: null,
		lastSelectedFiles: [],
		personRolesMap: new Map(),
		normalizedRolePositions: new Map(),
		activeWorker: null,
		isShiftPressed: false,
		isSimulationStoppedByUser: false,
		currentGraphData: null,
		currentFilters: {
			name: { text: "", mode: "contains" },
			role: { text: "", mode: "contains" },
		},
	};

	const setSimulationButtonState = (isRunning) => {
		elements.stopButton.disabled = !isRunning;
		elements.resumeButton.disabled = isRunning;
	};

	const resetSharedStats = () => {
		elements.sharedCount.textContent = "0";
		elements.selectedGameCount.textContent = "0";
		elements.sharedStats.style.display = "none";
	};

	const updateSharedStats = (sharedCount, selectedCount) => {
		elements.selectedGameCount.textContent = String(selectedCount || 0);
		if (typeof sharedCount === "number" && sharedCount > 0 && selectedCount > 1) {
			elements.sharedCount.textContent = sharedCount.toLocaleString();
			elements.sharedStats.style.display = "";
			return;
		}
		resetSharedStats();
	};

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

	const updateStatsUI = (perGameStats) => {
		const statsByFilename = new Map((perGameStats ?? []).map((stats) => [stats.filename, stats]));
		updateStatsForRows(state.rows, statsByFilename);
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

	const getCurrentFiltersFromUI = () => ({
		name: { text: elements.nameFilterInput.value, mode: elements.nameFilterMode.value },
		role: { text: elements.roleFilterInput.value, mode: elements.roleFilterMode.value },
	});

	const collectSelectedFiles = () => state.rows.map((rowController) => rowController.select.value).filter(Boolean);

	const refreshGameSelectionUI = () => {
		state.rows.forEach((rowController, index) => {
			updateGameSelectionRow(rowController, index + 1);
		});
		updateRemoveButtons(state.rows, MINIMUM_GAME_ROWS);
		syncDisabledGameOptions(state.rows);
		elements.addGameButton.disabled = !getNextAvailableGame();
	};

	const clearVisualization = () => {
		if (state.activeWorker) {
			state.activeWorker.terminate();
			state.activeWorker = null;
		}
		if (state.d3Simulation) {
			state.d3Simulation.stop();
			state.d3Simulation = null;
		}
		state.currentGraphData = null;
		state.lastSelectedFiles = [];
		elements.svgContainer.innerHTML = "";
		elements.tooltip.style.display = "none";
		elements.svgContainer.classList.remove("links-hidden", "show-all-labels");
		updateStatsUI([]);
		resetSharedStats();
		setSimulationButtonState(false);
	};

	const handleRowSelectionChange = () => {
		refreshGameSelectionUI();
		triggerLoad(false);
	};

	const handleRemoveGameRow = (rowId) => {
		if (state.rows.length <= MINIMUM_GAME_ROWS) return;
		const rowIndex = state.rows.findIndex((rowController) => rowController.rowId === rowId);
		if (rowIndex === -1) return;

		const [rowController] = state.rows.splice(rowIndex, 1);
		rowController.row.remove();
		refreshGameSelectionUI();
		triggerLoad(true);
	};

	const createRow = (selectedValue = "") => {
		const rowController = createGameSelectionRow(state.nextRowId++, state.rows.length + 1, gameTitleMap, handleRowSelectionChange, handleRemoveGameRow);
		state.rows.push(rowController);
		elements.gameSelectionList.appendChild(rowController.row);
		if (selectedValue) {
			rowController.select.value = selectedValue;
		}
		return rowController;
	};

	const getNextAvailableGame = () => {
		const selected = new Set(collectSelectedFiles());
		return Object.keys(gameTitleMap)
			.sort()
			.find((filename) => !selected.has(filename));
	};

	async function runWorkerAndVisualize(selectedFiles, filters) {
		showMessage();
		elements.loadingMessage.style.display = "block";
		elements.tooltip.style.display = "none";
		elements.svgContainer.classList.remove("links-hidden", "show-all-labels");
		state.isShiftPressed = false;
		setSimulationButtonState(!!state.d3Simulation && !state.isSimulationStoppedByUser);

		if (state.activeWorker) {
			state.activeWorker.terminate();
			state.activeWorker = null;
		}

		if (state.d3Simulation) {
			state.d3Simulation.stop();
			state.d3Simulation = null;
		}
		elements.svgContainer.innerHTML = "";

		try {
			if (typeof window.d3 === "undefined") {
				throw new Error("D3.js library (window.d3) is not available.");
			}

			const worker = new Worker("./worker.js", { type: "module" });
			state.activeWorker = worker;

			worker.onmessage = (event) => {
				if (worker !== state.activeWorker) return;

				const { status, graphData, personRolesMapData, normalizedRolePositionsData, perGameStats, sharedCount, selectedGameCount, message, effectiveFilters } = event.data;

				if (effectiveFilters) {
					state.currentFilters = effectiveFilters;
				}

				updateStatsUI(perGameStats);
				updateSharedStats(sharedCount, selectedGameCount);

				if (status === "success" && graphData?.nodes) {
					state.currentGraphData = graphData;

					state.personRolesMap = new Map();
					if (Array.isArray(personRolesMapData)) {
						personRolesMapData.forEach(([key, roleDetails]) => {
							if (!key || !roleDetails || typeof roleDetails !== "object") return;
							state.personRolesMap.set(key, {
								allRoles: new Set(roleDetails.allRoles ?? []),
								repeatedRoles: new Set(roleDetails.repeatedRoles ?? []),
								games: Array.isArray(roleDetails.games)
									? roleDetails.games.map((gameEntry) => ({
											gameId: gameEntry.gameId,
											gameName: gameEntry.gameName,
											roles: new Set(gameEntry.roles ?? []),
										}))
									: [],
							});
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
					}

					state.d3Simulation = renderGraph(graphData);

					if (!state.d3Simulation) {
						const filterText = state.currentFilters.name.text || state.currentFilters.role.text ? " with current filters" : "";
						if (!elements.errorMessage.textContent) {
							showMessage(`D3 graph visualization failed to initialize${filterText}. Check console for details.`, "error");
						}
						setSimulationButtonState(false);
					} else {
						elements.svgContainer.classList.toggle("links-hidden", shouldHideLinks);
						if (state.isShiftPressed) {
							elements.svgContainer.classList.add("show-all-labels");
						}
						setSimulationButtonState(!state.isSimulationStoppedByUser);
					}
				} else {
					const errorMsg = message || (status === "error" ? "Worker reported an error." : "Worker returned invalid data or no nodes passed filters.");
					console.error("Main: worker reported error or invalid data:", errorMsg, event.data);
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
				console.error("Main: worker onerror event:", error);
				showMessage(`Worker failed unexpectedly. (${error.message || "Unknown error"}) Check console.`, "error");
				updateStatsUI([]);
				resetSharedStats();
				elements.loadingMessage.style.display = "none";
				setSimulationButtonState(false);
				if (state.activeWorker === worker) {
					worker.terminate();
					state.activeWorker = null;
				}
			};

			worker.onmessageerror = () => {
				if (worker !== state.activeWorker) return;
				showMessage("Worker returned a malformed message. Check console.", "error");
				updateStatsUI([]);
				resetSharedStats();
				elements.loadingMessage.style.display = "none";
				setSimulationButtonState(false);
				if (state.activeWorker === worker) {
					worker.terminate();
					state.activeWorker = null;
				}
			};

			worker.postMessage({ filenames: selectedFiles, filters });
		} catch (error) {
			console.error("Main: error setting up worker or pre-check:", error);
			showMessage(`Initialization Error: ${error.message}`, "error");
			updateStatsUI([]);
			resetSharedStats();
			elements.loadingMessage.style.display = "none";
			setSimulationButtonState(false);
			state.currentGraphData = null;
			if (state.activeWorker) {
				state.activeWorker.terminate();
				state.activeWorker = null;
			}
		}
	}

	function triggerLoad(forceReload = false) {
		const selectedFiles = collectSelectedFiles();
		const currentRawFilters = getCurrentFiltersFromUI();
		const filtersChanged = currentRawFilters.name.text !== state.currentFilters.name.text || currentRawFilters.name.mode !== state.currentFilters.name.mode || currentRawFilters.role.text !== state.currentFilters.role.text || currentRawFilters.role.mode !== state.currentFilters.role.mode;
		const selectionsChanged = !arraysEqual(selectedFiles, state.lastSelectedFiles);

		if (selectedFiles.length === 0) {
			showMessage();
			clearVisualization();
			return;
		}

		if (forceReload || selectionsChanged || filtersChanged) {
			state.lastSelectedFiles = selectedFiles.slice();
			state.currentFilters = currentRawFilters;
			if (selectionsChanged) {
				state.isSimulationStoppedByUser = false;
			}
			runWorkerAndVisualize(selectedFiles, currentRawFilters);
		}
	}

	const debouncedTriggerLoadForFilters = debounce(() => triggerLoad(false), FILTER_DEBOUNCE_MS);
	const debouncedRerender = debounce(rerenderGraph, RESIZE_DEBOUNCE_MS);

	try {
		for (let index = 0; index < INITIAL_GAME_ROWS; index++) {
			createRow();
		}
		setDefaultSelections(state.rows, gameTitleMap);
		refreshGameSelectionUI();
		updateStatsUI([]);
		resetSharedStats();
		triggerLoad(true);
	} catch (uiError) {
		console.error("Error setting up UI:", uiError);
		showMessage(`Fatal UI Setup Error: ${uiError.message}`, "error");
		elements.loadingMessage.style.display = "none";
		setSimulationButtonState(false);
		updateStatsUI([]);
		return;
	}

	elements.addGameButton.addEventListener("click", () => {
		const nextGame = getNextAvailableGame();
		if (!nextGame) {
			return;
		}
		createRow(nextGame);
		refreshGameSelectionUI();
		triggerLoad(true);
	});

	elements.nameFilterMode.addEventListener("change", () => triggerLoad(false));
	elements.roleFilterMode.addEventListener("change", () => triggerLoad(false));
	elements.nameFilterInput.addEventListener("input", debouncedTriggerLoadForFilters);
	elements.roleFilterInput.addEventListener("input", debouncedTriggerLoadForFilters);

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
