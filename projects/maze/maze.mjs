import { generatorMap, generators } from "./generators/index.js";
import { strategyMap, strategies } from "./strategies/index.js";

const COLOUR = {
	BACKGROUND: "#ffffff",
	UNTOUCHED: "#000000",
	UNTOUCHED_WALL: "#d6d6d6",
	WALL: "#111111",
	VISITED: "#2563eb",
	DEAD_END: "#dc2626",
	PATH: "#22c55e",
	START: "#15803d",
	END: "#b91c1c",
	ORIGIN: "#d97706",
};

const MAZE = {
	canvas: document.getElementById("maze"),
	ctx: document.getElementById("maze").getContext("2d"),
	width: 40,
	height: 40,
	cellSize: 30,
	generationAlgorithm: "origin-shift",
	generationCoverage: 95,
	generationTimeLimitMs: 5000,
	benchmarkRuns: 5,
	animationSpeed: 35,
	searchStrategy: "bfs",
	grid: null,
	animationId: null,
	searchOrder: [],
	deadEndOrder: [],
	solutionPath: [],
	visitedProgress: 0,
	deadEndProgress: 0,
	pathProgress: 0,
	showUntouchedCells: false,
	showCrawlers: false,
	status: document.getElementById("maze-status"),
	hasDoneInitialGeneration: false,
	benchmarkResults: [],
	benchmarkRunning: false,
};

const widthInput = document.getElementById("maze-width");
const heightInput = document.getElementById("maze-height");
const cellSizeInput = document.getElementById("cell-size");
const generationAlgorithmInput = document.getElementById("generation-algorithm");
const generationCoverageInput = document.getElementById("generation-coverage");
const generationTimeLimitInput = document.getElementById("generation-time-limit");
const benchmarkRunsInput = document.getElementById("benchmark-runs");
const searchStrategyInput = document.getElementById("search-strategy");
const animationSpeedInput = document.getElementById("animation-speed");
const animationSpeedValue = document.getElementById("animation-speed-value");
const generateButton = document.getElementById("generate-maze");
const solveButton = document.getElementById("solve-maze");
const benchmarkButton = document.getElementById("benchmark-maze");
const benchmarkResults = document.getElementById("benchmark-results");

const HEX_UNSUPPORTED_STRATEGY_IDS = new Set(["wall-follower-left", "wall-follower-right", "pledge"]);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const randomInt = (max) => Math.floor(Math.random() * max);
const indexOf = (grid, x, y) => y * grid.width + x;
const coordsOf = (grid, index) => ({
	x: index % grid.width,
	y: Math.floor(index / grid.width),
});
const toKey = ({ x, y }) => `${x},${y}`;
const getSpeedFactor = () => Math.max(0.02, (MAZE.animationSpeed / 100) ** 2 * 12);
const getEffectiveGenerationTimeLimitMs = () => Math.max(50, Math.round(MAZE.generationTimeLimitMs / getSpeedFactor()));
const shuffle = (items) => {
	const result = [...items];
	for (let i = result.length - 1; i > 0; i--) {
		const j = randomInt(i + 1);
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
};

const setStatus = (message) => {
	MAZE.status.textContent = message;
};

const setBusyState = (isBusy) => {
	generateButton.disabled = isBusy;
	solveButton.disabled = isBusy;
	benchmarkButton.disabled = isBusy;
	MAZE.benchmarkRunning = isBusy;
};

const getGenerationSummary = () => `${MAZE.generationCoverage}% coverage or ${getEffectiveGenerationTimeLimitMs()} ms at current speed`;

const cloneGrid = (grid) => ({
	...grid,
	parent: grid.parent ? [...grid.parent] : undefined,
	links: grid.links.map((linked) => new Set(linked)),
	blocked: grid.blocked ? new Set(grid.blocked) : undefined,
	crawlers: grid.crawlers ? [...grid.crawlers] : undefined,
	visitedByOrigin: grid.visitedByOrigin ? new Set(grid.visitedByOrigin) : undefined,
});

const formatBenchmarkValue = (value) => {
	if (value === null) {
		return "n/a";
	}
	if (!Number.isFinite(value)) {
		return "fail";
	}
	return value.toLocaleString("en-US");
};

const formatBenchmarkDecimal = (value) => {
	if (!Number.isFinite(value)) {
		return "n/a";
	}
	return value.toFixed(value >= 10 ? 1 : 2);
};

const mean = (values) => (values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : Infinity);

const median = (values) => {
	if (values.length === 0) {
		return Infinity;
	}

	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);

	if (sorted.length % 2 === 0) {
		return (sorted[middle - 1] + sorted[middle]) / 2;
	}

	return sorted[middle];
};

const getBenchmarkCellColour = (value, min, max) => {
	if (value === null) {
		return "#e5e7eb";
	}
	if (!Number.isFinite(value)) {
		return "#fecaca";
	}
	if (min === max) {
		return "#bbf7d0";
	}

	const ratio = (value - min) / (max - min);
	const hue = 120 - ratio * 120;
	return `hsl(${hue} 72% 84%)`;
};

