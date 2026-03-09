import { setupD3Tooltips } from "./tooltips.js";
import { NODE_TYPE_PERSON, NODE_TYPE_GAME, ROLE_COLORS, DEFAULT_ROLE, DEFAULT_ROLE_COLOR } from "./config.js";

const GAME_NODE_RADIUS = 25;
const PERSON_NODE_RADIUS = 7;
const PERSON_CLUSTER_SPACING = 18;
const SINGLE_GAME_CLUSTER_DISTANCE = 92;
const MULTI_GAME_CLUSTER_OFFSET = 24;
const GAME_LABEL_CLEARANCE = 46;

const personRoleColors = new Map();
const gameNodeColors = new Map();
const personColorScale = d3.scaleOrdinal(d3.schemeTableau10);
const personRolePie = d3
	.pie()
	.value(() => 1)
	.sort(null);

function hashString(value) {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index++) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

function deterministicOffset(id, axis, magnitude) {
	const hash = hashString(`${id}:${axis}`);
	return (hash / 0xffffffff - 0.5) * magnitude;
}

function getRoleLaneY(role, normalizedRolePositions, defaultRolePositionNorm, height) {
	const roleTargetPosNorm = normalizedRolePositions.get(role) || defaultRolePositionNorm;
	const laneTop = height * 0.24;
	const laneHeight = height * 0.64;
	return laneTop + roleTargetPosNorm.normY * laneHeight;
}

function getRoleLaneNorm(role, normalizedRolePositions, defaultRolePositionNorm) {
	return (normalizedRolePositions.get(role) || defaultRolePositionNorm).normY;
}

function getGameAnchor(index, totalGames, width, height, radiusOverride = null) {
	if (totalGames <= 1) {
		return { x: width * 0.5, y: height * 0.22 };
	}

	const centerX = width * 0.5;
	const centerY = height * 0.42;
	const radius = radiusOverride ?? Math.min(Math.min(width * 0.78, height * 0.68), Math.min(width * 0.12, height * 0.1) + Math.min(width, height) * 0.18 * Math.max(0, totalGames - 2));
	const angle = -Math.PI / 2 + (index / totalGames) * Math.PI * 2;

	return {
		x: centerX + Math.cos(angle) * radius,
		y: centerY + Math.sin(angle) * radius,
	};
}

function estimateClusterDimensions(count) {
	if (count <= 0) {
		return { width: 0, depth: 0 };
	}

	const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
	const rows = Math.max(1, Math.ceil(count / columns));
	return {
		width: Math.max(0, (columns - 1) * PERSON_CLUSTER_SPACING),
		depth: Math.max(0, (rows - 1) * PERSON_CLUSTER_SPACING * 0.9),
	};
}

function calculateGameRingRadius(graphData, width, height) {
	const gameNodes = graphData.nodes.filter((node) => node.type === NODE_TYPE_GAME);
	const personNodes = graphData.nodes.filter((node) => node.type === NODE_TYPE_PERSON);
	const totalGames = gameNodes.length;

	if (totalGames <= 1) {
		return 0;
	}

	const singleGameCounts = new Map(gameNodes.map((node) => [node.id, 0]));
	personNodes.forEach((node) => {
		if (!Array.isArray(node.gameIds) || node.gameIds.length !== 1) return;
		const gameId = node.gameIds[0];
		singleGameCounts.set(gameId, (singleGameCounts.get(gameId) ?? 0) + 1);
	});

	const largestSingleGameCluster = Math.max(0, ...singleGameCounts.values());
	const singleGameClusterFootprint = estimateClusterDimensions(largestSingleGameCluster);
	const totalPeople = personNodes.length;

	const baseRadius = Math.min(width * 0.12, height * 0.1);
	const gameCountGrowth = Math.min(width, height) * 0.18 * Math.max(0, totalGames - 2);
	const peopleGrowth = Math.sqrt(totalPeople) * PERSON_CLUSTER_SPACING * 0.55;
	const singleClusterGrowth = Math.max(singleGameClusterFootprint.width * 0.32, singleGameClusterFootprint.depth * 1.15);
	const maxRadius = Math.min(width * 0.9, height * 0.82);

	return Math.min(maxRadius, baseRadius + gameCountGrowth + peopleGrowth + singleClusterGrowth);
}

