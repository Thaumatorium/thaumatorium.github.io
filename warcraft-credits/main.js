import { gameTitleMap } from "./config.js";
import { visualizeGraphD3 } from "./graphVisualizer.js";
import { populateDropdown, createHandleSelectionChange, setDefaultSelections } from "./ui.js";

const MAX_NODES_FOR_LINKS = 20000;

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
	if (missingElement) return; // Stop execution if critical elements are missing

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
		stats1: null, // <-- Add state for stats
		stats2: null, // <-- Add state for stats
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

	async function loadAndVisualizeD3(filename1, filename2) {
		console.log(`Main: Attempting D3 load via worker: ${filename1}, ${filename2}`);
		elements.errorMessage.textContent = "";
		elements.errorMessage.style.display = "none";
		elements.errorMessage.classList.remove("error-message", "warning-message");
		elements.loadingMessage.style.display = "block";
		elements.tooltip.style.display = "none";
		elements.svgContainer.classList.remove("links-hidden", "show-all-labels");
		updateStatsUI(null, null, elements); // Clear stats on new load
		state.isShiftPressed = false;
		state.isSimulationStoppedByUser = false;
		setSimulationButtonState(false); // Initially disabled until simulation starts
		if (state.activeWorker) {
			console.log("Main: Terminating previous worker.");
			state.activeWorker.terminate();
			state.activeWorker = null;
		}
		if (state.d3Simulation) {
			console.log("Main: Stopping previous simulation.");
			state.d3Simulation.stop();
			state.d3Simulation = null;
		}
		elements.svgContainer.innerHTML = ""; // Clear previous graph

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
					stats1, // <-- Get stats1
					stats2, // <-- Get stats2
					message,
				} = event.data;

				state.stats1 = stats1; // <-- Store stats in state
				state.stats2 = stats2; // <-- Store stats in state
				updateStatsUI(state.stats1, state.stats2, elements); // <-- Update UI with received stats

				if (status === "success" && graphData?.nodes) {
					console.log("Main: Worker returned success.");
					state.personRolesMap = new Map();
					if (Array.isArray(personRolesMapData)) {
						personRolesMapData.forEach(([key, rolesArray]) => {
							if (key && Array.isArray(rolesArray)) {
								state.personRolesMap.set(key, new Set(rolesArray));
							}
						});
					}
					console.log(`Main: Reconstructed personRolesMap with ${state.personRolesMap.size} entries.`);

					state.normalizedRolePositions = new Map();
					if (Array.isArray(normalizedRolePositionsData)) {
						normalizedRolePositionsData.forEach(([role, positionObject]) => {
							if (role && positionObject && typeof positionObject.normX === "number" && typeof positionObject.normY === "number") {
								state.normalizedRolePositions.set(role, positionObject);
							}
						});
					}
					console.log(`Main: Reconstructed normalizedRolePositions with ${state.normalizedRolePositions.size} entries.`);
					let shouldHideLinks = false;
					if (graphData.nodes.length > MAX_NODES_FOR_LINKS) {
						console.warn(`Node count (${graphData.nodes.length}) exceeds limit (${MAX_NODES_FOR_LINKS}). Links will be visually hidden.`);
						shouldHideLinks = true;
						elements.errorMessage.textContent = `Links visually hidden for performance (${graphData.nodes.length} nodes > ${MAX_NODES_FOR_LINKS}).`;
						elements.errorMessage.style.display = "block";
						elements.errorMessage.classList.add("warning-message");
						elements.errorMessage.classList.remove("error-message");
					}

					const visualizerDomElements = {
						svgContainer: elements.svgContainer,
						tooltipElement: elements.tooltip,
						errorMessageElement: elements.errorMessage, // Pass error element for potential use in visualizer
					};
					state.d3Simulation = visualizeGraphD3(
						graphData,
						visualizerDomElements,
						state.personRolesMap,
						state.normalizedRolePositions,
						handleDragRestart // Pass the drag restart handler
					);
					if (!state.d3Simulation) {
						console.warn("Main: visualizeGraphD3 returned null or failed.");
						if (!elements.errorMessage.textContent || !elements.errorMessage.classList.contains("warning-message")) {
							elements.errorMessage.textContent = "D3 Graph visualization failed to initialize.";
							elements.errorMessage.style.display = "block";
							elements.errorMessage.classList.add("error-message");
						}
						setSimulationButtonState(false); // Ensure buttons are in stopped state
					} else {
						console.log("Main: D3 Graph visualization initiated.");
						state.isSimulationStoppedByUser = false; // Mark as running initially
						if (shouldHideLinks) {
							elements.svgContainer.classList.add("links-hidden");
						}
						if (state.isShiftPressed) {
							// Apply shift state if held during load
							elements.svgContainer.classList.add("show-all-labels");
						}
						setSimulationButtonState(true); // Set buttons to RUNNING state
					}
				} else {
					const errorMsg = message || (status === "error" ? "Worker reported an error." : "Worker returned invalid data.");
					console.error("Main: D3 Worker reported error or invalid data:", errorMsg, event.data);
					elements.errorMessage.textContent = `Error processing data: ${errorMsg}`;
					elements.errorMessage.style.display = "block";
					elements.errorMessage.classList.add("error-message");
					elements.errorMessage.classList.remove("warning-message");
					setSimulationButtonState(false);
					state.lastFile1 = state.lastFile2 = null; // Reset selection state on error
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
				} // Ignore errors from old workers
				console.error("Main: D3 Worker onerror event:", error);
				elements.errorMessage.textContent = `D3 Worker failed unexpectedly. (${error.message || "Unknown error"})`;
				elements.errorMessage.style.display = "block";
				elements.errorMessage.classList.add("error-message");
				elements.errorMessage.classList.remove("warning-message");
				setSimulationButtonState(false);
				elements.loadingMessage.style.display = "none";
				state.lastFile1 = state.lastFile2 = null;
				updateStatsUI(null, null, elements); // Clear stats on worker error
				if (state.activeWorker === worker) {
					worker.terminate();
					state.activeWorker = null;
					console.log("Main: D3 Worker terminated after onerror.");
				}
			};
			worker.postMessage({ filename1, filename2 });
			console.log("Main: Sent job to D3 worker.");
		} catch (error) {
			console.error("Main: Error setting up D3 worker or pre-check:", error);
			elements.errorMessage.textContent = `Initialization Error: ${error.message}`;
			elements.errorMessage.style.display = "block";
			elements.errorMessage.classList.add("error-message");
			elements.errorMessage.classList.remove("warning-message");
			setSimulationButtonState(false);
			elements.loadingMessage.style.display = "none";
			updateStatsUI(null, null, elements); // Clear stats on setup error
			state.lastFile1 = null;
			state.lastFile2 = null;
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
	try {
		populateDropdown(elements.fileSelect1, gameTitleMap);
		populateDropdown(elements.fileSelect2, gameTitleMap);
		const handleSelectionChange = createHandleSelectionChange(
			elements, // Includes new stat elements
			state,
			loadAndVisualizeD3,
			updateStatsUI // Pass the update function
		);
		elements.fileSelect1.addEventListener("change", handleSelectionChange);
		elements.fileSelect2.addEventListener("change", handleSelectionChange);
		setDefaultSelections(elements, handleSelectionChange); // Elements includes stat elements now
	} catch (uiError) {
		console.error("Error setting up UI for D3:", uiError);
		elements.errorMessage.textContent = `Fatal UI Setup Error: ${uiError.message}`;
		elements.errorMessage.style.display = "block";
		elements.errorMessage.classList.add("error-message");
		elements.loadingMessage.style.display = "none";
		setSimulationButtonState(false);
		updateStatsUI(null, null, elements); // Clear stats on UI error
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
			state.d3Simulation.alpha(0.3).restart(); // Use standard alpha restart
			setSimulationButtonState(true);
		}
	});
	setSimulationButtonState(!!state.d3Simulation && !state.isSimulationStoppedByUser);
	window.addEventListener("keydown", (event) => {
		if (event.key === "Shift" && !state.isShiftPressed) {
			state.isShiftPressed = true;
			elements.svgContainer.classList.add("show-all-labels");
		}
	});
	window.addEventListener("keyup", (event) => {
		if (event.key === "Shift") {
			state.isShiftPressed = false;
			elements.svgContainer.classList.remove("show-all-labels");
		}
	});
	window.addEventListener("blur", () => {
		// Handle losing focus while shift is pressed
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
