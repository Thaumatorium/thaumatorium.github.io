import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const phaseMeta = {
	early: { label: "Early Game", x: 0.14 },
	mid: { label: "Mid Game", x: 0.38 },
	late: { label: "Late Game", x: 0.64 },
	endgame: { label: "Endgame", x: 0.86 },
};

const groupMeta = {
	level: { label: "Leveling", color: "#7ccfff" },
	econ: { label: "Economy", color: "#ffd166" },
	social: { label: "Social/Raid", color: "#c792ea" },
	explore: { label: "Exploration", color: "#7bd88f" },
};

const nodes = [
	{ id: "E", name: "Explore", group: "explore", phase: "early", desc: "Learn the world, routes, zones, and where things are." },
	{ id: "Q", name: "Quest", group: "level", phase: "early", desc: "Take directed objectives that push progression forward." },
	{ id: "C", name: "Fight", group: "level", phase: "early", desc: "Kill things, learn your class, and survive the world." },
	{ id: "XP", name: "Level", group: "level", phase: "mid", desc: "Gain levels, talents, and access to stronger content." },
	{ id: "G", name: "Earn Gold", group: "econ", phase: "mid", desc: "Build up liquid resources for skills, travel, and upkeep." },
	{ id: "P", name: "Craft", group: "econ", phase: "mid", desc: "Gather and craft to support your character or make money." },
	{ id: "L", name: "Gear", group: "level", phase: "late", desc: "Convert time and success into stronger equipment." },
	{ id: "S", name: "Group Up", group: "social", phase: "late", desc: "Join guilds, form groups, and coordinate progression." },
	{ id: "R", name: "Raid", group: "social", phase: "endgame", desc: "Tackle structured cooperative endgame for prestige and rewards." },
	{ id: "D", name: "Dungeon", group: "social", phase: "endgame", desc: "Engage in challenging group content for rewards and progression." },
];

const links = [
	{ source: "E", target: "Q", type: "primary", note: "Exploration exposes new quest hubs." },
	{ source: "Q", target: "C", type: "intra-phase", note: "Quests repeatedly send you into combat inside early game." },
	{ source: "C", target: "XP", type: "primary", note: "Combat and completion push leveling." },
	{ source: "XP", target: "G", type: "primary", note: "Progression improves earning power and content access." },
	{ source: "G", target: "P", type: "intra-phase", note: "Gold funds the economy loop and profession growth inside mid game." },
	{ source: "P", target: "L", type: "primary", note: "Crafting and the market help convert wealth into gear." },
	{ source: "L", target: "S", type: "intra-phase", note: "Power growth makes coordinated group content realistic inside late game." },
	{ source: "L", target: "D", type: "intra-phase", note: "Power growth makes dungeon content realistic inside late game." },
	{ source: "S", target: "R", type: "primary", note: "Stable groups unlock raid progression." },

	{ source: "E", target: "P", type: "support", note: "Exploration also reveals resource routes." },
	{ source: "E", target: "C", type: "intra-phase", note: "Wandering the world often drops you into fights before anything else." },
	{ source: "Q", target: "G", type: "support", note: "Questing is an early gold source." },
	{ source: "XP", target: "Q", type: "support", note: "Leveling unlocks more quests and zones." },
	{ source: "XP", target: "P", type: "intra-phase", note: "Mid-game progression often branches into professions and side economies." },
	{ source: "G", target: "L", type: "support", note: "Gold helps turn progression into better gear." },
	{ source: "L", target: "C", type: "support", note: "Better gear loops back into easier combat." },
	{ source: "L", target: "S", type: "intra-phase", note: "Late-game gearing and grouping reinforce each other." },
	{ source: "R", target: "L", type: "support", note: "Raids feed back into the gearing ladder." },
	{ source: "R", target: "S", type: "support", note: "Raiding strengthens social structures that sustain endgame." },

	{ source: "L", target: "G", type: "cost", note: "Repairs and upgrades drain gold." },
	{ source: "R", target: "G", type: "cost", note: "Raid prep and consumables create recurring costs." },
	{ source: "D", target: "G", type: "cost", note: "Raid prep and consumables create recurring costs." },
	{ source: "R", target: "S", type: "friction", note: "Scheduling and coordination strain groups over time." },
];