function getResolvedGamePosition(gameNode) {
	return {
		x: Number.isFinite(gameNode?.anchorX) ? gameNode.anchorX : gameNode?.x,
		y: Number.isFinite(gameNode?.anchorY) ? gameNode.anchorY : gameNode?.y,
	};
}

function getLinkedGamePositions(node, gameNodesById) {
	return (Array.isArray(node.gameIds) ? node.gameIds : [])
		.map((gameId) => gameNodesById.get(gameId))
		.filter(Boolean)
		.map(getResolvedGamePosition)
		.filter((position) => Number.isFinite(position.x) && Number.isFinite(position.y));
}

function getAllGameCenter(gameNodesById, width, height) {
	const positions = Array.from(gameNodesById.values())
		.map(getResolvedGamePosition)
		.filter((position) => Number.isFinite(position.x) && Number.isFinite(position.y));
	if (positions.length === 0) {
		return { x: width * 0.5, y: height * 0.5 };
	}
	return {
		x: positions.reduce((sum, position) => sum + position.x, 0) / positions.length,
		y: positions.reduce((sum, position) => sum + position.y, 0) / positions.length,
	};
}

function getSignatureKey(node) {
	return (Array.isArray(node.gameIds) ? [...node.gameIds] : []).sort().join("|");
}

function getClusterOffsets(count, spacing, mode = "centered") {
	const offsets = [];
	const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
	const rows = Math.max(1, Math.ceil(count / columns));
	const rowSpacing = spacing * 0.9;

	for (let index = 0; index < count; index++) {
		const row = Math.floor(index / columns);
		const column = index % columns;
		const centeredColumn = column - (columns - 1) / 2 + (row % 2 === 0 ? 0 : 0.5);
		offsets.push({
			parallel: centeredColumn * spacing,
			perpendicular: mode === "outward" ? row * rowSpacing : (row - (rows - 1) / 2) * rowSpacing,
		});
	}

	return offsets;
}

function getUnitVector(from, to, fallbackX = 1, fallbackY = 0) {
	const deltaX = to.x - from.x;
	const deltaY = to.y - from.y;
	const length = Math.hypot(deltaX, deltaY);
	if (!length) {
		return { x: fallbackX, y: fallbackY };
	}
	return { x: deltaX / length, y: deltaY / length };
}

function getClusterFrame(signatureGamePositions, allGameCenter, width, height, signatureKey) {
	if (signatureGamePositions.length === 0) {
		return {
			center: { x: width * 0.5, y: height * 0.5 },
			parallel: { x: 1, y: 0 },
			perpendicular: { x: 0, y: 1 },
		};
	}

	if (signatureGamePositions.length === 1) {
		const game = signatureGamePositions[0];
		const outward = getUnitVector(allGameCenter, game, 0, -1);
		return {
			mode: "outward",
			center: {
				x: game.x + outward.x * SINGLE_GAME_CLUSTER_DISTANCE,
				y: game.y + outward.y * SINGLE_GAME_CLUSTER_DISTANCE,
			},
			parallel: { x: -outward.y, y: outward.x },
			perpendicular: outward,
		};
	}

	const centroid = {
		x: signatureGamePositions.reduce((sum, position) => sum + position.x, 0) / signatureGamePositions.length,
		y: signatureGamePositions.reduce((sum, position) => sum + position.y, 0) / signatureGamePositions.length,
	};

	if (signatureGamePositions.length === 2) {
		const between = getUnitVector(signatureGamePositions[0], signatureGamePositions[1], 1, 0);
		const outward = getUnitVector(allGameCenter, centroid, -between.y, between.x);
		return {
			mode: "centered",
			center: {
				x: centroid.x + outward.x * MULTI_GAME_CLUSTER_OFFSET,
				y: centroid.y + outward.y * MULTI_GAME_CLUSTER_OFFSET,
			},
			parallel: { x: -between.y, y: between.x },
			perpendicular: between,
		};
	}

	const outward = getUnitVector(allGameCenter, centroid, 0, -1);
	const rotationSeed = (hashString(signatureKey) % 360) * (Math.PI / 180);
	const parallel = {
		x: Math.cos(rotationSeed) * -outward.y - Math.sin(rotationSeed) * outward.x,
		y: Math.cos(rotationSeed) * outward.x - Math.sin(rotationSeed) * outward.y,
	};
	const perpendicular = { x: -parallel.y, y: parallel.x };

	return {
		mode: "centered",
		center: {
			x: centroid.x + outward.x * MULTI_GAME_CLUSTER_OFFSET,
			y: centroid.y + outward.y * MULTI_GAME_CLUSTER_OFFSET,
		},
		parallel,
		perpendicular,
	};
}

