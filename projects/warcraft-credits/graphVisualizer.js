import { setupD3Tooltips } from "./tooltips.js";
import { NODE_TYPE_PERSON, NODE_TYPE_GAME, ROLE_COLORS, DEFAULT_ROLE, DEFAULT_ROLE_COLOR, CATEGORY_GAME1_ONLY, CATEGORY_GAME2_ONLY, CATEGORY_BOTH, CATEGORY_SINGLE_GAME } from "./config.js";

const INITIAL_SIMULATION_CHARGE_STRENGTH = -120;
const INITIAL_SIMULATION_LINK_DISTANCE = 50;
const INITIAL_SIMULATION_LINK_STRENGTH = 0.8;
const INITIAL_COLLISION_PADDING = 2;
const INITIAL_COLLISION_STRENGTH = 0.7;
const INITIAL_ROLE_POSITIONING_FORCE_STRENGTH = 0.16;

const EXAMPLE_GAME_NODE_RADIUS = 25;
const EXAMPLE_PERSON_NODE_RADIUS = 7;

const dynamicRoleColors = new Map();
const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

function hashString(value) {
	let hash = 2166136261;
	for (let i = 0; i < value.length; i++) {
		hash ^= value.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

function deterministicOffset(id, axis, magnitude) {
	const hash = hashString(`${id}:${axis}`);
	return (hash / 0xffffffff - 0.5) * magnitude;
}

function getZoneX(category, width, isSingleGameView) {
	if (isSingleGameView) return width * 0.5;

	switch (category) {
		case CATEGORY_GAME1_ONLY:
		case CATEGORY_SINGLE_GAME:
			return width * 0.22;
		case CATEGORY_BOTH:
			return width * 0.5;
		case CATEGORY_GAME2_ONLY:
			return width * 0.78;
		default:
			return width * 0.5;
	}
}

function getRoleLaneY(role, normalizedRolePositions, defaultRolePositionNorm, height) {
	const roleTargetPosNorm = normalizedRolePositions.get(role) || defaultRolePositionNorm;
	const laneTop = height * 0.24;
	const laneHeight = height * 0.64;
	return laneTop + roleTargetPosNorm.normY * laneHeight;
}

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
export function visualizeGraphD3(graphData, domElements, personRolesMap, normalizedRolePositions, onDragRestartNeeded, renderState = {}) {
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
	const { width, height } = svgContainer.getBoundingClientRect();
	if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
		if (!errorMessageElement.textContent || !errorMessageElement.textContent.includes("hidden")) {
			errorMessageElement.textContent = "SVG container has invalid dimensions.";
			errorMessageElement.style.display = "block";
			errorMessageElement.classList.add("error-message");
			errorMessageElement.classList.remove("warning-message");
		}
		console.error("SVG container dimensions error:", width, height);
		return null;
	}
	dynamicRoleColors.clear();
	const previousSize = renderState.previousSize ?? null;
	const preservedPositions = renderState.preservedPositions ?? null;
	const defaultRolePositionNorm = { normX: 0.5, normY: 0.5 };
	let game1InitialPos = { x: width / 2, y: height / 2 };
	let game2InitialPos = { x: width / 2, y: height / 2 };
	graphData.nodes.forEach((d) => {
		if (d.type === NODE_TYPE_GAME) {
			d.x = isSingleGameView ? width * 0.5 : d.gameIndex === 1 ? width * 0.18 : width * 0.82;
			d.y = height * 0.1;
			if (d.gameIndex === 1) game1InitialPos = { x: d.x, y: d.y };
			if (d.gameIndex === 2 && !isSingleGameView) game2InitialPos = { x: d.x, y: d.y };
			else if (d.gameIndex === 2 && isSingleGameView) game2InitialPos = game1InitialPos;
		}
		d.fx = null;
		d.fy = null;
	});
	graphData.nodes.forEach((d) => {
		const preservedPosition = preservedPositions?.get(d.id);
		if (d.type === NODE_TYPE_PERSON) {
			const role = d.primaryRole || DEFAULT_ROLE;
			const targetX = getZoneX(d.category, width, isSingleGameView);
			const targetY = getRoleLaneY(role, normalizedRolePositions, defaultRolePositionNorm, height);

			if (preservedPosition && previousSize?.width > 0 && previousSize?.height > 0) {
				d.x = (preservedPosition.x / previousSize.width) * width;
				d.y = (preservedPosition.y / previousSize.height) * height;
			} else {
				d.x = targetX + deterministicOffset(d.id, "x", width * 0.05);
				d.y = targetY + deterministicOffset(d.id, "y", 18);
			}
		} else if (d.type !== NODE_TYPE_GAME) {
			if (preservedPosition && previousSize?.width > 0 && previousSize?.height > 0) {
				d.x = (preservedPosition.x / previousSize.width) * width;
				d.y = (preservedPosition.y / previousSize.height) * height;
			} else {
				d.x = d.x || width / 2 + deterministicOffset(d.id, "x", 50);
				d.y = d.y || height / 2 + deterministicOffset(d.id, "y", 50);
			}
		}
		d.fx = null;
		d.fy = null;
	});

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
		.strength((d) => (d.type === NODE_TYPE_PERSON ? INITIAL_ROLE_POSITIONING_FORCE_STRENGTH : 0.18))
		.x((d) => {
			if (d.type === NODE_TYPE_PERSON) {
				return getZoneX(d.category, width, isSingleGameView);
			}
			return d.gameIndex === 1 || isSingleGameView ? game1InitialPos.x : game2InitialPos.x;
		});

	const forceY = d3
		.forceY()
		.strength((d) => (d.type === NODE_TYPE_PERSON ? INITIAL_ROLE_POSITIONING_FORCE_STRENGTH : 0.12))
		.y((d) => {
			if (d.type === NODE_TYPE_PERSON) {
				const role = d.primaryRole || DEFAULT_ROLE;
				return getRoleLaneY(role, normalizedRolePositions, defaultRolePositionNorm, height);
			}
			return game1InitialPos.y;
		});
	const simulation = d3.forceSimulation(graphData.nodes).force("link", linkForce).force("charge", chargeForce).force("center", centerForce).force("collision", collisionForce).force("x", forceX).force("y", forceY).alpha(1).alphaDecay(0.0228).alphaMin(0.001).on("tick", ticked);

	const link = linkGroup.selectAll("line").data(graphData.links).join("line").attr("class", "link").attr("stroke", "#999").attr("stroke-opacity", 0.6).attr("stroke-width", 1.5);

	let nodeSelection = nodeGroup
		.selectAll("g.node")
		.data(graphData.nodes, (d) => d.id)
		.join("g")
		.attr("class", (d) => `node ${d.type} ${d.category || ""}`)
		.attr("transform", (d) => `translate(${d.x},${d.y})`)
		.call(setupDrag(simulation, onDragRestartNeeded));

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
		link
			.attr("x1", (d) => d.source.x)
			.attr("y1", (d) => d.source.y)
			.attr("x2", (d) => d.target.x)
			.attr("y2", (d) => d.target.y);

		nodeSelection.attr("transform", (d) => `translate(${d.x},${d.y})`);
	}

	function setupDrag(sim, dragRestartCallback) {
		function dragstarted(event, d) {
			if (!event.active) {
				const needsRestart = sim.alpha() < sim.alphaMin();

				if (needsRestart && dragRestartCallback) {
					dragRestartCallback();
				}

				sim.alphaTarget(0.3).restart();
			}
			d.fx = event.x;
			d.fy = event.y;
		}

		function dragged(event, d) {
			d.fx = event.x;
			d.fy = event.y;
		}

		function dragended(event, d) {
			if (!event.active) {
				sim.alphaTarget(0);
			}
			d.fx = null;
			d.fy = null;
		}

		return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
	}

	const zoomHandler = d3
		.zoom()
		.scaleExtent([0.1, 5])
		.on("start", () => {
			tooltipElement.style.display = "none";
			if (nodeSelection) nodeSelection.classed("tooltip-active", false);
		})
		.on("zoom", (event) => {
			zoomLayer.attr("transform", event.transform);
		});

	svg.call(zoomHandler).on("dblclick.zoom", null);

	setupD3Tooltips(nodeSelection, tooltipElement, personRolesMap, svg.node(), game1Name, game2Name, isSingleGameView);

	simulation.renderSize = { width, height };
	return simulation;
}