const strategySupportsGrid = (strategy, grid) => grid.topology !== "hex" || !HEX_UNSUPPORTED_STRATEGY_IDS.has(strategy.id);

const getBenchmarkSummaryByStrategy = (results) => {
	return strategies.map((strategy) => {
		const values = [];
		const relativeValues = [];
		let supportedRuns = 0;
		let failedRuns = 0;
		let unsupportedRuns = 0;

		for (const row of results) {
			const entry = row.results.find((result) => result.strategyId === strategy.id);
			if (!entry) {
				continue;
			}

			supportedRuns += entry.supportedRuns ?? 0;
			failedRuns += entry.failedRuns ?? 0;
			unsupportedRuns += entry.unsupportedRuns ?? 0;

			if (!Number.isFinite(entry.steps)) {
				continue;
			}

			values.push(entry.steps);

			const finiteRowValues = row.results.map((result) => result.steps).filter((steps) => Number.isFinite(steps));
			if (finiteRowValues.length > 0) {
				const best = Math.min(...finiteRowValues);
				if (best > 0) {
					relativeValues.push(entry.steps / best);
				}
			}
		}

		const arithmeticMean = values.length > 0 ? mean(values) : Infinity;
		const geometricRelativeMean = relativeValues.length > 0 ? Math.exp(relativeValues.reduce((sum, value) => sum + Math.log(value), 0) / relativeValues.length) : Infinity;
		const medianRelative = median(relativeValues);
		const failureRate = supportedRuns > 0 ? failedRuns / supportedRuns : Infinity;
		const unsupportedRate = supportedRuns + unsupportedRuns > 0 ? unsupportedRuns / (supportedRuns + unsupportedRuns) : Infinity;

		return {
			strategy,
			arithmeticMean,
			geometricRelativeMean,
			medianRelative,
			failureRate,
			unsupportedRate,
			supportedRuns,
			failedRuns,
			unsupportedRuns,
			sampleSize: values.length,
		};
	});
};