function getNodeRoles(node, personRolesMap) {
	const roleDetails = personRolesMap.get(node.id);
	const roles = Array.from(roleDetails?.allRoles ?? []).filter(Boolean);
	if (roles.length > 0) return roles;
	return [node.primaryRole || DEFAULT_ROLE];
}

function normalizeRoleName(role) {
	return String(role || DEFAULT_ROLE)
		.toLowerCase()
		.trim();
}

function getGameColor(gameId) {
	if (!gameNodeColors.has(gameId)) {
		const hash = hashString(String(gameId || "game"));
		const hue = (((hash * 137.508) % 360) + 360) % 360;
		const saturation = 0.58 + ((hash >> 8) % 7) * 0.025;
		const lightness = 0.56 + ((hash >> 16) % 5) * 0.02;
		gameNodeColors.set(gameId, d3.hsl(hue, Math.min(saturation, 0.78), Math.min(lightness, 0.68)).formatHex());
	}
	return gameNodeColors.get(gameId);
}

function getRoleColor(role) {
	const normalizedRole = normalizeRoleName(role);
	if (ROLE_COLORS[normalizedRole]) return ROLE_COLORS[normalizedRole];
	if (!personRoleColors.has(normalizedRole)) {
		personRoleColors.set(normalizedRole, personColorScale(normalizedRole));
	}
	return personRoleColors.get(normalizedRole) || DEFAULT_ROLE_COLOR;
}

function getPersonRoleEntries(node, personRolesMap) {
	const uniqueRoles = [
		...new Set(
			getNodeRoles(node, personRolesMap)
				.map((role) => String(role || "").trim())
				.filter(Boolean)
		),
	];
	const normalizedPrimaryRole = normalizeRoleName(node.primaryRole || DEFAULT_ROLE);

	return uniqueRoles.sort((left, right) => {
		const leftIsPrimary = normalizeRoleName(left) === normalizedPrimaryRole;
		const rightIsPrimary = normalizeRoleName(right) === normalizedPrimaryRole;
		if (leftIsPrimary !== rightIsPrimary) return leftIsPrimary ? -1 : 1;
		return left.localeCompare(right);
	});
}

function getSliceStrokeStyle(sliceCount) {
	const strokeWidth = Math.max(0.2, 1.5 - Math.max(0, sliceCount - 1) * 0.12);
	const alpha = Math.max(0.18, 0.9 - Math.max(0, sliceCount - 1) * 0.06);
	return {
		stroke: `rgba(255, 255, 255, ${alpha.toFixed(3)})`,
		strokeWidth,
	};
}

function getPersonSliceData(node, personRolesMap) {
	const roles = getPersonRoleEntries(node, personRolesMap);
	const sliceStyle = getSliceStrokeStyle(roles.length);
	return personRolePie(roles).map((slice) => ({
		...slice,
		role: slice.data,
		color: getRoleColor(slice.data),
		stroke: sliceStyle.stroke,
		strokeWidth: sliceStyle.strokeWidth,
	}));
}

function buildRolePopularity(nodes, personRolesMap) {
	const rolePopularity = new Map();
	nodes.forEach((node) => {
		getNodeRoles(node, personRolesMap).forEach((role) => {
			rolePopularity.set(role, (rolePopularity.get(role) ?? 0) + 1);
		});
	});
	return rolePopularity;
}

function getLayoutRoleForNode(node, personRolesMap, rolePopularity) {
	const roles = getNodeRoles(node, personRolesMap);
	return [...roles].sort((left, right) => {
		const leftPopularity = rolePopularity.get(left) ?? 0;
		const rightPopularity = rolePopularity.get(right) ?? 0;
		if (leftPopularity !== rightPopularity) return rightPopularity - leftPopularity;
		return left.localeCompare(right);
	})[0];
}