const presetMeta = {
	early: { label: "Early game", nodes: new Set(["E", "Q", "C"]) },
	mid: { label: "Mid game", nodes: new Set(["XP", "G", "P"]) },
	late: { label: "Late game", nodes: new Set(["L", "S"]) },
	endgame: { label: "Endgame", nodes: new Set(["R", "S", "L"]) },
};

const chart = document.getElementById("warcraft-loop-chart");
const tooltip = document.getElementById("warcraft-loop-tooltip");
const legend = document.getElementById("warcraft-loop-legend");
const edgeLegend = document.getElementById("warcraft-loop-edge-legend");
const presets = document.getElementById("warcraft-loop-presets");
const fitButton = document.getElementById("warcraft-loop-fit");
const resetButton = document.getElementById("warcraft-loop-reset");

if (!chart || !tooltip || !legend || !edgeLegend || !presets || !fitButton || !resetButton) {
	throw new Error("Warcraft game chain: required DOM nodes are missing.");
}

const color = d3
	.scaleOrdinal()
	.domain(Object.keys(groupMeta))
	.range(Object.values(groupMeta).map((entry) => entry.color));

const nodeData = nodes.map((datum) => ({ ...datum }));
const nodeById = new Map(nodeData.map((datum) => [datum.id, datum]));
const linkData = links.map((datum) => ({
	...datum,
	source: nodeById.get(datum.source),
	target: nodeById.get(datum.target),
}));

const svg = d3.select(chart).append("svg").style("display", "block").style("width", "100%").style("height", "100%");
const root = svg.append("g");
const defs = svg.append("defs");
const NODE_RADIUS = 22;

defs.append("marker").attr("id", "warcraft-loop-arrow").attr("viewBox", "0 -5 10 10").attr("refX", 8).attr("refY", 0).attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto").append("path").attr("d", "M0,-5L10,0L0,5").attr("fill", "#800");

const linkLayer = root.append("g");
const nodeLayer = root.append("g");
const edgeLegendMeta = [
	{ type: "primary", label: "Primary path", color: "#111", dasharray: "", width: 3.2 },
	{ type: "intra-phase", label: "Intra-phase", color: "#2f5d50", dasharray: "7 5", width: 2.2 },
	{ type: "support", label: "Support", color: "#5b6b7f", dasharray: "2 4", width: 2.2 },
	{ type: "cost", label: "Cost", color: "#ff8f6b", dasharray: "8 6", width: 2.2 },
	{ type: "friction", label: "Friction", color: "#f0c674", dasharray: "3 6", width: 2.2 },
];

let activeGroup = null;
let activeNodeId = null;
let activePreset = null;
let activeReachableNodes = null;
let activeReachableLinks = null;
let width = 0;
let height = 0;
let simulation = null;

const zoom = d3
	.zoom()
	.scaleExtent([0.55, 2.5])
	.on("zoom", (event) => root.attr("transform", event.transform));
svg.call(zoom);

function renderLegend() {
	legend.replaceChildren(
		...Object.entries(groupMeta).map(([group, meta]) => {
			const button = document.createElement("button");
			button.type = "button";
			button.className = "warcraft-loop-chip";
			if (activeGroup === group) button.classList.add("is-active");
			if (activeGroup && activeGroup !== group) button.classList.add("is-dimmed");
			button.innerHTML = `<span class="warcraft-loop-dot" style="background:${meta.color}"></span>${meta.label}`;
			button.addEventListener("click", () => {
				activePreset = null;
				activeNodeId = null;
				activeReachableNodes = null;
				activeReachableLinks = null;
				activeGroup = activeGroup === group ? null : group;
				updateHighlighting();
				renderLegend();
				renderPresets();
			});
			return button;
		})
	);
}

