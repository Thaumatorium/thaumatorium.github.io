const USER_SOURCE_ID = "inventing-on-principle-user-code.js";
const USER_SOURCE_LINE_OFFSET = 1;
const MONACO_BASE_URL = "https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs";
const SCENE_WIDTH = 760;
const SCENE_HEIGHT = 920;
const SVG_NS = "http://www.w3.org/2000/svg";
const LITERAL_HOVER_SLOP = 2;
const ACTIVE_LITERAL_HOVER_SLOP = 4;

const INITIAL_SOURCE = `const blossomColors = ["#f5cee3", "#f7c9f3", "#ebb4cc", "#ffd9eb", "#f9dcec"];

//
// scene
//

function drawScene() {
\tdrawSky();
\tdrawMountains();
\tdrawTree();
}

//
// sky
//

function drawSky() {
\tgradientRect(0, 0, width, height, [
\t\t[0, "#bdeefd"],
\t\t[0.7, "#d7f3ff"],
\t\t[1, "#edf8ff"],
\t]);
}

//
// mountains
//

function drawMountains() {
\tresetRandom(8);
\tdrawMountain(165, "#adc6c5");
\tdrawMountain(115, "#8fa9ab");
\tdrawMountain(70, "#6e8d8d");
}

function drawMountain(offset, fill) {
\tconst points = [[0, height - offset]];
\tlet x = 0;
\tlet y = height - offset;

\twhile (x < width) {
\t\tx += random(16, 44);
\t\ty += random(-18, 18);
\t\tpoints.push([x, y]);
\t}

\tpoints.push([width, height], [0, height]);
\tpolygon(points, { fill, opacity: 0.94 });
}

//
// tree
//

function drawTree() {
\tconst blossoms = [];

\tresetRandom(17);
\tdrawBranches(0, -Math.PI / 2, width * 0.53, height, 34, blossoms);

\tresetRandom(17);
\tdrawBlossoms(blossoms);
}

function drawBranches(level, angle, x, y, branchWidth, blossoms) {
\tlet length = mix(level, 0, 8, 108, 20) + random(-5, 10);
\tif (level === 0) {
\t\tlength = 96;
\t}

\tconst tipX = x + Math.cos(angle) * length;
\tconst tipY = y + Math.sin(angle) * length;
\tbranch(x, y, tipX, tipY, branchWidth, {
\t\tfill: level === 0 ? "#120706" : "#1c0908",
\t\ttaper: 0.22,
\t});

\tif (level > 4) {
\t\tblossoms.push([x, y, tipX, tipY]);
\t}

\tif (level < 6) {
\t\tdrawBranches(level + 1, angle + random(-0.52, -0.18), tipX, tipY, branchWidth * 0.72, blossoms);
\t\tdrawBranches(level + 1, angle + random(0.18, 0.52), tipX, tipY, branchWidth * 0.72, blossoms);
\t} else if (level < 10) {
\t\tdrawBranches(level + 1, angle + random(-0.7, -0.08), tipX, tipY, branchWidth * 0.68, blossoms);
\t\tif (random(0, 1) > 0.22) {
\t\t\tdrawBranches(level + 1, angle + random(0.08, 0.7), tipX, tipY, branchWidth * 0.68, blossoms);
\t\t}
\t}
}

function drawBlossoms(points) {
\tfor (let i = 0; i < points.length; i += 1) {
\t\tconst [baseX, baseY, tipX, tipY] = points[i];

\t\tfor (let j = 0; j < 16; j += 1) {
\t\t\tconst t = random(0, 1);
\t\t\tconst x = lerp(baseX, tipX, t) + random(-16, 16);
\t\t\tconst y = lerp(baseY, tipY, t) + random(-14, 14);
\t\t\tconst fill = blossomColors[Math.floor(random(0, blossomColors.length))];
\t\t\tcircle(x, y, random(2, 7), { fill, opacity: 0.68 });
\t\t}
\t}
}

drawScene();
`;

