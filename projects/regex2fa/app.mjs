import { tokenizeRegex, addExplicitConcat, infixToPostfix } from "./parser.mjs";
import { buildNfa, buildDfa, minimizeDfa } from "./automata.mjs";
import { createRenderer } from "./render.mjs";

const regexInput = document.getElementById("regexInput");
const renderButton = document.getElementById("renderRegexBtn");
const loadExampleButton = document.getElementById("loadExampleBtn");
const clearButton = document.getElementById("clearRegexBtn");
const viewMode = document.getElementById("viewMode");
const epsilonInput = document.getElementById("epsilonSymbol");
const showInternalsInput = document.getElementById("showInternals");
const internals = document.getElementById("regex2faInternals");
const rawTokensDebug = document.getElementById("rawTokensDebug");
const concatTokensDebug = document.getElementById("concatTokensDebug");
const postfixDebug = document.getElementById("postfixDebug");
const status = document.getElementById("regex2faStatus");
const canvas = document.getElementById("automatonCanvas");
const stepRegexBody = document.getElementById("stepRegexBody");
const stepPostfixBody = document.getElementById("stepPostfixBody");
const stepNfaBody = document.getElementById("stepNfaBody");
const stepDfaBody = document.getElementById("stepDfaBody");
const stepMinDfaBody = document.getElementById("stepMinDfaBody");
const stepRegex = document.getElementById("step-regex");
const stepPostfix = document.getElementById("step-postfix");
const stepNfa = document.getElementById("step-nfa");
const stepDfa = document.getElementById("step-dfa");
const stepMinDfa = document.getElementById("step-min-dfa");

if (
	!regexInput ||
	!renderButton ||
	!loadExampleButton ||
	!clearButton ||
	!viewMode ||
	!epsilonInput ||
	!showInternalsInput ||
	!internals ||
	!rawTokensDebug ||
	!concatTokensDebug ||
	!postfixDebug ||
	!status ||
	!canvas ||
	!stepRegexBody ||
	!stepPostfixBody ||
	!stepNfaBody ||
	!stepDfaBody ||
	!stepMinDfaBody ||
	!stepRegex ||
	!stepPostfix ||
	!stepNfa ||
	!stepDfa ||
	!stepMinDfa
) {
	throw new Error("Regex2FA: required DOM nodes are missing.");
}

const renderer = createRenderer(canvas);
let currentModels = null;

function setStatus(message, tone = "info") {
	status.textContent = message;
	status.dataset.tone = tone;
}

function updateInternals(data) {
	rawTokensDebug.textContent = JSON.stringify(data.rawTokens);
	concatTokensDebug.textContent = JSON.stringify(data.concatTokens);
	postfixDebug.textContent = data.postfixTokens.join(" ");
}

function clearInternals() {
	rawTokensDebug.textContent = "";
	concatTokensDebug.textContent = "";
	postfixDebug.textContent = "";
}

function updateSteps(data) {
	stepRegexBody.textContent = data.regex ? `Input: ${data.regex}\nRaw tokens: ${JSON.stringify(data.rawTokens)}` : "Enter a regex to begin.";
	stepPostfixBody.textContent = data.regex ? `With concat: ${data.concatTokens.join(" ")}\nPostfix: ${data.postfixTokens.join(" ")}` : "Nothing parsed yet.";
	stepNfaBody.textContent = data.nfa ? `${data.nfa.states.size} states, start q${data.nfa.startStateId}, accept {${[...data.nfa.acceptStateIds].join(", ")}}` : "No NFA built yet.";
	stepDfaBody.textContent = data.dfa ? `${data.dfa.states.size} states, start q${data.dfa.startStateId}, accept {${[...data.dfa.acceptStateIds].join(", ")}}` : "No DFA built yet.";
	stepMinDfaBody.textContent = data.minDfa ? `${data.minDfa.states.size} states, start q${data.minDfa.startStateId}, accept {${[...data.minDfa.acceptStateIds].join(", ")}}` : "No minimized DFA built yet.";
}

function setActiveStep() {
	[stepRegex, stepPostfix, stepNfa, stepDfa, stepMinDfa].forEach((node) => node.classList.remove("is-active"));
	if (viewMode.value === "min-dfa") {
		stepMinDfa.classList.add("is-active");
		return;
	}
	if (viewMode.value === "dfa") {
		stepDfa.classList.add("is-active");
		return;
	}
	stepNfa.classList.add("is-active");
}

function renderCurrentView() {
	if (!currentModels) return;
	const automaton = viewMode.value === "min-dfa" ? currentModels.minDfa : viewMode.value === "dfa" ? currentModels.dfa : currentModels.nfa;
	renderer.draw(automaton);
	setActiveStep();
	const noun = viewMode.value === "min-dfa" ? "minimized DFA" : viewMode.value === "dfa" ? "DFA" : "NFA";
	setStatus(`Rendered ${noun} with ${automaton.states.size} state${automaton.states.size === 1 ? "" : "s"}.`);
}

function parseAndBuild() {
	const regex = regexInput.value.trim();
	if (!regex) {
		currentModels = null;
		renderer.draw(null);
		clearInternals();
		updateSteps({ regex: "" });
		setStatus("Please enter a regex.", "error");
		return;
	}

	try {
		const epsilon = epsilonInput.value || "ε";
		const rawTokens = tokenizeRegex(regex);
		const concatTokens = addExplicitConcat(rawTokens);
		const postfixTokens = infixToPostfix(concatTokens);
		const nfa = buildNfa(postfixTokens, epsilon);
		const dfa = buildDfa(nfa, epsilon);
		const minDfa = minimizeDfa(dfa, epsilon);
		currentModels = { nfa, dfa, minDfa };
		updateInternals({ rawTokens, concatTokens, postfixTokens });
		updateSteps({ regex, rawTokens, concatTokens, postfixTokens, nfa, dfa, minDfa });
		renderCurrentView();
	} catch (error) {
		currentModels = null;
		renderer.draw(null);
		updateSteps({ regex });
		setStatus(error.message, "error");
	}
}

renderButton.addEventListener("click", parseAndBuild);
loadExampleButton.addEventListener("click", () => {
	regexInput.value = "(a|b)*cde+f?";
	parseAndBuild();
});
clearButton.addEventListener("click", () => {
	regexInput.value = "";
	currentModels = null;
	renderer.draw(null);
	clearInternals();
	updateSteps({ regex: "" });
	setStatus("");
});

viewMode.addEventListener("change", () => {
	if (currentModels) {
		renderCurrentView();
	}
});

epsilonInput.addEventListener("change", () => {
	if (currentModels) {
		parseAndBuild();
	}
});

showInternalsInput.addEventListener("change", () => {
	internals.hidden = !showInternalsInput.checked;
});

window.addEventListener("resize", () => {
	renderer.redraw();
});

setStatus("Ready. Enter a regex and render its NFA or DFA.");
updateSteps({ regex: "" });