function renderPresets() {
	presets.replaceChildren(
		...Object.entries(presetMeta).map(([presetId, meta]) => {
			const button = document.createElement("button");
			button.type = "button";
			button.className = "warcraft-loop-chip";
			if (activePreset === presetId) button.classList.add("is-active");
			if (activePreset && activePreset !== presetId) button.classList.add("is-dimmed");
			button.textContent = meta.label;
			button.addEventListener("click", () => {
				activeGroup = null;
				activeNodeId = null;
				activeReachableNodes = null;
				activeReachableLinks = null;
				activePreset = activePreset === presetId ? null : presetId;
				updateHighlighting();
				renderLegend();
				renderPresets();
			});
			return button;
		})
	);
}

function renderEdgeLegend() {
	edgeLegend.replaceChildren(
		...edgeLegendMeta.map((entry) => {
			const item = document.createElement("div");
			item.className = "warcraft-loop-edge-key";
			item.innerHTML = `
			<svg class="warcraft-loop-edge-swatch" viewBox="0 0 44 12" aria-hidden="true">
				<path d="M1,6 Q20,1 35,6" fill="none" stroke="${entry.color}" stroke-width="${entry.width}" stroke-dasharray="${entry.dasharray}"></path>
				<path d="M34,3 L42,6 L34,9" fill="none" stroke="${entry.color}" stroke-width="${entry.width}" stroke-linecap="round" stroke-linejoin="round"></path>
			</svg>
			<span>${entry.label}</span>
		`;
			return item;
		})
	);
}

function showTooltip(html, x, y) {
	tooltip.innerHTML = html;
	tooltip.style.display = "block";
	tooltip.setAttribute("aria-hidden", "false");
	const rect = chart.getBoundingClientRect();
	tooltip.style.left = `${Math.min(x - rect.left + 14, rect.width - 280)}px`;
	tooltip.style.top = `${Math.min(y - rect.top + 14, rect.height - 120)}px`;
}

function hideTooltip() {
	tooltip.style.display = "none";
	tooltip.setAttribute("aria-hidden", "true");
}

function drag(sim) {
	function dragstarted(event, datum) {
		if (!event.active) sim.alphaTarget(0.2).restart();
		datum.fx = datum.x;
		datum.fy = datum.y;
	}

	function dragged(event, datum) {
		datum.fx = event.x;
		datum.fy = event.y;
	}

	function dragended(event, datum) {
		if (!event.active) sim.alphaTarget(0);
	}

	return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
}

function computeOutgoingReachability(startId) {
	const reachableNodes = new Set([startId]);
	const reachableLinks = new Set();
	for (const linkDatum of linkSelection.data()) {
		if (linkDatum.source.id !== startId) continue;
		reachableNodes.add(linkDatum.target.id);
		reachableLinks.add(`${linkDatum.source.id}->${linkDatum.target.id}`);
	}
	return { reachableNodes, reachableLinks };
}

function isNodeHighlighted(nodeDatum) {
	if (activePreset) {
		return presetMeta[activePreset].nodes.has(nodeDatum.id);
	}
	if (activeNodeId) {
		return activeReachableNodes?.has(nodeDatum.id) ?? false;
	}
	if (activeGroup) {
		return nodeDatum.group === activeGroup;
	}
	return true;
}

function isLinkHighlighted(linkDatum) {
	if (activePreset) {
		const nodesInPreset = presetMeta[activePreset].nodes;
		return nodesInPreset.has(linkDatum.source.id) && nodesInPreset.has(linkDatum.target.id);
	}
	if (activeNodeId) {
		return activeReachableLinks?.has(`${linkDatum.source.id}->${linkDatum.target.id}`) ?? false;
	}
	if (activeGroup) {
		return linkDatum.source.group === activeGroup || linkDatum.target.group === activeGroup;
	}
	return true;
}