const NOTEBOOK_TYPINGS = `
declare const width: number;
declare const height: number;

declare function circle(
\tcx: number,
\tcy: number,
\tradius: number,
\toptions?: { fill?: string; stroke?: string; strokeWidth?: number; opacity?: number }
): void;

declare function polygon(
\tpoints: Array<[number, number]>,
\toptions?: { fill?: string; stroke?: string; strokeWidth?: number; opacity?: number }
): void;

declare function polyline(
\tpoints: Array<[number, number]>,
\toptions?: { stroke?: string; strokeWidth?: number; opacity?: number }
): void;

declare function branch(
\tx1: number,
\ty1: number,
\tx2: number,
\ty2: number,
\twidth: number,
\toptions?: { fill?: string; stroke?: string; strokeWidth?: number; opacity?: number; taper?: number }
): void;

declare function gradientRect(
\tx: number,
\ty: number,
\twidth: number,
\theight: number,
\tstops: Array<[number, string]>,
\toptions?: { opacity?: number }
): void;

declare function random(min?: number, max?: number): number;
declare function resetRandom(seed?: number): void;
declare function lerp(start: number, end: number, t: number): number;
declare function mix(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number;
declare function clamp(value: number, min: number, max: number): number;
`;

const SNIPPETS = [
	{
		label: "gradientRect",
		insertText: 'gradientRect(${1:0}, ${2:0}, ${3:width}, ${4:height}, [[0, ${5:"#bdeefd"}], [1, ${6:"#edf8ff"}]])',
		documentation: "Draw a gradient-filled rectangle.",
	},
	{
		label: "polygon",
		insertText: 'polygon([[${1:0}, ${2:0}], [${3:120}, ${4:40}], [${5:0}, ${6:140}]], { fill: ${7:"#ff9eb5"} })',
		documentation: "Draw a filled polygon from points.",
	},
	{
		label: "circle",
		insertText: 'circle(${1:width / 2}, ${2:height / 2}, ${3:42}, { fill: ${4:"#f8c7dd"}, opacity: ${5:0.7} })',
		documentation: "Draw a circle.",
	},
	{
		label: "branch",
		insertText: 'branch(${1:220}, ${2:780}, ${3:320}, ${4:620}, ${5:28}, { fill: ${6:"#120706"}, taper: ${7:0.24} })',
		documentation: "Draw a tapered branch segment.",
	},
	{
		label: "draw function",
		insertText: "function ${1:drawThing}() {\\n\\t${2:// draw here}\\n}\\n",
		documentation: "Create a drawing helper function.",
	},
];

const dom = {
	page: document.querySelector(".iop-page"),
	book: document.getElementById("iop-book"),
	previewPage: document.getElementById("iop-preview-page"),
	codePage: document.getElementById("iop-code-page"),
	editor: document.getElementById("iop-editor"),
	editorLoading: document.getElementById("iop-editor-loading"),
	scene: document.getElementById("iop-scene"),
	sceneCaption: document.getElementById("iop-scene-caption"),
	status: document.getElementById("iop-status"),
	error: document.getElementById("iop-error"),
	sliderWidget: document.getElementById("iop-slider-widget"),
	sliderInput: document.getElementById("iop-slider-input"),
};

const state = {
	monaco: null,
	editor: null,
	model: null,
	renderHandle: 0,
	ctrlDown: false,
	hoveredEditorLine: null,
	hoveredPreviewLine: null,
	hoveredPreviewKind: "",
	activeLiteral: null,
	sliderHover: false,
	hideTimer: 0,
	lastScene: [],
	lineDecorations: [],
	literalDecorations: [],
};

init();

async function init() {
	bindGlobalEvents();
	renderScene([]);

	try {
		const monaco = await loadMonaco();
		state.monaco = monaco;
		setupEditor(monaco);
		renderNotebook(true);
	} catch (error) {
		dom.editorLoading.textContent = "Editor failed to load.";
		dom.status.textContent = "The live editor could not be initialised.";
		dom.error.textContent = error instanceof Error ? error.message : String(error);
	}
}