const buildBenchmarkTable = (results) => {
	if (results.length === 0) {
		const empty = document.createElement("p");
		empty.className = "maze-benchmark-empty";
		empty.textContent = "No benchmark yet.";
		return empty;
	}

	const table = document.createElement("table");
	table.className = "maze-benchmark-table";
	const strategySummary = getBenchmarkSummaryByStrategy(results).sort(
		(a, b) => a.failureRate - b.failureRate || a.failedRuns - b.failedRuns || a.unsupportedRate - b.unsupportedRate || a.unsupportedRuns - b.unsupportedRuns || a.geometricRelativeMean - b.geometricRelativeMean || a.medianRelative - b.medianRelative || a.arithmeticMean - b.arithmeticMean
	);

	const thead = document.createElement("thead");
	const headerRow = document.createElement("tr");
	const generatorHeader = document.createElement("th");
	generatorHeader.textContent = "Generator";
	headerRow.append(generatorHeader);

	for (const { strategy } of strategySummary) {
		const th = document.createElement("th");
		th.textContent = strategy.name;
		headerRow.append(th);
	}

	thead.append(headerRow);
	table.append(thead);

	const tbody = document.createElement("tbody");

	for (const row of results) {
		const tr = document.createElement("tr");
		const label = document.createElement("th");
		label.textContent = row.generatorName;
		tr.append(label);

		const numericScores = row.results.map((entry) => entry.steps).filter((value) => Number.isFinite(value));
		const min = numericScores.length > 0 ? Math.min(...numericScores) : 0;
		const max = numericScores.length > 0 ? Math.max(...numericScores) : 0;

		for (const { strategy } of strategySummary) {
			const entry = row.results.find((result) => result.strategyId === strategy.id);
			const steps = entry?.steps ?? null;
			const td = document.createElement("td");
			td.textContent = formatBenchmarkValue(steps);
			td.style.backgroundColor = getBenchmarkCellColour(steps, min, max);
			td.title = entry?.note ?? "";
			if (steps === null) {
				td.dataset.state = "na";
			} else if (!Number.isFinite(steps)) {
				td.dataset.state = "fail";
			}
			tr.append(td);
		}

		tbody.append(tr);
	}

	const tfoot = document.createElement("tfoot");
	const summaryColourValues = (values) => {
		const finiteValues = values.filter((value) => Number.isFinite(value));
		const min = finiteValues.length > 0 ? Math.min(...finiteValues) : 0;
		const max = finiteValues.length > 0 ? Math.max(...finiteValues) : 0;
		return { min, max };
	};

	const arithmeticRow = document.createElement("tr");
	const arithmeticLabel = document.createElement("th");
	arithmeticLabel.textContent = "Avg. steps";
	arithmeticRow.append(arithmeticLabel);
	const arithmeticScale = summaryColourValues(strategySummary.map((summary) => summary.arithmeticMean));
	for (const summary of strategySummary) {
		const td = document.createElement("td");
		td.textContent = formatBenchmarkDecimal(summary.arithmeticMean);
		td.title = `Arithmetic mean over ${summary.sampleSize} successful runs.`;
		td.style.backgroundColor = getBenchmarkCellColour(summary.arithmeticMean, arithmeticScale.min, arithmeticScale.max);
		arithmeticRow.append(td);
	}
	tfoot.append(arithmeticRow);

	const reliabilityRow = document.createElement("tr");
	const reliabilityLabel = document.createElement("th");
	reliabilityLabel.textContent = "Fail rate";
	reliabilityRow.append(reliabilityLabel);
	const reliabilityScale = summaryColourValues(strategySummary.map((summary) => summary.failureRate));
	for (const summary of strategySummary) {
		const td = document.createElement("td");
		td.textContent = Number.isFinite(summary.failureRate) ? `${(summary.failureRate * 100).toFixed(1)}%` : "n/a";
		td.title = `${summary.failedRuns} failed runs over ${summary.supportedRuns} supported runs. Lower is better.`;
		td.style.backgroundColor = getBenchmarkCellColour(summary.failureRate, reliabilityScale.min, reliabilityScale.max);
		reliabilityRow.append(td);
	}
	tfoot.append(reliabilityRow);

	const coverageRow = document.createElement("tr");
	const coverageLabel = document.createElement("th");
	coverageLabel.textContent = "Unsupported";
	coverageRow.append(coverageLabel);
	const coverageScale = summaryColourValues(strategySummary.map((summary) => summary.unsupportedRate));
	for (const summary of strategySummary) {
		const td = document.createElement("td");
		td.textContent = Number.isFinite(summary.unsupportedRate) ? `${(summary.unsupportedRate * 100).toFixed(1)}%` : "n/a";
		td.title = `${summary.unsupportedRuns} unsupported runs. Lower is better.`;
		td.style.backgroundColor = getBenchmarkCellColour(summary.unsupportedRate, coverageScale.min, coverageScale.max);
		coverageRow.append(td);
	}
	tfoot.append(coverageRow);

	const medianRow = document.createElement("tr");
	const medianLabel = document.createElement("th");
	medianLabel.textContent = "Median relative";
	medianRow.append(medianLabel);
	const medianScale = summaryColourValues(strategySummary.map((summary) => summary.medianRelative));
	for (const summary of strategySummary) {
		const td = document.createElement("td");
		td.textContent = formatBenchmarkDecimal(summary.medianRelative);
		td.title = `Median of steps relative to the best solver per generator. Lower is better.`;
		td.style.backgroundColor = getBenchmarkCellColour(summary.medianRelative, medianScale.min, medianScale.max);
		medianRow.append(td);
	}
	tfoot.append(medianRow);

	const geometricRow = document.createElement("tr");
	const geometricLabel = document.createElement("th");
	geometricLabel.textContent = "Geo. relative";
	geometricRow.append(geometricLabel);
	const geometricScale = summaryColourValues(strategySummary.map((summary) => summary.geometricRelativeMean));
	for (const summary of strategySummary) {
		const td = document.createElement("td");
		td.textContent = formatBenchmarkDecimal(summary.geometricRelativeMean);
		td.title = `Geometric mean of steps relative to the best solver per generator. Lower is better; 1.00 is row-best on average.`;
		td.style.backgroundColor = getBenchmarkCellColour(summary.geometricRelativeMean, geometricScale.min, geometricScale.max);
		geometricRow.append(td);
	}
	tfoot.append(geometricRow);

	table.append(tfoot);
	table.append(tbody);
	return table;
};

const renderBenchmarkResults = () => {
	benchmarkResults.replaceChildren(buildBenchmarkTable(MAZE.benchmarkResults));
};

const populateGeneratorOptions = () => {
	generationAlgorithmInput.innerHTML = generators.map((entry) => `<option value="${entry.id}">${entry.name}</option>`).join("");
	generationAlgorithmInput.value = MAZE.generationAlgorithm;
};

const populateStrategyOptions = () => {
	searchStrategyInput.innerHTML = strategies.map((entry) => `<option value="${entry.id}">${entry.name}</option>`).join("");
	searchStrategyInput.value = MAZE.searchStrategy;
};

const getCornerCrawlerStarts = (width, height) => {
	const xPositions = [0, Math.floor((width - 1) / 2), width - 1];
	const yPositions = [0, Math.floor((height - 1) / 2), height - 1];
	const starts = [];

	for (const y of yPositions) {
		for (const x of xPositions) {
			starts.push(indexOf({ width }, x, y));
		}
	}

	return [...new Set(starts)];
};