function updateHighlighting() {
	linkSelection
		.attr("stroke-opacity", (datum) => (isLinkHighlighted(datum) ? 0.95 : 0.12))
		.attr("stroke", (datum) => {
			if (datum.type === "cost" && isLinkHighlighted(datum)) return "#d40000";
			if (datum.type === "friction" && isLinkHighlighted(datum)) return "#cda9a9";
			if (datum.type === "intra-phase" && isLinkHighlighted(datum)) return "#6e0000";
			if (datum.type === "support" && isLinkHighlighted(datum)) return "#b98f8f";
			if (activeGroup && isLinkHighlighted(datum)) return color(activeGroup);
			if (activeNodeId && isLinkHighlighted(datum)) return "#800";
			return datum.type === "primary" ? "#800" : datum.type === "intra-phase" ? "#6e0000" : "#b98f8f";
		})
		.attr("stroke-width", (datum) => (datum.type === "primary" ? 2.8 : datum.type === "intra-phase" ? 2.2 : 2))
		.attr("stroke-dasharray", (datum) => {
			if (datum.type === "cost") return "8 6";
			if (datum.type === "friction") return "3 6";
			if (datum.type === "intra-phase") return "7 5";
			if (datum.type === "support") return "2 4";
			return null;
		});

	nodeSelection.attr("opacity", (datum) => (isNodeHighlighted(datum) ? 1 : 0.2));
}

function fitGraph() {
	const bounds = root.node()?.getBBox();
	if (!bounds || !bounds.width || !bounds.height) return;
	const scale = 0.92 / Math.max(bounds.width / width, bounds.height / height);
	const transform = d3.zoomIdentity
		.translate(width / 2, height / 2)
		.scale(scale)
		.translate(-(bounds.x + bounds.width / 2), -(bounds.y + bounds.height / 2));
	svg.transition().duration(400).call(zoom.transform, transform);
}

function linkPath(datum) {
	const source = datum.source;
	const target = datum.target;
	const dx = target.x - source.x;
	const dy = target.y - source.y;
	const direction = source.phase === target.phase ? (source.id < target.id ? 1 : -1) : source.phase < target.phase ? 1 : -1;
	const strength = datum.type === "primary" ? 0.08 : datum.type === "intra-phase" ? 0.2 : datum.type === "support" ? 0.16 : 0.22;
	const controlX = (source.x + target.x) / 2;
	const controlY = (source.y + target.y) / 2 + dx * strength * direction;
	const tangentX = target.x - controlX;
	const tangentY = target.y - controlY;
	const tangentLength = Math.hypot(tangentX, tangentY) || 1;
	const inset = NODE_RADIUS + 5;
	const endX = target.x - (tangentX / tangentLength) * inset;
	const endY = target.y - (tangentY / tangentLength) * inset;
	return `M${source.x},${source.y}Q${controlX},${controlY} ${endX},${endY}`;
}

function positionNodes() {
	const rowsByPhase = {
		early: [0.25, 0.5, 0.75],
		mid: [0.32, 0.56, 0.8],
		late: [0.38, 0.68],
		endgame: [0.5],
	};
	const phaseCounts = { early: 0, mid: 0, late: 0, endgame: 0 };
	nodeSelection.data().forEach((datum) => {
		const rowList = rowsByPhase[datum.phase];
		const rowIndex = phaseCounts[datum.phase]++;
		datum.x = width * phaseMeta[datum.phase].x;
		datum.y = height * rowList[Math.min(rowIndex, rowList.length - 1)];
	});
	linkSelection.attr("d", linkPath);
	nodeSelection.attr("transform", (datum) => `translate(${datum.x},${datum.y})`);
}

function resize() {
	width = chart.clientWidth;
	height = chart.clientHeight;
	svg.attr("viewBox", [0, 0, width, height]);
	positionNodes();
	if (!simulation) {
		restartSimulation();
		setTimeout(fitGraph, 500);
		return;
	}
	simulation.force("center", d3.forceCenter(width / 2, height / 2));
	simulation.alpha(0.45).restart();
	setTimeout(fitGraph, 250);
}

const linkSelection = linkLayer.selectAll("path").data(linkData).join("path").attr("fill", "none").attr("stroke-linecap", "round").attr("marker-end", "url(#warcraft-loop-arrow)");

const nodeSelection = nodeLayer.selectAll("g").data(nodeData).join("g").attr("class", "warcraft-loop-node");