function bindGlobalEvents() {
	window.addEventListener("keydown", (event) => {
		if (event.key === "Control") {
			state.ctrlDown = true;
			updateModifierClasses();
			syncHighlights();
		}
	});

	window.addEventListener("keyup", (event) => {
		if (event.key === "Control") {
			state.ctrlDown = false;
			state.hoveredEditorLine = null;
			updateModifierClasses();
			syncHighlights();
		}
	});

	window.addEventListener("blur", () => {
		state.ctrlDown = false;
		state.hoveredEditorLine = null;
		updateModifierClasses();
		hideLiteralWidgets();
		syncHighlights();
	});

	dom.sliderWidget.addEventListener("mouseenter", () => {
		state.sliderHover = true;
	});

	dom.sliderWidget.addEventListener("mouseleave", () => {
		state.sliderHover = false;
		queueLiteralWidgetHide();
	});

	dom.sliderInput.addEventListener("input", () => {
		if (!state.activeLiteral || state.activeLiteral.type !== "number") {
			return;
		}

		const replacement = formatNumericLiteral(Number(dom.sliderInput.value), state.activeLiteral.raw);
		replaceLiteral(state.activeLiteral, replacement);
		const updatedLiteral = findLiteralByRange(state.activeLiteral.lineNumber, state.activeLiteral.startColumn, replacement.length);
		if (updatedLiteral) {
			state.activeLiteral = updatedLiteral;
			const bounds = numericBounds(updatedLiteral.value, updatedLiteral.raw);
			dom.sliderInput.min = String(bounds.min);
			dom.sliderInput.max = String(bounds.max);
			dom.sliderInput.step = String(bounds.step);
			dom.sliderInput.value = replacement;
		}
	});
}

async function loadMonaco() {
	if (window.monaco) {
		return window.monaco;
	}

	if (!window.require) {
		await loadScript(`${MONACO_BASE_URL}/loader.min.js`);
	}

	const monacoBaseDir = MONACO_BASE_URL.replace(/\/vs\/?$/, "/");
	window.MonacoEnvironment = {
		getWorkerUrl() {
			const body = `
self.MonacoEnvironment = { baseUrl: "${monacoBaseDir}" };
importScripts("${MONACO_BASE_URL}/base/worker/workerMain.js");
`;
			return URL.createObjectURL(new Blob([body], { type: "text/javascript" }));
		},
	};

	return new Promise((resolve, reject) => {
		window.require.config({ paths: { vs: MONACO_BASE_URL } });
		window.require(
			["vs/editor/editor.main"],
			() => resolve(window.monaco),
			(error) => reject(error instanceof Error ? error : new Error(String(error)))
		);
	});
}

function loadScript(src) {
	return new Promise((resolve, reject) => {
		const script = document.createElement("script");
		script.src = src;
		script.async = true;
		script.onload = () => resolve();
		script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
		document.head.append(script);
	});
}