const createInitialGrid = (width, height) => {
	const size = width * height;
	const parent = new Array(size);
	const crawlers = getCornerCrawlerStarts(width, height);

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const index = indexOf({ width }, x, y);
			if (x === 0 && y === 0) {
				parent[index] = -1;
			} else if (x > 0) {
				parent[index] = indexOf({ width }, x - 1, y);
			} else {
				parent[index] = indexOf({ width }, x, y - 1);
			}
		}
	}

	return {
		width,
		height,
		size,
		topology: "square",
		parent,
		links: Array.from({ length: size }, () => new Set()),
		origin: crawlers[0],
		crawlers,
		shiftCount: 0,
		visitedByOrigin: new Set(crawlers),
		start: 0,
		end: size - 1,
	};
};

const getNeighbourIndices = (grid, index) => {
	const { x, y } = coordsOf(grid, index);
	const neighbours = [];

	if (y > 0) neighbours.push(indexOf(grid, x, y - 1));
	if (x < grid.width - 1) neighbours.push(indexOf(grid, x + 1, y));
	if (y < grid.height - 1) neighbours.push(indexOf(grid, x, y + 1));
	if (x > 0) neighbours.push(indexOf(grid, x - 1, y));

	return neighbours;
};

const refreshLinksFromParent = (grid) => {
	grid.links = Array.from({ length: grid.parent.length }, () => new Set());
	for (let index = 0; index < grid.parent.length; index++) {
		const parent = grid.parent[index];
		if (parent >= 0) {
			grid.links[index].add(parent);
			grid.links[parent].add(index);
		}
	}
};

const shiftOrigin = (grid) => {
	const neighbours = getNeighbourIndices(grid, grid.origin);
	const nextOrigin = neighbours[randomInt(neighbours.length)];

	grid.parent[grid.origin] = nextOrigin;
	grid.parent[nextOrigin] = -1;
	grid.origin = nextOrigin;
	grid.shiftCount += 1;
	grid.visitedByOrigin.add(nextOrigin);
	refreshLinksFromParent(grid);
};

const rerootAt = (grid, newRoot) => {
	if (grid.origin === newRoot) {
		return;
	}

	let current = newRoot;
	let previous = -1;

	while (current !== -1) {
		const next = grid.parent[current];
		grid.parent[current] = previous;
		previous = current;
		current = next;
	}

	grid.origin = newRoot;
};

const shiftCrawler = (grid, crawlerIndex) => {
	const crawlerPosition = grid.crawlers[crawlerIndex];
	rerootAt(grid, crawlerPosition);
	shiftOrigin(grid);
	grid.crawlers[crawlerIndex] = grid.origin;
};

const areConnected = (grid, first, second) => grid.links[first]?.has(second) ?? false;

const isHexGrid = () => MAZE.grid?.topology === "hex";

const getHexCenter = (index) => {
	const { x, y } = coordsOf(MAZE.grid, index);
	const size = MAZE.cellSize;
	const hexWidth = Math.sqrt(3) * size;
	return {
		x: hexWidth * (x + 0.5 * (y % 2)) + size,
		y: size * (1.5 * y + 1),
	};
};

const getHexVertices = (index, inset = 0) => {
	const center = getHexCenter(index);
	const radius = Math.max(2, MAZE.cellSize - inset);
	const angles = [-90, -30, 30, 90, 150, 210];
	return angles.map((degrees) => {
		const radians = (degrees * Math.PI) / 180;
		return {
			x: center.x + Math.cos(radians) * radius,
			y: center.y + Math.sin(radians) * radius,
		};
	});
};

const getHexNeighbours = (index) => {
	const { x, y } = coordsOf(MAZE.grid, index);
	const evenRow = y % 2 === 0;
	const deltas = evenRow
		? [
				[1, 0],
				[-1, 0],
				[0, -1],
				[-1, -1],
				[0, 1],
				[-1, 1],
			]
		: [
				[1, 0],
				[-1, 0],
				[1, -1],
				[0, -1],
				[1, 1],
				[0, 1],
			];
	return deltas.map(([dx, dy]) => {
		const nx = x + dx;
		const ny = y + dy;
		if (nx < 0 || ny < 0 || nx >= MAZE.grid.width || ny >= MAZE.grid.height) {
			return -1;
		}
		return indexOf(MAZE.grid, nx, ny);
	});
};

const resizeCanvas = () => {
	if (isHexGrid()) {
		const size = MAZE.cellSize;
		const hexWidth = Math.sqrt(3) * size;
		MAZE.canvas.width = Math.ceil(hexWidth * (MAZE.width + 0.5) + size);
		MAZE.canvas.height = Math.ceil(size * (1.5 * (MAZE.height - 1) + 2) + size);
		return;
	}

	const width = MAZE.width * MAZE.cellSize + 1;
	const height = MAZE.height * MAZE.cellSize + 1;

	MAZE.canvas.width = width;
	MAZE.canvas.height = height;
};