function sortNodesForCluster(nodes, personRolesMap, normalizedRolePositions, defaultRolePositionNorm) {
	const rolePopularity = buildRolePopularity(nodes, personRolesMap);
	const roleCounts = new Map();
	nodes.forEach((node) => {
		const roleKey = getLayoutRoleForNode(node, personRolesMap, rolePopularity);
		roleCounts.set(roleKey, (roleCounts.get(roleKey) ?? 0) + 1);
	});

	return [...nodes].sort((left, right) => {
		const leftRole = getLayoutRoleForNode(left, personRolesMap, rolePopularity);
		const rightRole = getLayoutRoleForNode(right, personRolesMap, rolePopularity);
		const leftRoleCount = roleCounts.get(leftRole) ?? 0;
		const rightRoleCount = roleCounts.get(rightRole) ?? 0;

		if (leftRoleCount !== rightRoleCount) return rightRoleCount - leftRoleCount;
		if (leftRole !== rightRole) return leftRole.localeCompare(rightRole);

		const leftNorm = getRoleLaneNorm(leftRole, normalizedRolePositions, defaultRolePositionNorm);
		const rightNorm = getRoleLaneNorm(rightRole, normalizedRolePositions, defaultRolePositionNorm);
		if (leftNorm !== rightNorm) return leftNorm - rightNorm;
		return String(left.name || "").localeCompare(String(right.name || ""));
	});
}

function assignClusterPositions(clusterNodes, frame, personRolesMap, normalizedRolePositions, defaultRolePositionNorm, width, height) {
	const orderedNodes = sortNodesForCluster(clusterNodes, personRolesMap, normalizedRolePositions, defaultRolePositionNorm);
	const offsets = getClusterOffsets(orderedNodes.length, PERSON_CLUSTER_SPACING, frame.mode ?? "centered");

	let originX = frame.center.x;
	let originY = frame.center.y;
	if (frame.mode === "outward" && offsets.length > 0) {
		const minimumPerpendicular = Math.min(...offsets.map((offset) => offset.perpendicular));
		const requiredShift = GAME_NODE_RADIUS + PERSON_NODE_RADIUS + GAME_LABEL_CLEARANCE - minimumPerpendicular;
		originX += frame.perpendicular.x * requiredShift;
		originY += frame.perpendicular.y * requiredShift;
	}

	orderedNodes.forEach((node, index) => {
		const offset = offsets[index];
		node.x = originX + frame.parallel.x * offset.parallel + frame.perpendicular.x * offset.perpendicular;
		node.y = originY + frame.parallel.y * offset.parallel + frame.perpendicular.y * offset.perpendicular;
	});
}

function getNodeColor(node) {
	if (node.type === NODE_TYPE_GAME) {
		return getGameColor(node.id);
	}

	if (node.type === NODE_TYPE_PERSON) {
		return getRoleColor(node.primaryRole || DEFAULT_ROLE);
	}

	return DEFAULT_ROLE_COLOR;
}

function nodeRadius(node) {
	return node.type === NODE_TYPE_GAME ? GAME_NODE_RADIUS : PERSON_NODE_RADIUS;
}

function computeGameAnchors(graphData, gameNodes, preservedPositions, previousSize, width, height) {
	const ringRadius = calculateGameRingRadius(graphData, width, height);
	gameNodes.forEach((node, index) => {
		const preservedPosition = preservedPositions?.get(node.id);
		const anchor = getGameAnchor(index, gameNodes.length, width, height, ringRadius);
		const resolvedAnchorX = preservedPosition && previousSize?.width > 0 ? (preservedPosition.x / previousSize.width) * width : Number.isFinite(node.anchorX) ? node.anchorX : anchor.x;
		const resolvedAnchorY = preservedPosition && previousSize?.height > 0 ? (preservedPosition.y / previousSize.height) * height : Number.isFinite(node.anchorY) ? node.anchorY : anchor.y;

		node.anchorX = resolvedAnchorX;
		node.anchorY = resolvedAnchorY;
		node.x = resolvedAnchorX;
		node.y = resolvedAnchorY;
	});
}