function setupEditor(monaco) {
	monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
		allowNonTsExtensions: true,
		checkJs: true,
		target: monaco.languages.typescript.ScriptTarget.ES2020,
	});
	monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
		noSemanticValidation: false,
		noSyntaxValidation: false,
	});
	monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);
	monaco.languages.typescript.javascriptDefaults.addExtraLib(NOTEBOOK_TYPINGS, "ts:notebook-api.d.ts");
	monaco.languages.registerCompletionItemProvider("javascript", {
		provideCompletionItems() {
			return {
				suggestions: SNIPPETS.map((snippet) => ({
					label: snippet.label,
					kind: monaco.languages.CompletionItemKind.Function,
					insertText: snippet.insertText,
					insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
					documentation: snippet.documentation,
					range: undefined,
				})),
			};
		},
	});

	monaco.editor.defineTheme("iop-paper", {
		base: "vs",
		inherit: true,
		rules: [
			{ token: "comment", foreground: "7c8f78" },
			{ token: "keyword", foreground: "8f3fb0" },
			{ token: "number", foreground: "5266d4" },
			{ token: "string", foreground: "c46b60" },
		],
		colors: {
			"editor.background": "#fdfaf5",
			"editor.foreground": "#231816",
			"editorLineNumber.foreground": "#b29a89",
			"editorLineNumber.activeForeground": "#6e5141",
			"editorCursor.foreground": "#c75832",
			"editorIndentGuide.background1": "#ece2d7",
			"editor.selectionBackground": "#f8e1c4",
			"editor.inactiveSelectionBackground": "#f6ead8",
			"editor.lineHighlightBackground": "#fff6df",
		},
	});

	state.model = monaco.editor.createModel(INITIAL_SOURCE, "javascript");
	state.editor = monaco.editor.create(dom.editor, {
		model: state.model,
		theme: "iop-paper",
		automaticLayout: true,
		fontSize: 17,
		lineHeight: 29,
		fontFamily: '"Cascadia Code", "SFMono-Regular", "Menlo", "Monaco", monospace',
		fontLigatures: true,
		minimap: { enabled: false },
		scrollBeyondLastLine: false,
		wordWrap: "on",
		padding: { top: 20, bottom: 28 },
		renderLineHighlightOnlyWhenFocus: false,
		roundedSelection: true,
		tabSize: 2,
		insertSpaces: true,
		glyphMargin: true,
		overviewRulerLanes: 0,
		contextmenu: false,
	});

	dom.editorLoading.hidden = true;

	state.editor.onDidChangeModelContent(() => {
		scheduleRender();
	});

	state.editor.onDidChangeCursorSelection(() => {
		queueLiteralWidgetHide();
	});

	state.editor.onMouseMove((event) => {
		const position = event.target.position;
		if (!position) {
			return;
		}

		if (state.ctrlDown) {
			state.hoveredEditorLine = position.lineNumber;
			syncHighlights();
		}

		const literal = findHoverLiteral(position);
		if (literal && literal.type === "number") {
			showLiteralWidget(literal);
		} else {
			queueLiteralWidgetHide();
		}
	});

	state.editor.onMouseLeave(() => {
		state.hoveredEditorLine = null;
		queueLiteralWidgetHide();
		syncHighlights();
	});
}

function scheduleRender() {
	window.clearTimeout(state.renderHandle);
	state.renderHandle = window.setTimeout(() => {
		renderNotebook(false);
	}, 80);
}

function renderNotebook(initialRender) {
	if (!state.model) {
		return;
	}

	const notebook = createNotebook();
	const source = state.model.getValue();
	const startedAt = performance.now();

	try {
		runNotebook(source, notebook);
		state.lastScene = notebook.scene;
		renderScene(notebook.scene);
		clearMarkers();
		dom.error.textContent = "";
		const took = Math.round(performance.now() - startedAt);
		dom.status.textContent = initialRender ? "Notebook ready. Type to redraw the scene live." : `Redrew ${notebook.scene.length} shapes in ${took} ms.`;
	} catch (error) {
		setMarkersFromError(error);
		dom.error.textContent = formatError(error);
		dom.status.textContent = "Render failed. The last good scene stays visible while you fix the code.";
	}
}

function runNotebook(source, notebook) {
	const executable = `with (Notebook) {\n${source}\n}\n//# sourceURL=${USER_SOURCE_ID}`;
	const fn = new Function("Notebook", executable);
	fn(notebook);
}

