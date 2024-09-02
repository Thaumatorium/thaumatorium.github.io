// script.js

// Configuration variables
const config = {
	margin: { top: 20, right: 90, bottom: 30, left: 90 },
	width: 960,
	height: 600,
	circleRadius: 10,
	collapsedCircleColor: "lightsteelblue",
	expandedCircleColor: "#fff",
	jsonDataPath: "wow_credits.json",
	svgSelector: "#warcraft_diagram",
};

// Append the svg object to the body of the page
const svg = d3
	.select(config.svgSelector)
	.append("svg")
	.attr("width", config.width + config.margin.right + config.margin.left)
	.attr("height", config.height + config.margin.top + config.margin.bottom)
	.call(d3.zoom().on("zoom", zoomed))
	.append("g")
	.attr("transform", "translate(" + config.margin.left + "," + config.margin.top + ")");

function zoomed(event) {
	svg.attr("transform", event.transform);
}

// Load the external data
d3.json(config.jsonDataPath)
	.then((data) => {
		console.log("Data loaded:", data);

		// Transform the data
		const graph = transformData(data[0]);
		createForceDirectedGraph(graph);
	})
	.catch((error) => {
		console.error("Error loading data:", error);
	});

function transformData(data) {
	const nodes = [];
	const links = [];

	// Create the game node
	const gameNode = { id: data.title + ": " + data.subtitle, group: "game" };
	nodes.push(gameNode);

	// Create role and person nodes
	const rolesMap = {};
	data.credits.forEach((credit) => {
		if (!rolesMap[credit.role]) {
			const roleNode = { id: credit.role, group: "role" };
			nodes.push(roleNode);
			links.push({ source: gameNode.id, target: roleNode.id });
			rolesMap[credit.role] = roleNode;
		}
		const personNode = { id: credit.name, group: "person" };
		nodes.push(personNode);
		links.push({ source: rolesMap[credit.role].id, target: personNode.id });
	});

	return { nodes, links };
}

function createForceDirectedGraph(graph) {
	const simulation = d3
		.forceSimulation(graph.nodes)
		.force(
			"link",
			d3
				.forceLink(graph.links)
				.id((d) => d.id)
				.distance(100)
		)
		.force("charge", d3.forceManyBody().strength(-300))
		.force("center", d3.forceCenter(config.width / 2, config.height / 2))
		.force("collide", d3.forceCollide().radius(config.circleRadius * 2));

	const link = svg.append("g").attr("class", "links").selectAll("line").data(graph.links).enter().append("line").attr("stroke-width", 1.5).attr("stroke", "#999");

	const node = svg.append("g").attr("class", "nodes").selectAll("g").data(graph.nodes).enter().append("g").call(d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended));

	node.append("circle")
		.attr("r", config.circleRadius)
		.attr("fill", (d) => (d.group === "game" ? config.collapsedCircleColor : d.group === "role" ? config.expandedCircleColor : "#fff"))
		.attr("stroke", "#000")
		.attr("stroke-width", 1.5);

	node.append("text")
		.attr("dy", 3)
		.attr("x", (d) => (d.group === "person" ? 12 : 6))
		.style("text-anchor", "start")
		.text((d) => d.id);

	simulation.on("tick", () => {
		link.attr("x1", (d) => d.source.x)
			.attr("y1", (d) => d.source.y)
			.attr("x2", (d) => d.target.x)
			.attr("y2", (d) => d.target.y);

		node.attr("transform", (d) => `translate(${d.x},${d.y})`);
	});

	function dragstarted(event, d) {
		if (!event.active) simulation.alphaTarget(0.3).restart();
		d.fx = d.x;
		d.fy = d.y;
	}

	function dragged(event, d) {
		d.fx = event.x;
		d.fy = event.y;
	}

	function dragended(event, d) {
		if (!event.active) simulation.alphaTarget(0);
		d.fx = null;
		d.fy = null;
	}
}

// Zoom in and out controls
d3.select("#zoom_in").on("click", () => {
	svg.transition().call(d3.zoom().scaleBy, 1.2);
});

d3.select("#zoom_out").on("click", () => {
	svg.transition().call(d3.zoom().scaleBy, 0.8);
});

d3.select("#reset_zoom").on("click", () => {
	svg.transition().call(d3.zoom().transform, d3.zoomIdentity);
});