const fillCell = (index, fillStyle, inset = 0) => {
	if (isHexGrid()) {
		const vertices = getHexVertices(index, inset);
		MAZE.ctx.fillStyle = fillStyle;
		MAZE.ctx.beginPath();
		MAZE.ctx.moveTo(vertices[0].x, vertices[0].y);
		for (let i = 1; i < vertices.length; i++) {
			MAZE.ctx.lineTo(vertices[i].x, vertices[i].y);
		}
		MAZE.ctx.closePath();
		MAZE.ctx.fill();
		return;
	}

	const { x, y } = coordsOf(MAZE.grid, index);
	const cellSize = MAZE.cellSize;

	MAZE.ctx.fillStyle = fillStyle;
	MAZE.ctx.fillRect(x * cellSize + inset, y * cellSize + inset, Math.max(1, cellSize - inset * 2 + 1), Math.max(1, cellSize - inset * 2 + 1));
};

const isUntouched = (index) => MAZE.showUntouchedCells && MAZE.grid.visitedByOrigin && !MAZE.grid.visitedByOrigin.has(index);

const getWallColour = (current, neighbour) => {
	const currentUntouched = isUntouched(current);
	const neighbourUntouched = neighbour >= 0 ? isUntouched(neighbour) : currentUntouched;

	if (currentUntouched && neighbourUntouched) {
		return COLOUR.UNTOUCHED_WALL;
	}

	return COLOUR.WALL;
};

const drawWalls = () => {
	if (isHexGrid()) {
		drawHexWalls();
		return;
	}

	const { ctx, cellSize, grid } = MAZE;
	ctx.lineWidth = 2;

	for (let y = 0; y < grid.height; y++) {
		for (let x = 0; x < grid.width; x++) {
			const index = indexOf(grid, x, y);
			const left = x * cellSize;
			const top = y * cellSize;
			const right = left + cellSize;
			const bottom = top + cellSize;

			const north = y > 0 ? indexOf(grid, x, y - 1) : -1;
			const west = x > 0 ? indexOf(grid, x - 1, y) : -1;
			const south = y < grid.height - 1 ? indexOf(grid, x, y + 1) : -1;
			const east = x < grid.width - 1 ? indexOf(grid, x + 1, y) : -1;

			if (north === -1 || !areConnected(grid, index, north)) {
				ctx.strokeStyle = getWallColour(index, north);
				ctx.beginPath();
				ctx.moveTo(left, top);
				ctx.lineTo(right, top);
				ctx.stroke();
			}

			if (west === -1 || !areConnected(grid, index, west)) {
				ctx.strokeStyle = getWallColour(index, west);
				ctx.beginPath();
				ctx.moveTo(left, top);
				ctx.lineTo(left, bottom);
				ctx.stroke();
			}

			if (south === -1 || !areConnected(grid, index, south)) {
				ctx.strokeStyle = getWallColour(index, south);
				ctx.beginPath();
				ctx.moveTo(left, bottom);
				ctx.lineTo(right, bottom);
				ctx.stroke();
			}

			if (east === -1 || !areConnected(grid, index, east)) {
				ctx.strokeStyle = getWallColour(index, east);
				ctx.beginPath();
				ctx.moveTo(right, top);
				ctx.lineTo(right, bottom);
				ctx.stroke();
			}
		}
	}
};

const drawHexWalls = () => {
	const { ctx, grid } = MAZE;
	ctx.lineWidth = 2;

	for (let index = 0; index < grid.size; index++) {
		if (grid.blocked?.has(index)) {
			continue;
		}

		const vertices = getHexVertices(index);
		const neighbours = getHexNeighbours(index);
		const edges = [
			[vertices[0], vertices[1], neighbours[2]],
			[vertices[1], vertices[2], neighbours[0]],
			[vertices[2], vertices[3], neighbours[4]],
			[vertices[3], vertices[4], neighbours[5]],
			[vertices[4], vertices[5], neighbours[1]],
			[vertices[5], vertices[0], neighbours[3]],
		];

		for (const [from, to, neighbour] of edges) {
			if (neighbour >= 0 && areConnected(grid, index, neighbour)) {
				continue;
			}
			ctx.strokeStyle = getWallColour(index, neighbour);
			ctx.beginPath();
			ctx.moveTo(from.x, from.y);
			ctx.lineTo(to.x, to.y);
			ctx.stroke();
		}
	}
};