function createNotebook() {
	const scene = [];
	let seed = 1;

	function currentLine() {
		const stack = new Error().stack ?? "";
		const frames = stack.split("\n");

		for (const frame of frames) {
			if (!frame.includes(USER_SOURCE_ID)) {
				continue;
			}

			const match = frame.match(/:(\d+):(\d+)\)?$/);
			if (!match) {
				continue;
			}

			return Math.max(1, Number(match[1]) - USER_SOURCE_LINE_OFFSET);
		}

		return null;
	}

	function random(min = 0, max = 1) {
		seed = (seed * 1664525 + 1013904223) >>> 0;
		const t = seed / 4294967296;
		return min + (max - min) * t;
	}

	function pushShape(shape) {
		scene.push({ ...shape, line: currentLine() });
	}

	return {
		width: SCENE_WIDTH,
		height: SCENE_HEIGHT,
		circle(cx, cy, radius, options = {}) {
			pushShape({
				type: "circle",
				cx,
				cy,
				radius,
				fill: options.fill ?? "#000000",
				stroke: options.stroke ?? "none",
				strokeWidth: options.strokeWidth ?? 0,
				opacity: options.opacity ?? 1,
			});
		},
		polygon(points, options = {}) {
			pushShape({
				type: "polygon",
				points,
				fill: options.fill ?? "#000000",
				stroke: options.stroke ?? "none",
				strokeWidth: options.strokeWidth ?? 0,
				opacity: options.opacity ?? 1,
			});
		},
		polyline(points, options = {}) {
			pushShape({
				type: "polyline",
				points,
				fill: "none",
				stroke: options.stroke ?? "#000000",
				strokeWidth: options.strokeWidth ?? 1,
				opacity: options.opacity ?? 1,
			});
		},
		branch(x1, y1, x2, y2, width, options = {}) {
			const dx = x2 - x1;
			const dy = y2 - y1;
			const length = Math.max(1, Math.hypot(dx, dy));
			const nx = -dy / length;
			const ny = dx / length;
			const taper = clamp(options.taper ?? 0.22, 0.02, 1);
			const startHalf = width / 2;
			const endHalf = Math.max(1.2, (width * taper) / 2);
			const points = [
				[x1 + nx * startHalf, y1 + ny * startHalf],
				[x1 - nx * startHalf, y1 - ny * startHalf],
				[x2 - nx * endHalf, y2 - ny * endHalf],
				[x2 + nx * endHalf, y2 + ny * endHalf],
			];

			pushShape({
				type: "polygon",
				points,
				fill: options.fill ?? "#000000",
				stroke: options.stroke ?? "none",
				strokeWidth: options.strokeWidth ?? 0,
				opacity: options.opacity ?? 1,
			});
		},
		gradientRect(x, y, width, height, stops, options = {}) {
			pushShape({
				type: "gradientRect",
				x,
				y,
				width,
				height,
				stops,
				opacity: options.opacity ?? 1,
			});
		},
		resetRandom(nextSeed = 1) {
			seed = Number.isFinite(nextSeed) ? nextSeed >>> 0 : 1;
		},
		random,
		lerp,
		mix,
		clamp,
		scene,
	};
}

function renderScene(scene) {
	dom.scene.replaceChildren();
	dom.scene.setAttribute("viewBox", `0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`);

	const defs = document.createElementNS(SVG_NS, "defs");
	dom.scene.append(defs);

	scene.forEach((shape, index) => {
		let element = null;

		if (shape.type === "gradientRect") {
			const gradientId = `iop-gradient-${index}`;
			const gradient = document.createElementNS(SVG_NS, "linearGradient");
			gradient.id = gradientId;
			gradient.setAttribute("x1", "0%");
			gradient.setAttribute("y1", "0%");
			gradient.setAttribute("x2", "0%");
			gradient.setAttribute("y2", "100%");

			shape.stops.forEach(([offset, color]) => {
				const stop = document.createElementNS(SVG_NS, "stop");
				stop.setAttribute("offset", `${offset * 100}%`);
				stop.setAttribute("stop-color", color);
				gradient.append(stop);
			});

			defs.append(gradient);

			element = document.createElementNS(SVG_NS, "rect");
			element.setAttribute("x", String(shape.x));
			element.setAttribute("y", String(shape.y));
			element.setAttribute("width", String(shape.width));
			element.setAttribute("height", String(shape.height));
			element.setAttribute("fill", `url(#${gradientId})`);
			element.setAttribute("stroke", "none");
		}

		if (shape.type === "polygon") {
			element = document.createElementNS(SVG_NS, "polygon");
			element.setAttribute("points", stringifyPoints(shape.points));
			element.setAttribute("fill", shape.fill);
			element.setAttribute("stroke", shape.stroke);
			element.setAttribute("stroke-width", String(shape.strokeWidth));
		}

		if (shape.type === "polyline") {
			element = document.createElementNS(SVG_NS, "polyline");
			element.setAttribute("points", stringifyPoints(shape.points));
			element.setAttribute("fill", "none");
			element.setAttribute("stroke", shape.stroke);
			element.setAttribute("stroke-width", String(shape.strokeWidth));
			element.setAttribute("stroke-linecap", "round");
			element.setAttribute("stroke-linejoin", "round");
		}

		if (shape.type === "circle") {
			element = document.createElementNS(SVG_NS, "circle");
			element.setAttribute("cx", String(shape.cx));
			element.setAttribute("cy", String(shape.cy));
			element.setAttribute("r", String(shape.radius));
			element.setAttribute("fill", shape.fill);
			element.setAttribute("stroke", shape.stroke);
			element.setAttribute("stroke-width", String(shape.strokeWidth));
		}

		if (!element) {
			return;
		}

		element.classList.add("scene-shape");
		element.dataset.kind = shape.type;
		if (shape.line) {
			element.dataset.line = String(shape.line);
		}

		if (shape.opacity !== undefined) {
			element.setAttribute("opacity", String(shape.opacity));
		}

		element.addEventListener("pointerenter", () => {
			state.hoveredPreviewLine = shape.line ?? null;
			state.hoveredPreviewKind = shape.type;
			if (shape.line) {
				dom.sceneCaption.textContent = `Preview linked to code line ${shape.line}.`;
			}
			syncHighlights();
		});

		element.addEventListener("pointerleave", () => {
			state.hoveredPreviewLine = null;
			state.hoveredPreviewKind = "";
			dom.sceneCaption.textContent = "Hover branches or blossoms to reveal their code.";
			syncHighlights();
		});

		element.addEventListener("click", () => {
			if (!shape.line || !state.editor) {
				return;
			}

			state.editor.revealLineInCenter(shape.line);
			state.editor.setPosition({ lineNumber: shape.line, column: 1 });
			state.editor.focus();
		});

		dom.scene.append(element);
	});

	syncHighlights();
}