nodeSelection
	.append("circle")
	.attr("r", NODE_RADIUS)
	.attr("fill", (datum) => color(datum.group))
	.attr("stroke", "#fffaf9")
	.attr("stroke-width", 2.4);

nodeSelection
	.append("text")
	.attr("fill", "#333")
	.attr("font-size", 12)
	.attr("text-anchor", "middle")
	.attr("dy", ".35em")
	.text((datum) => datum.id);

nodeSelection
	.append("text")
	.attr("fill", "#555")
	.attr("font-size", 10)
	.attr("text-anchor", "middle")
	.attr("dy", "2.1em")
	.text((datum) => datum.name);

nodeSelection
	.on("mousemove", (event, datum) => {
		showTooltip(`<strong>${datum.name}</strong>${datum.desc}<br>${phaseMeta[datum.phase].label}`, event.clientX, event.clientY);
	})
	.on("mouseleave", hideTooltip)
	.on("click", (_, datum) => {
		activePreset = null;
		activeGroup = null;
		if (activeNodeId === datum.id) {
			activeNodeId = null;
			activeReachableNodes = null;
			activeReachableLinks = null;
		} else {
			activeNodeId = datum.id;
			const reachability = computeOutgoingReachability(datum.id);
			activeReachableNodes = reachability.reachableNodes;
			activeReachableLinks = reachability.reachableLinks;
		}
		updateHighlighting();
		renderLegend();
		renderPresets();
	});

linkSelection
	.on("mousemove", (event, datum) => {
		showTooltip(`<strong>${datum.source.name} → ${datum.target.name}</strong>${datum.note}<br>${datum.type}`, event.clientX, event.clientY);
	})
	.on("mouseleave", hideTooltip);

function restartSimulation() {
	if (simulation) simulation.stop();
	simulation = d3
		.forceSimulation(nodeData)
		.force(
			"link",
			d3
				.forceLink(linkData)
				.id((datum) => datum.id)
				.distance((datum) => {
					if (datum.type === "primary") return 180;
					if (datum.type === "intra-phase") return 120;
					return 210;
				})
				.strength((datum) => (datum.type === "primary" ? 0.8 : datum.type === "intra-phase" ? 0.55 : 0.35))
		)
		.force("charge", d3.forceManyBody().strength(-650))
		.force("center", d3.forceCenter(width / 2, height / 2))
		.force("phaseX", d3.forceX((datum) => width * phaseMeta[datum.phase].x).strength(0.14))
		.force(
			"phaseY",
			d3
				.forceY((datum) => {
					const rowTargets = {
						early: [0.26, 0.5, 0.74],
						mid: [0.32, 0.56, 0.8],
						late: [0.4, 0.68],
						endgame: [0.52],
					};
					const siblings = nodeSelection.data().filter((nodeDatum) => nodeDatum.phase === datum.phase);
					const index = siblings.findIndex((nodeDatum) => nodeDatum.id === datum.id);
					const targetY = rowTargets[datum.phase][Math.min(index, rowTargets[datum.phase].length - 1)];
					return height * targetY;
				})
				.strength(0.11)
		)
		.force("collision", d3.forceCollide().radius(46))
		.on("tick", () => {
			linkSelection.attr("d", linkPath);
			nodeSelection.attr("transform", (datum) => `translate(${datum.x},${datum.y})`);
		});
	linkSelection.attr("d", linkPath);
	nodeSelection.attr("transform", (datum) => `translate(${datum.x},${datum.y})`);
	nodeSelection.call(drag(simulation));
}

fitButton.addEventListener("click", fitGraph);
resetButton.addEventListener("click", () => {
	activePreset = null;
	activeGroup = null;
	activeNodeId = null;
	activeReachableNodes = null;
	activeReachableLinks = null;
	updateHighlighting();
	renderLegend();
	renderPresets();
	fitGraph();
});

renderLegend();
renderEdgeLegend();
renderPresets();
updateHighlighting();

const resizeObserver = new ResizeObserver(() => resize());
resizeObserver.observe(chart);
