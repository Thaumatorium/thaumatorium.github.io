import { setupD3Tooltips } from "./tooltips.js";
import { NODE_TYPE_PERSON, NODE_TYPE_GAME, ROLE_COLORS, DEFAULT_ROLE, DEFAULT_ROLE_COLOR, CATEGORY_GAME1_ONLY, CATEGORY_GAME2_ONLY, CATEGORY_BOTH, CATEGORY_SINGLE_GAME } from "./config.js";

const INITIAL_SIMULATION_CHARGE_STRENGTH = -120;
const INITIAL_SIMULATION_LINK_DISTANCE = 50;
const INITIAL_SIMULATION_LINK_STRENGTH = 0.8;
const INITIAL_COLLISION_PADDING = 2;
const INITIAL_COLLISION_STRENGTH = 0.7;
const INITIAL_ROLE_POSITIONING_FORCE_STRENGTH = 0.1;

const EXAMPLE_GAME_NODE_RADIUS = 25;
const EXAMPLE_PERSON_NODE_RADIUS = 7;

const dynamicRoleColors = new Map();
const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

/**
 * Determines the fill color for a node.
 * @param {object} d - The node data object.
 * @param {Array} allGameNodes - Array containing the game node objects for comparison.
 * @returns {string} A hex color code.
 */
function getNodeColor(d, allGameNodes) {
	if (d.type === NODE_TYPE_GAME) {
		const gameNode1 = allGameNodes.find((n) => n.gameIndex === 1);
		const isDifferentGame2 = allGameNodes.length > 1 && d.gameIndex === 2 && d.id !== gameNode1?.id;
		return isDifferentGame2 ? "#2980b9" : "#3498db";
	}
	if (d.type === NODE_TYPE_PERSON) {
		const role = d.primaryRole || DEFAULT_ROLE;
		const normalizedRole = role.toLowerCase().trim();
		if (ROLE_COLORS[normalizedRole]) return ROLE_COLORS[normalizedRole];
		if (dynamicRoleColors.has(normalizedRole)) return dynamicRoleColors.get(normalizedRole);
		if (normalizedRole && normalizedRole !== DEFAULT_ROLE.toLowerCase().trim()) {
			const newColor = colorScale(normalizedRole);
			dynamicRoleColors.set(normalizedRole, newColor);
			return newColor;
		}
		return DEFAULT_ROLE_COLOR;
	}
	return DEFAULT_ROLE_COLOR;
}

/**
 * Determines the radius for a node based on its type, using fixed sizes.
 * @param {object} d - Node data.
 * @returns {number} Radius value.
 */
function nodeRadius(d) {
	return d.type === NODE_TYPE_GAME ? EXAMPLE_GAME_NODE_RADIUS : EXAMPLE_PERSON_NODE_RADIUS;
}

/**
 * Initializes and renders the graph using D3.js force simulation.
 * Sets initial node positions based on roles AND game contribution category.
 * Uses forceX/forceY with pre-calculated positions to group person nodes by primary role.
 * REMOVED node position constraints within SVG bounds.
 *
 * @param {{nodes: Array, links: Array}} graphData - Object containing nodes and links arrays.
 * @param {Object} domElements - Object containing { svgContainer, tooltipElement, errorMessageElement }.
 * @param {Map<string, Set<string>>} personRolesMap - Map of person ID to their Set of roles.
 * @param {Map<string, {normX: number, normY: number}>} normalizedRolePositions - Map of role name to normalized target coordinates.
 * @param {Function} [onDragRestartNeeded] - Optional callback function executed when a drag restarts a user-stopped simulation.
 * @returns {d3.Simulation | null} The initialized D3 simulation instance, or null on failure.
 */