function syncHighlights() {
	if (!state.editor || !state.monaco) {
		return;
	}

	const activeLine = state.hoveredPreviewLine ?? (state.ctrlDown ? state.hoveredEditorLine : null);
	const literalRange = state.activeLiteral ? new state.monaco.Range(state.activeLiteral.lineNumber, state.activeLiteral.startColumn, state.activeLiteral.lineNumber, state.activeLiteral.endColumn) : null;

	state.lineDecorations = state.editor.deltaDecorations(
		state.lineDecorations,
		activeLine
			? [
					{
						range: new state.monaco.Range(activeLine, 1, activeLine, 1),
						options: {
							isWholeLine: true,
							className: "iop-code-line-decoration",
							linesDecorationsClassName: "iop-code-glyph-decoration",
						},
					},
				]
			: []
	);

	state.literalDecorations = state.editor.deltaDecorations(
		state.literalDecorations,
		literalRange
			? [
					{
						range: literalRange,
						options: { inlineClassName: "iop-code-token-decoration" },
					},
				]
			: []
	);

	const shapeNodes = dom.scene.querySelectorAll(".scene-shape");
	shapeNodes.forEach((node) => {
		const line = Number(node.dataset.line || 0);
		const linked = Boolean(activeLine) && line === activeLine;
		node.classList.toggle("is-linked", linked);
		node.classList.toggle("is-inspected", linked && state.ctrlDown);
	});

	if (activeLine) {
		dom.status.textContent = state.ctrlDown ? `Inspecting line ${activeLine}${state.hoveredPreviewKind ? ` via ${state.hoveredPreviewKind}` : ""}.` : `Preview linked to line ${activeLine}.`;
	}
}

function findLiteralAtPosition(position) {
	return findLiteralNearPosition(position);
}

function findHoverLiteral(position) {
	if (state.activeLiteral?.lineNumber === position.lineNumber) {
		const retainedLiteral = findLiteralNearPosition(position, {
			proximity: ACTIVE_LITERAL_HOVER_SLOP,
			preferredLiteral: state.activeLiteral,
		});
		if (retainedLiteral) {
			return retainedLiteral;
		}
	}

	return findLiteralNearPosition(position, { proximity: LITERAL_HOVER_SLOP });
}