function applyDeterministicLayout(graphData, gameNodesById, personRolesMap, normalizedRolePositions, width, height) {
	const defaultRolePositionNorm = { normX: 0.5, normY: 0.5 };
	const personNodes = graphData.nodes.filter((node) => node.type === NODE_TYPE_PERSON);
	const allGameCenter = getAllGameCenter(gameNodesById, width, height);
	const groups = new Map();

	personNodes.forEach((node) => {
		const signatureKey = getSignatureKey(node);
		if (!groups.has(signatureKey)) {
			groups.set(signatureKey, []);
		}
		groups.get(signatureKey).push(node);
	});

	groups.forEach((clusterNodes, signatureKey) => {
		const signatureGameIds = signatureKey ? signatureKey.split("|") : [];
		const signatureGamePositions = signatureGameIds
			.map((gameId) => gameNodesById.get(gameId))
			.filter(Boolean)
			.map(getResolvedGamePosition);
		const frame = getClusterFrame(signatureGamePositions, allGameCenter, width, height, signatureKey);
		assignClusterPositions(clusterNodes, frame, personRolesMap, normalizedRolePositions, defaultRolePositionNorm, width, height);
	});
}

function createLayoutController(applyLayout) {
	let running = true;

	return {
		stop() {
			running = false;
			return this;
		},
		restart() {
			running = true;
			applyLayout();
			return this;
		},
		alpha() {
			return running ? 1 : 0;
		},
		alphaMin() {
			return 0.001;
		},
		alphaTarget() {
			return this;
		},
		isRunning() {
			return running;
		},
	};
}