const render = () => {
	if (!MAZE.grid) {
		return;
	}

	MAZE.ctx.fillStyle = COLOUR.BACKGROUND;
	MAZE.ctx.fillRect(0, 0, MAZE.canvas.width, MAZE.canvas.height);

	if (MAZE.grid.blocked) {
		for (const blocked of MAZE.grid.blocked) {
			fillCell(blocked, COLOUR.WALL);
		}
	}

	if (MAZE.showUntouchedCells && MAZE.grid.visitedByOrigin) {
		for (let index = 0; index < (MAZE.grid.parent?.length ?? MAZE.grid.size ?? 0); index++) {
			if (!MAZE.grid.visitedByOrigin.has(index)) {
				fillCell(index, COLOUR.UNTOUCHED);
			}
		}
	}

	for (let i = 0; i < MAZE.visitedProgress; i++) {
		fillCell(MAZE.searchOrder[i], COLOUR.VISITED);
	}

	for (let i = 0; i < MAZE.deadEndProgress; i++) {
		fillCell(MAZE.deadEndOrder[i], COLOUR.DEAD_END);
	}

	for (let i = 0; i < MAZE.pathProgress; i++) {
		fillCell(MAZE.solutionPath[i], COLOUR.PATH);
	}

	fillCell(MAZE.grid.start, COLOUR.START, 4);
	fillCell(MAZE.grid.end, COLOUR.END, 4);
	if (MAZE.showCrawlers) {
		for (const crawler of MAZE.grid.crawlers) {
			fillCell(crawler, COLOUR.ORIGIN, 5);
		}
	}

	drawWalls();
};

const cancelAnimation = () => {
	if (MAZE.animationId !== null) {
		cancelAnimationFrame(MAZE.animationId);
		MAZE.animationId = null;
	}
};

const nextFrame = () =>
	new Promise((resolve) => {
		requestAnimationFrame(() => resolve());
	});

const runGeneration = () => {
	cancelAnimation();
	MAZE.searchOrder = [];
	MAZE.deadEndOrder = [];
	MAZE.solutionPath = [];
	MAZE.visitedProgress = 0;
	MAZE.deadEndProgress = 0;
	MAZE.pathProgress = 0;
	MAZE.showUntouchedCells = true;
	MAZE.showCrawlers = true;
	MAZE.grid = createInitialGrid(MAZE.width, MAZE.height);
	refreshLinksFromParent(MAZE.grid);
	resizeCanvas();
	render();

	const generationStartTime = performance.now();
	let lastFrameTime = generationStartTime;
	let generationBudget = 0;
	setStatus(`Generating ${MAZE.width} x ${MAZE.height} maze with Origin Shift using ${getGenerationSummary()}...`);

	const step = () => {
		const now = performance.now();
		const speedFactor = getSpeedFactor();
		const totalCells = MAZE.width * MAZE.height;
		const targetVisitedCells = Math.max(1, Math.ceil((totalCells * MAZE.generationCoverage) / 100));
		const elapsedMs = now - generationStartTime;
		const frameDelta = now - lastFrameTime;
		lastFrameTime = now;
		const effectiveTimeLimitMs = getEffectiveGenerationTimeLimitMs();
		const generationDone = MAZE.grid.visitedByOrigin.size >= targetVisitedCells || elapsedMs >= effectiveTimeLimitMs;
		const remainingCells = targetVisitedCells - MAZE.grid.visitedByOrigin.size;
		generationBudget += ((Math.max(remainingCells, 1) * speedFactor) / 12) * (frameDelta / 16.67);

		while (generationBudget >= 1 && !generationDone) {
			generationBudget -= 1;
			const crawlerIndex = randomInt(MAZE.grid.crawlers.length);
			shiftCrawler(MAZE.grid, crawlerIndex);
			if (MAZE.grid.visitedByOrigin.size >= targetVisitedCells || performance.now() - generationStartTime >= effectiveTimeLimitMs) {
				break;
			}
		}

		render();

		const doneNow = MAZE.grid.visitedByOrigin.size >= targetVisitedCells || performance.now() - generationStartTime >= effectiveTimeLimitMs;

		if (!doneNow) {
			MAZE.animationId = requestAnimationFrame(step);
			return;
		}

		MAZE.animationId = null;
		MAZE.showUntouchedCells = false;
		MAZE.showCrawlers = false;
		if (!MAZE.hasDoneInitialGeneration) {
			MAZE.hasDoneInitialGeneration = true;
			MAZE.animationSpeed = 10;
			animationSpeedInput.value = "10";
			animationSpeedValue.value = "10";
		}
		render();
		setStatus(`Generated ${MAZE.width} x ${MAZE.height} maze after touching ${MAZE.grid.visitedByOrigin.size}/${totalCells} cells in ${MAZE.grid.shiftCount} origin shifts.`);
	};

	MAZE.animationId = requestAnimationFrame(step);
};