function findLiteralNearPosition(position, options = {}) {
	const lineText = state.model.getLineContent(position.lineNumber);
	const columnIndex = position.column - 1;
	const proximity = options.proximity ?? 0;
	const literals = [...scanColorLiterals(lineText, position.lineNumber), ...scanNumberLiterals(lineText, position.lineNumber)];

	if (!literals.length) {
		return null;
	}

	const exactMatch = literals.find((literal) => columnIndex >= literal.startIndex && columnIndex < literal.endIndex);
	if (exactMatch) {
		return exactMatch;
	}

	if (options.preferredLiteral) {
		const preferredMatch = literals.find((literal) => literal.type === options.preferredLiteral.type && literal.startColumn === options.preferredLiteral.startColumn && literal.endColumn === options.preferredLiteral.endColumn);

		if (preferredMatch && literalColumnDistance(preferredMatch, columnIndex) <= proximity) {
			return preferredMatch;
		}
	}

	if (proximity <= 0) {
		return null;
	}

	const nearbyLiterals = literals
		.map((literal) => ({ literal, distance: literalColumnDistance(literal, columnIndex) }))
		.filter((candidate) => candidate.distance <= proximity)
		.sort((left, right) => left.distance - right.distance || left.literal.startIndex - right.literal.startIndex);

	return nearbyLiterals[0]?.literal ?? null;
}

function literalColumnDistance(literal, columnIndex) {
	if (columnIndex < literal.startIndex) {
		return literal.startIndex - columnIndex;
	}

	if (columnIndex >= literal.endIndex) {
		return columnIndex - literal.endIndex + 1;
	}

	return 0;
}

function showLiteralWidget(literal) {
	if (state.hideTimer) {
		window.clearTimeout(state.hideTimer);
		state.hideTimer = 0;
	}

	state.activeLiteral = literal;
	syncHighlights();

	if (literal.type === "number") {
		const bounds = numericBounds(literal.value, literal.raw);
		dom.sliderInput.min = String(bounds.min);
		dom.sliderInput.max = String(bounds.max);
		dom.sliderInput.step = String(bounds.step);
		dom.sliderInput.value = literal.raw;
		positionWidget(dom.sliderWidget, literal);
		dom.sliderWidget.hidden = false;
	}
}

function hideLiteralWidgets() {
	state.activeLiteral = null;
	dom.sliderWidget.hidden = true;
	syncHighlights();
}

function queueLiteralWidgetHide() {
	if (state.hideTimer) {
		window.clearTimeout(state.hideTimer);
	}

	state.hideTimer = window.setTimeout(() => {
		state.hideTimer = 0;
		if (state.sliderHover) {
			return;
		}

		hideLiteralWidgets();
	}, 400);
}

function positionWidget(widget, literal) {
	const editorPosition = state.editor.getScrolledVisiblePosition({
		lineNumber: literal.lineNumber,
		column: literal.startColumn,
	});

	if (!editorPosition) {
		return;
	}

	const codeRect = dom.codePage.getBoundingClientRect();
	const editorRect = dom.editor.getBoundingClientRect();
	const widgetRect = widget.getBoundingClientRect();
	const left = editorRect.left - codeRect.left + editorPosition.left;
	const widgetHeight = Math.max(widgetRect.height, 40);
	const top = editorRect.top - codeRect.top + editorPosition.top - widgetHeight - 6;
	const maxLeft = dom.codePage.clientWidth - Math.max(widgetRect.width, 220) - 24;

	widget.style.left = `${Math.max(16, Math.min(left, maxLeft))}px`;
	widget.style.top = `${top}px`;
}

function replaceLiteral(literal, replacement) {
	const range = new state.monaco.Range(literal.lineNumber, literal.startColumn, literal.lineNumber, literal.endColumn);
	state.editor.executeEdits("literal-widget", [{ range, text: replacement }]);
	state.editor.focus();
	scheduleRender();
}

function findLiteralByRange(lineNumber, startColumn, replacementLength) {
	const position = {
		lineNumber,
		column: startColumn + Math.max(0, replacementLength - 1),
	};
	return findLiteralAtPosition(position);
}