export function visualizeGraphD3(graphData, domElements, personRolesMap, normalizedRolePositions, onDragRestartNeeded, renderState = {}) {
	const { svgContainer, tooltipElement, errorMessageElement } = domElements;
	const baseErrorMessage = "No contributors or relevant data found for the selected games.";

	if (!graphData?.nodes?.length) {
		errorMessageElement.textContent = `${baseErrorMessage} (No nodes to display).`;
		errorMessageElement.style.display = "block";
		errorMessageElement.classList.add("error-message");
		errorMessageElement.classList.remove("warning-message");
		svgContainer.innerHTML = "";
		tooltipElement.style.display = "none";
		return null;
	}

	const personNodesExist = graphData.nodes.some((node) => node.type === NODE_TYPE_PERSON);
	if (!personNodesExist) {
		errorMessageElement.textContent = `${baseErrorMessage} (No contributors to display).`;
		errorMessageElement.style.display = "block";
		errorMessageElement.classList.add("error-message");
		errorMessageElement.classList.remove("warning-message");
		svgContainer.innerHTML = "";
		tooltipElement.style.display = "none";
		return null;
	}

	const svg = d3.select(svgContainer);
	svg.selectAll("*").remove();
	const { width, height } = svgContainer.getBoundingClientRect();
	if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
		errorMessageElement.textContent = "SVG container has invalid dimensions.";
		errorMessageElement.style.display = "block";
		errorMessageElement.classList.add("error-message");
		errorMessageElement.classList.remove("warning-message");
		return null;
	}

	personRoleColors.clear();
	gameNodeColors.clear();

	const previousSize = renderState.previousSize ?? null;
	const preservedPositions = renderState.preservedPositions ?? null;
	const nodesById = new Map(graphData.nodes.map((node) => [node.id, node]));
	const gameNodes = graphData.nodes.filter((node) => node.type === NODE_TYPE_GAME).sort((left, right) => (left.gameIndex ?? 0) - (right.gameIndex ?? 0));
	const gameNodesById = new Map(gameNodes.map((node) => [node.id, node]));

	computeGameAnchors(graphData, gameNodes, preservedPositions, previousSize, width, height);
	applyDeterministicLayout(graphData, gameNodesById, personRolesMap, normalizedRolePositions, width, height);
	graphData.links.forEach((edge) => {
		if (typeof edge.source !== "object") {
			edge.source = nodesById.get(edge.source) ?? edge.source;
		}
		if (typeof edge.target !== "object") {
			edge.target = nodesById.get(edge.target) ?? edge.target;
		}
	});

	const zoomLayer = svg.append("g").attr("class", "zoom-layer");
	const linkGroup = zoomLayer.append("g").attr("class", "links");
	const nodeGroup = zoomLayer.append("g").attr("class", "nodes");

	const link = linkGroup.selectAll("line").data(graphData.links).join("line").attr("class", "link").attr("stroke", "#999").attr("stroke-opacity", 0.6).attr("stroke-width", 1.5);

	let nodeSelection = nodeGroup
		.selectAll("g.node")
		.data(graphData.nodes, (node) => node.id)
		.join("g")
		.attr("class", (node) => `node ${node.type} ${node.category || ""}`)
		.attr("transform", (node) => `translate(${node.x},${node.y})`);

	const personArc = d3.arc().innerRadius(0);
	const personNodeSelection = nodeSelection.filter((node) => node.type === NODE_TYPE_PERSON);

	personNodeSelection
		.selectAll("path.person-slice")
		.data((node) => getPersonSliceData(node, personRolesMap))
		.join("path")
		.attr("class", "person-slice")
		.attr("d", function (slice) {
			const radius = nodeRadius(this.parentNode.__data__);
			return personArc.outerRadius(radius)(slice);
		})
		.attr("fill", (slice) => slice.color)
		.attr("stroke", (slice) => slice.stroke)
		.attr("stroke-width", (slice) => slice.strokeWidth);

	nodeSelection
		.filter((node) => node.type === NODE_TYPE_GAME)
		.append("rect")
		.attr("class", "game-rect")
		.attr("width", GAME_NODE_RADIUS * 3.5)
		.attr("height", GAME_NODE_RADIUS * 2)
		.attr("fill", (node) => getNodeColor(node))
		.attr("rx", 3)
		.attr("ry", 3)
		.attr("x", -GAME_NODE_RADIUS * 1.75)
		.attr("y", -GAME_NODE_RADIUS)
		.attr("stroke", "#fff")
		.attr("stroke-width", 1.5);

	nodeSelection
		.append("text")
		.text((node) => node.name)
		.attr("class", "node-label")
		.attr("dy", (node) => (node.type === NODE_TYPE_GAME ? 5 : nodeRadius(node) + 8))
		.attr("text-anchor", "middle");

	function updateVisualPositions() {
		link
			.attr("x1", (edge) => edge.source.x)
			.attr("y1", (edge) => edge.source.y)
			.attr("x2", (edge) => edge.target.x)
			.attr("y2", (edge) => edge.target.y);

		nodeSelection.attr("transform", (node) => `translate(${node.x},${node.y})`);
	}

	const controller = createLayoutController(() => {
		applyDeterministicLayout(graphData, gameNodesById, personRolesMap, normalizedRolePositions, width, height);
		updateVisualPositions();
	});

	function setupDrag(layoutController, dragRestartCallback) {
		function dragstarted(event, node) {
			if (node.type === NODE_TYPE_GAME && !layoutController.isRunning()) {
				dragRestartCallback?.();
				layoutController.restart();
			}
			node.dragStartX = node.x;
			node.dragStartY = node.y;
			node.wasDragged = false;
		}

		function dragged(event, node) {
			node.wasDragged = true;
			node.x = event.x;
			node.y = event.y;

			if (node.type === NODE_TYPE_GAME) {
				node.anchorX = event.x;
				node.anchorY = event.y;
				if (layoutController.isRunning()) {
					applyDeterministicLayout(graphData, gameNodesById, personRolesMap, normalizedRolePositions, width, height);
				}
			}

			updateVisualPositions();
		}

		function dragended(_event, node) {
			if (!node.wasDragged) {
				node.x = node.dragStartX;
				node.y = node.dragStartY;
				if (node.type === NODE_TYPE_GAME) {
					node.anchorX = node.dragStartX;
					node.anchorY = node.dragStartY;
				}
			}

			if (node.type === NODE_TYPE_GAME && layoutController.isRunning()) {
				applyDeterministicLayout(graphData, gameNodesById, personRolesMap, normalizedRolePositions, width, height);
			}

			node.dragStartX = null;
			node.dragStartY = null;
			node.wasDragged = false;
			updateVisualPositions();
		}

		return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
	}

	nodeSelection.call(setupDrag(controller, onDragRestartNeeded));
	updateVisualPositions();

	const zoomHandler = d3
		.zoom()
		.scaleExtent([0.1, 5])
		.on("start", () => {
			tooltipElement.style.display = "none";
			nodeSelection.classed("tooltip-active", false);
		})
		.on("zoom", (event) => {
			zoomLayer.attr("transform", event.transform);
		});

	svg.call(zoomHandler).on("dblclick.zoom", null);

	setupD3Tooltips(nodeSelection, tooltipElement, personRolesMap, svg.node(), gameNodes);

	controller.renderSize = { width, height };
	return controller;
}