const animateSolve = () => {
	if (!MAZE.grid) {
		return;
	}

	cancelAnimation();
	const solver = strategyMap.get(MAZE.searchStrategy);
	const { searchOrder, path, steps = 0, deadEndOrder = searchOrder.filter((index) => !path.includes(index)).reverse() } = solver.solve(MAZE.grid);
	MAZE.searchOrder = searchOrder;
	MAZE.deadEndOrder = deadEndOrder;
	MAZE.solutionPath = path;
	MAZE.visitedProgress = 0;
	MAZE.deadEndProgress = 0;
	MAZE.pathProgress = 0;

	if (path.length === 0) {
		render();
		setStatus("No path found. That should not happen in a perfect maze.");
		return;
	}

	setStatus(`Solving maze with ${solver.name}...`);

	const step = () => {
		const speedFactor = getSpeedFactor();
		const visitedStep = Math.max(1, Math.ceil((MAZE.searchOrder.length * speedFactor) / 4500));
		const deadEndStep = Math.max(1, Math.ceil((MAZE.deadEndOrder.length * speedFactor) / 3500));
		const pathStep = Math.max(1, Math.ceil((MAZE.solutionPath.length * speedFactor) / 3000));

		if (MAZE.visitedProgress < MAZE.searchOrder.length) {
			MAZE.visitedProgress = Math.min(MAZE.searchOrder.length, MAZE.visitedProgress + visitedStep);
		} else if (MAZE.deadEndProgress < MAZE.deadEndOrder.length) {
			MAZE.deadEndProgress = Math.min(MAZE.deadEndOrder.length, MAZE.deadEndProgress + deadEndStep);
		} else if (MAZE.pathProgress < MAZE.solutionPath.length) {
			MAZE.pathProgress = Math.min(MAZE.solutionPath.length, MAZE.pathProgress + pathStep);
		}

		render();

		if (MAZE.visitedProgress < MAZE.searchOrder.length || MAZE.deadEndProgress < MAZE.deadEndOrder.length || MAZE.pathProgress < MAZE.solutionPath.length) {
			MAZE.animationId = requestAnimationFrame(step);
			return;
		}

		MAZE.animationId = null;
		setStatus(`${solver.name} took ${steps} steps and found a path of length ${MAZE.solutionPath.length}.`);
	};

	MAZE.animationId = requestAnimationFrame(step);
};

const runBenchmark = async () => {
	applySettings();
	cancelAnimation();
	setBusyState(true);
	setStatus(`Benchmarking ${generators.length} generators with ${MAZE.benchmarkRuns} runs each against ${strategies.length} strategies...`);

	try {
		const results = [];
		let completedRuns = 0;
		const totalRuns = generators.length * MAZE.benchmarkRuns * strategies.length;

		for (const generator of generators) {
			const strategyTotals = new Map(
				strategies.map((strategy) => [
					strategy.id,
					{
						steps: [],
						pathLengths: [],
						elapsedMs: [],
						failures: 0,
						unsupported: 0,
					},
				])
			);
			const row = {
				generatorId: generator.id,
				generatorName: generator.name,
				results: [],
			};

			for (let runIndex = 0; runIndex < MAZE.benchmarkRuns; runIndex++) {
				let grid = null;

				try {
					grid = generator.generate({
						width: MAZE.width,
						height: MAZE.height,
						generationCoverage: MAZE.generationCoverage,
						generationTimeLimitMs: MAZE.generationTimeLimitMs,
					});
				} catch (error) {
					for (const strategy of strategies) {
						const totals = strategyTotals.get(strategy.id);
						totals.failures += 1;
						totals.elapsedMs.push(0);
						completedRuns += 1;
					}
					setStatus(`Benchmarking ${generator.name} run ${runIndex + 1}/${MAZE.benchmarkRuns}... ${completedRuns}/${totalRuns} solver runs complete.`);
					await nextFrame();
					continue;
				}

				for (const strategy of strategies) {
					const totals = strategyTotals.get(strategy.id);
					if (!strategySupportsGrid(strategy, grid)) {
						totals.unsupported += 1;
						completedRuns += 1;
						continue;
					}

					try {
						const startedAt = performance.now();
						const outcome = strategy.solve(cloneGrid(grid));
						const elapsedMs = performance.now() - startedAt;
						const solved = outcome.path.length > 0 && outcome.path[outcome.path.length - 1] === grid.end;

						totals.elapsedMs.push(elapsedMs);
						if (solved) {
							totals.steps.push(outcome.steps ?? outcome.searchOrder.length);
							totals.pathLengths.push(outcome.path.length);
						} else {
							totals.failures += 1;
						}
					} catch (error) {
						totals.failures += 1;
					}
					completedRuns += 1;
				}

				setStatus(`Benchmarking ${generator.name} run ${runIndex + 1}/${MAZE.benchmarkRuns}... ${completedRuns}/${totalRuns} solver runs complete.`);
				await nextFrame();
			}

			for (const strategy of strategies) {
				const totals = strategyTotals.get(strategy.id);
				const supportedRuns = MAZE.benchmarkRuns - totals.unsupported;
				const averageSteps = mean(totals.steps);
				const averagePathLength = mean(totals.pathLengths);
				const averageElapsedMs = mean(totals.elapsedMs);
				const noteParts = [];

				if (totals.unsupported === MAZE.benchmarkRuns) {
					row.results.push({
						strategyId: strategy.id,
						steps: null,
						supportedRuns: 0,
						failedRuns: 0,
						unsupportedRuns: totals.unsupported,
						note: `${strategy.name} is not supported on this generator's maze topology.`,
					});
					continue;
				}

				if (totals.steps.length > 0) {
					noteParts.push(`avg ${formatBenchmarkDecimal(averageSteps)} steps`);
					noteParts.push(`avg path ${formatBenchmarkDecimal(averagePathLength)}`);
				}
				if (Number.isFinite(averageElapsedMs)) {
					noteParts.push(`avg ${averageElapsedMs.toFixed(1)} ms`);
				}
				if (totals.failures > 0) {
					noteParts.push(`${totals.failures}/${supportedRuns} failed`);
				}

				row.results.push({
					strategyId: strategy.id,
					steps: totals.steps.length > 0 ? averageSteps : Infinity,
					supportedRuns,
					failedRuns: totals.failures,
					unsupportedRuns: totals.unsupported,
					note: noteParts.length > 0 ? `${strategy.name}: ${noteParts.join(", ")}.` : `${strategy.name} had no successful runs.`,
				});
			}

			results.push(row);
			MAZE.benchmarkResults = results;
			renderBenchmarkResults();
		}

		MAZE.benchmarkResults = results;
		renderBenchmarkResults();
		setStatus(`Benchmark complete: ${generators.length} generators x ${MAZE.benchmarkRuns} runs x ${strategies.length} strategies.`);
	} finally {
		setBusyState(false);
	}
};