function numericBounds(value, raw) {
	const integer = /^-?\d+$/.test(raw);
	const decimals = raw.includes(".") ? raw.split(".")[1].length : 0;
	const absVal = Math.abs(value);
	const magnitude = absVal < 1e-9 ? 1 : 10 ** (Math.floor(Math.log10(absVal)) + 1);
	const span = magnitude * 1.5;
	const step = integer ? 1 : 10 ** -Math.min(Math.max(decimals, 2), 4);
	return {
		min: roundTo(value - span, step),
		max: roundTo(value + span, step),
		step,
	};
}

function formatNumericLiteral(value, raw) {
	if (/^-?\d+$/.test(raw)) {
		return String(Math.round(value));
	}

	const decimals = raw.includes(".") ? raw.split(".")[1].length : 2;
	return Number(value)
		.toFixed(Math.min(Math.max(decimals, 2), 4))
		.replace(/0+$/, "")
		.replace(/\.$/, "");
}

function scanColorLiterals(lineText, lineNumber) {
	const results = [];
	const regex = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g;
	let match = regex.exec(lineText);

	while (match) {
		results.push({
			type: "color",
			raw: match[0],
			lineNumber,
			startIndex: match.index,
			endIndex: match.index + match[0].length,
			startColumn: match.index + 1,
			endColumn: match.index + match[0].length + 1,
			value: match[0],
		});
		match = regex.exec(lineText);
	}

	return results;
}

function scanNumberLiterals(lineText, lineNumber) {
	const results = [];
	const regex = /-?(?:\d+\.\d+|\d+|\.\d+)/g;
	let match = regex.exec(lineText);

	while (match) {
		const raw = match[0];
		const startIndex = match.index;
		const endIndex = startIndex + raw.length;
		const before = lineText[startIndex - 1] ?? "";
		const after = lineText[endIndex] ?? "";

		if (/[A-Za-z0-9_$#]/.test(before) || /[A-Za-z0-9_$]/.test(after)) {
			match = regex.exec(lineText);
			continue;
		}

		results.push({
			type: "number",
			raw,
			value: Number(raw),
			lineNumber,
			startIndex,
			endIndex,
			startColumn: startIndex + 1,
			endColumn: endIndex + 1,
		});

		match = regex.exec(lineText);
	}

	return results;
}

function setMarkersFromError(error) {
	if (!state.monaco || !state.model) {
		return;
	}

	const lineMatch = String(error?.stack ?? "").match(new RegExp(`${USER_SOURCE_ID}:(\\d+):(\\d+)`));
	const lineNumber = lineMatch ? Math.max(1, Number(lineMatch[1]) - USER_SOURCE_LINE_OFFSET) : 1;
	const column = lineMatch ? Number(lineMatch[2]) : 1;

	state.monaco.editor.setModelMarkers(state.model, "iop-runtime", [
		{
			startLineNumber: lineNumber,
			startColumn: column,
			endLineNumber: lineNumber,
			endColumn: column + 1,
			message: formatError(error),
			severity: state.monaco.MarkerSeverity.Error,
		},
	]);
}

function clearMarkers() {
	if (!state.monaco || !state.model) {
		return;
	}

	state.monaco.editor.setModelMarkers(state.model, "iop-runtime", []);
}

function formatError(error) {
	if (error instanceof Error) {
		return error.message;
	}

	return String(error);
}

function updateModifierClasses() {
	dom.page.classList.toggle("is-inspecting", state.ctrlDown);
}

function stringifyPoints(points) {
	return points.map(([x, y]) => `${x},${y}`).join(" ");
}

function normaliseColor(color) {
	if (color.length === 4) {
		return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`.toLowerCase();
	}

	return color.toLowerCase();
}

function roundTo(value, step) {
	if (!step) {
		return value;
	}

	return Math.round(value / step) * step;
}

function lerp(start, end, t) {
	return start + (end - start) * t;
}

function mix(value, inMin, inMax, outMin, outMax) {
	if (inMax === inMin) {
		return outMin;
	}

	return lerp(outMin, outMax, (value - inMin) / (inMax - inMin));
}

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}