export function visualizeGraphD3(
	graphData,
	domElements,
	personRolesMap,
	normalizedRolePositions,
	onDragRestartNeeded // <-- Add callback parameter
) {
	const { svgContainer, tooltipElement, errorMessageElement } = domElements;
	const baseErrorMessage = "No common contributors or relevant data found for the selected combination.";
	if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
		if (!errorMessageElement.textContent || !errorMessageElement.textContent.includes("hidden")) {
			errorMessageElement.textContent = baseErrorMessage + " (No nodes to display).";
			errorMessageElement.style.display = "block";
			errorMessageElement.classList.add("error-message");
			errorMessageElement.classList.remove("warning-message");
		}
		svgContainer.innerHTML = "";
		tooltipElement.style.display = "none";
		return null;
	}
	const personNodesExist = graphData.nodes.some((n) => n.type === NODE_TYPE_PERSON);
	if (!personNodesExist) {
		if (!errorMessageElement.textContent || !errorMessageElement.textContent.includes("hidden")) {
			errorMessageElement.textContent = baseErrorMessage + " (No contributors to display).";
			errorMessageElement.style.display = "block";
			errorMessageElement.classList.add("error-message");
			errorMessageElement.classList.remove("warning-message");
		}
		svgContainer.innerHTML = "";
		tooltipElement.style.display = "none";
		return null;
	}
	let game1Name = null,
		game2Name = null;
	const allGameNodes = graphData.nodes.filter((n) => n.type === NODE_TYPE_GAME);
	const gameNode1 = allGameNodes.find((n) => n.gameIndex === 1);
	const gameNode2 = allGameNodes.find((n) => n.gameIndex === 2);
	if (gameNode1) game1Name = gameNode1.name;
	if (gameNode2) game2Name = gameNode2.name;
	const isSingleGameView = !gameNode2 || (gameNode1 && gameNode2 && gameNode1.id === gameNode2.id);
	if (isSingleGameView && game1Name && !game2Name) game2Name = game1Name;

	const svg = d3.select(svgContainer);
	svg.selectAll("*").remove();
	const width = parseInt(svg.style("width"), 10);
	const height = parseInt(svg.style("height"), 10);
	if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
		if (!errorMessageElement.textContent || !errorMessageElement.textContent.includes("hidden")) {
			errorMessageElement.textContent = "SVG container has invalid dimensions.";
			errorMessageElement.style.display = "block";
			errorMessageElement.classList.add("error-message");
			errorMessageElement.classList.remove("warning-message");
		}
		console.error("SVG container dimensions error:", svg.style("width"), svg.style("height"));
		return null;
	}
	dynamicRoleColors.clear();
	const defaultRolePositionNorm = { normX: 0.5, normY: 0.5 };
	let game1InitialPos = { x: width / 2, y: height / 2 };
	let game2InitialPos = { x: width / 2, y: height / 2 };
	const interpolationWeight = 0.2;
	const bothInterpolationWeight = 0.1;
	graphData.nodes.forEach((d) => {
		if (d.type === NODE_TYPE_GAME) {
			const xOffset = !isSingleGameView ? (d.gameIndex === 1 ? -width * 0.15 : width * 0.15) : 0;
			d.x = width / 2 + xOffset;
			d.y = height / 2 - height * 0.25;
			if (d.gameIndex === 1) game1InitialPos = { x: d.x, y: d.y };
			if (d.gameIndex === 2 && !isSingleGameView) game2InitialPos = { x: d.x, y: d.y };
			else if (d.gameIndex === 2 && isSingleGameView) game2InitialPos = game1InitialPos;
		}
		d.fx = null;
		d.fy = null;
	});
	graphData.nodes.forEach((d) => {
		if (d.type === NODE_TYPE_PERSON) {
			const role = d.primaryRole || DEFAULT_ROLE;
			const roleTargetPosNorm = normalizedRolePositions.get(role) || defaultRolePositionNorm;
			const roleTargetX = roleTargetPosNorm.normX * width;
			const roleTargetY = roleTargetPosNorm.normY * height;

			let targetX = roleTargetX;
			let targetY = roleTargetY;
			switch (d.category) {
				case CATEGORY_SINGLE_GAME:
				case CATEGORY_GAME1_ONLY:
					targetX = roleTargetX * (1 - interpolationWeight) + game1InitialPos.x * interpolationWeight;
					targetY = roleTargetY * (1 - interpolationWeight) + game1InitialPos.y * interpolationWeight;
					break;
				case CATEGORY_GAME2_ONLY:
					if (!isSingleGameView) {
						targetX = roleTargetX * (1 - interpolationWeight) + game2InitialPos.x * interpolationWeight;
						targetY = roleTargetY * (1 - interpolationWeight) + game2InitialPos.y * interpolationWeight;
					}
					break;
				case CATEGORY_BOTH:
					if (!isSingleGameView) {
						const midGameX = (game1InitialPos.x + game2InitialPos.x) / 2;
						const midGameY = (game1InitialPos.y + game2InitialPos.y) / 2;
						targetX = roleTargetX * (1 - bothInterpolationWeight) + midGameX * bothInterpolationWeight;
						targetY = roleTargetY * (1 - bothInterpolationWeight) + midGameY * bothInterpolationWeight;
					}
					break;
				// Default case removed, initial roleTargetX/Y handles other cases
			}

			d.x = targetX + (Math.random() - 0.5) * 2;
			d.y = targetY + (Math.random() - 0.5) * 2;
		} else if (d.type !== NODE_TYPE_GAME) {
			d.x = d.x || width / 2 + (Math.random() - 0.5) * 50;
			d.y = d.y || height / 2 + (Math.random() - 0.5) * 50;
		}
		d.fx = null;
		d.fy = null;
	});
	console.log("Set initial node positions based on roles and game category.");

	const zoomLayer = svg.append("g").attr("class", "zoom-layer");
	const linkGroup = zoomLayer.append("g").attr("class", "links");
	const nodeGroup = zoomLayer.append("g").attr("class", "nodes");
	const collisionForce = d3
		.forceCollide()
		.radius((d) => nodeRadius(d) + INITIAL_COLLISION_PADDING)
		.strength(INITIAL_COLLISION_STRENGTH);

	const linkForce = d3
		.forceLink(graphData.links)
		.id((d) => d.id)
		.distance(INITIAL_SIMULATION_LINK_DISTANCE)
		.strength(INITIAL_SIMULATION_LINK_STRENGTH);

	const chargeForce = d3.forceManyBody().strength(INITIAL_SIMULATION_CHARGE_STRENGTH);

	const centerForce = d3.forceCenter(width / 2, height / 2).strength(0.05);
	const forceX = d3
		.forceX()
		.strength((d) => (d.type === NODE_TYPE_PERSON ? INITIAL_ROLE_POSITIONING_FORCE_STRENGTH : 0.01))
		.x((d) => {
			if (d.type === NODE_TYPE_PERSON) {
				const role = d.primaryRole || DEFAULT_ROLE;
				const normX = (normalizedRolePositions.get(role) || defaultRolePositionNorm).normX;
				return normX * width;
			}
			return width / 2;
		});

	const forceY = d3
		.forceY()
		.strength((d) => (d.type === NODE_TYPE_PERSON ? INITIAL_ROLE_POSITIONING_FORCE_STRENGTH : 0.01))
		.y((d) => {
			if (d.type === NODE_TYPE_PERSON) {
				const role = d.primaryRole || DEFAULT_ROLE;
				const normY = (normalizedRolePositions.get(role) || defaultRolePositionNorm).normY;
				return normY * height;
			}
			return height / 2;
		});
	const simulation = d3.forceSimulation(graphData.nodes).force("link", linkForce).force("charge", chargeForce).force("center", centerForce).force("collision", collisionForce).force("x", forceX).force("y", forceY).alpha(1).alphaDecay(0.0228).alphaMin(0.001).on("tick", ticked);

	const link = linkGroup.selectAll("line").data(graphData.links).join("line").attr("class", "link").attr("stroke", "#999").attr("stroke-opacity", 0.6).attr("stroke-width", 1.5);

	let nodeSelection = nodeGroup
		.selectAll("g.node")
		.data(graphData.nodes, (d) => d.id)
		.join("g")
		.attr("class", (d) => `node ${d.type} ${d.category || ""}`)
		.attr("transform", (d) => `translate(${d.x},${d.y})`)
		// --- Pass the callback to setupDrag ---
		.call(setupDrag(simulation, onDragRestartNeeded)); // <-- Pass callback here

	nodeSelection
		.filter((d) => d.type === NODE_TYPE_PERSON)
		.append("circle")
		.attr("r", (d) => nodeRadius(d))
		.attr("fill", (d) => getNodeColor(d, allGameNodes))
		.attr("stroke", "#fff")
		.attr("stroke-width", 1.5);

	nodeSelection
		.filter((d) => d.type === NODE_TYPE_GAME)
		.append("rect")
		.attr("class", "game-rect")
		.attr("width", EXAMPLE_GAME_NODE_RADIUS * 3.5)
		.attr("height", EXAMPLE_GAME_NODE_RADIUS * 2)
		.attr("fill", (d) => getNodeColor(d, allGameNodes))
		.attr("rx", 3)
		.attr("ry", 3)
		.attr("x", -EXAMPLE_GAME_NODE_RADIUS * 1.75)
		.attr("y", -EXAMPLE_GAME_NODE_RADIUS * 1)
		.attr("stroke", "#fff")
		.attr("stroke-width", 1.5);

	nodeSelection
		.append("text")
		.text((d) => d.name)
		.attr("class", "node-label")
		.attr("dy", (d) => (d.type === NODE_TYPE_GAME ? 5 : nodeRadius(d) + 8))
		.attr("text-anchor", "middle");

	function ticked() {
		link.attr("x1", (d) => d.source.x)
			.attr("y1", (d) => d.source.y)
			.attr("x2", (d) => d.target.x)
			.attr("y2", (d) => d.target.y);

		nodeSelection.attr("transform", (d) => `translate(${d.x},${d.y})`);
	}

	// --- Modify setupDrag to accept and use the callback ---
	function setupDrag(sim, dragRestartCallback) {
		// <-- Add callback param
		function dragstarted(event, d) {
			// Check if simulation is not active (i.e., alpha is low/zero)
			if (!event.active) {
				// Determine if the simulation needs restarting *and* if the callback should be triggered
				const needsRestart = sim.alpha() < sim.alphaMin(); // More robust check

				if (needsRestart && dragRestartCallback) {
					// Call the callback *before* restarting simulation state is updated
					dragRestartCallback();
				}

				// Always try to restart/heat up the simulation on drag start if it's not active
				sim.alphaTarget(0.3).restart();
			}
			// Fix the node's position during drag
			d.fx = event.x;
			d.fy = event.y;
		}

		function dragged(event, d) {
			// Update the fixed position as the node is dragged
			d.fx = event.x;
			d.fy = event.y;
		}

		function dragended(event, d) {
			// If the simulation wasn't activated by other means during the drag,
			// set the alphaTarget to 0 to let it cool down naturally.
			if (!event.active) {
				sim.alphaTarget(0);
			}
			// Release the node's fixed position so the simulation can move it again.
			d.fx = null;
			d.fy = null;
		}

		return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
	}

	const zoomHandler = d3
		.zoom()
		.scaleExtent([0.1, 5])
		.on("zoom", (event) => {
			zoomLayer.attr("transform", event.transform);
			tooltipElement.style.display = "none";
			if (nodeSelection) {
				nodeSelection.classed("tooltip-active", false).classed("highlighted-department", false);
			}
			if (nodeGroup) nodeGroup.classed("department-highlight-active", false);
		});

	svg.call(zoomHandler).on("dblclick.zoom", null);

	setupD3Tooltips(nodeSelection, tooltipElement, personRolesMap, svg.node(), game1Name, game2Name, isSingleGameView);

	console.log("D3 visualization setup complete. Simulation started.");
	return simulation;
}