const applySettings = () => {
	MAZE.width = clamp(parseInt(widthInput.value, 10) || 20, 4, 80);
	MAZE.height = clamp(parseInt(heightInput.value, 10) || 20, 4, 80);
	MAZE.cellSize = clamp(parseInt(cellSizeInput.value, 10) || 18, 8, 40);
	MAZE.generationAlgorithm = generationAlgorithmInput.value || "origin-shift";
	MAZE.generationCoverage = clamp(parseInt(generationCoverageInput.value, 10) || 95, 1, 100);
	MAZE.generationTimeLimitMs = clamp(parseInt(generationTimeLimitInput.value, 10) || 5000, 50, 10000);
	MAZE.benchmarkRuns = clamp(parseInt(benchmarkRunsInput.value, 10) || 5, 1, 50);
	MAZE.searchStrategy = searchStrategyInput.value;

	widthInput.value = MAZE.width;
	heightInput.value = MAZE.height;
	cellSizeInput.value = MAZE.cellSize;
	generationAlgorithmInput.value = MAZE.generationAlgorithm;
	generationCoverageInput.value = MAZE.generationCoverage;
	generationTimeLimitInput.value = MAZE.generationTimeLimitMs;
	benchmarkRunsInput.value = MAZE.benchmarkRuns;
};

animationSpeedInput.oninput = () => {
	MAZE.animationSpeed = parseInt(animationSpeedInput.value, 10);
	animationSpeedValue.value = animationSpeedInput.value;
};

searchStrategyInput.onchange = () => {
	MAZE.searchStrategy = searchStrategyInput.value;
	if (MAZE.grid && MAZE.animationId === null) {
		MAZE.searchOrder = [];
		MAZE.deadEndOrder = [];
		MAZE.solutionPath = [];
		MAZE.visitedProgress = 0;
		MAZE.deadEndProgress = 0;
		MAZE.pathProgress = 0;
		render();
		setStatus(`Ready to solve with ${strategyMap.get(MAZE.searchStrategy).name}.`);
	}
};

cellSizeInput.onchange = () => {
	applySettings();
	if (MAZE.grid) {
		resizeCanvas();
		render();
	}
};

generateButton.onclick = () => {
	applySettings();
	if (MAZE.generationAlgorithm === "origin-shift") {
		runGeneration();
		return;
	}

	cancelAnimation();
	MAZE.showUntouchedCells = false;
	MAZE.showCrawlers = false;
	MAZE.searchOrder = [];
	MAZE.deadEndOrder = [];
	MAZE.solutionPath = [];
	MAZE.visitedProgress = 0;
	MAZE.deadEndProgress = 0;
	MAZE.pathProgress = 0;
	MAZE.grid = generatorMap.get(MAZE.generationAlgorithm).generate({
		width: MAZE.width,
		height: MAZE.height,
		generationCoverage: MAZE.generationCoverage,
		generationTimeLimitMs: MAZE.generationTimeLimitMs,
	});
	resizeCanvas();
	render();
	setStatus(`Generated ${generatorMap.get(MAZE.generationAlgorithm).name}.`);
};

solveButton.onclick = () => {
	applySettings();
	animateSolve();
};

benchmarkButton.onclick = () => {
	runBenchmark();
};

MAZE.animationSpeed = 100;
animationSpeedInput.value = "100";
animationSpeedValue.value = "100";
populateGeneratorOptions();
populateStrategyOptions();
applySettings();
setStatus(`Ready to generate a ${MAZE.width} x ${MAZE.height} maze with ${getGenerationSummary()}.`);
runGeneration();
renderBenchmarkResults();
