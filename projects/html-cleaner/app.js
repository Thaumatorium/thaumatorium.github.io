import { cleanHtml, formatHtml, PROFILES, validateHtmlFragment } from "./cleaner.js";

const $ = (id) => document.getElementById(id);
const elements = {
	input: $("htmlCleanerInput"),
	inputStack: $("htmlCleanerInputStack"),
	inputHighlight: $("htmlCleanerInputHighlight"),
	output: $("htmlCleanerOutput"),
	outputStack: $("htmlCleanerOutputStack"),
	outputWrap: $("htmlCleanerOutputWrap"),
	outputHighlight: $("htmlCleanerOutputHighlight"),
	profile: $("htmlCleanerProfile"),
	run: $("htmlCleanerRun"),
	formatted: $("htmlCleanerFormatted"),
	reset: $("htmlCleanerReset"),
	validity: $("htmlCleanerValidity"),
	w3cValidate: $("htmlCleanerW3cValidate"),
	characters: $("htmlCleanerCharacters"),
	tokens: $("htmlCleanerTokens"),
	reduction: $("htmlCleanerReduction"),
	tokensSaved: $("htmlCleanerTokensSaved"),
	compressionRatio: $("htmlCleanerCompressionRatio"),
	elementsRemoved: $("htmlCleanerElementsRemoved"),
	status: $("htmlCleanerStatus"),
};

const optionInputs = [...document.querySelectorAll("[data-option]")];
let tokenizer = null;
let tokenRequestId = 0;
let debounceTimer = null;
const pendingTokenCounts = new Map();
let lastCleanHtml = "";
let currentOutputHtml = "";
let exampleDismissed = false;
const STORAGE_KEY = "thaumatorium.html-cleaner.v1";

const SOURCE_EXAMPLE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="description" content="Example page">
    <title>HTML cleaning example</title>
    <style>.highlight { color: red; font-size: 2rem; }</style>
    <script>analytics.track("page-view");</script>
  </head>
  <body class="website" data-theme="light">
    <nav id="main-navigation"><a href="/">Home</a> · <a href="/pricing">Pricing</a></nav>
    <main id="content" class="page-content">
      <article class="post" itemscope>
        <h1 class="highlight" style="color: red">Cleaning HTML for LLMs</h1>
        <!-- This editorial comment is not useful to the model. -->
        <div class="intro-wrapper">
          <p>Keep <strong>meaningful content</strong>, but remove presentation markup.</p>
          <img src="large-hero-image.jpg" width="1600" height="900" alt="HTML entering a cleaning pipeline">
        </div>
        <h2>What should remain?</h2>
        <ul class="feature-list">
          <li>Headings and paragraphs</li>
          <li>Lists, <span class="emphasis">tables</span>, and code</li>
        </ul>
        <table class="comparison" style="width: 100%">
          <tr><th colspan="2">Token comparison</th></tr>
          <tr><td>Before</td><td>Many tokens</td></tr>
          <tr><td>After</td><td>Fewer tokens</td></tr>
        </table>
        <pre class="code"><code>const cleaned = cleanHtml(source);</code></pre>
        <p><a href="javascript:alert('nope')" onclick="trackClick()">Unsafe link target</a></p>
        <script>renderAdvertisement();</script>
      </article>
    </main>
    <aside>Related posts and advertising</aside>
    <form><label>Email <input type="email"></label><button>Subscribe</button></form>
    <footer>Copyright, privacy policy, and social links</footer>
  </body>
</html>`;

function setStatus(message, tone = "info") {
	elements.status.textContent = message;
	elements.status.dataset.tone = tone;
}

function highlightHtml(text, target) {
	target.innerHTML = window.hljs.highlight("html", text || " ", true).value;
}

function syncHighlightScroll(textarea, highlight) {
	highlight.parentElement.scrollTop = textarea.scrollTop;
	highlight.parentElement.scrollLeft = textarea.scrollLeft;
}

function setWrapping(stack, enabled) {
	stack.classList.toggle("is-wrapped", enabled);
}

function updateValidity(html) {
	const result = validateHtmlFragment(html);
	elements.validity.dataset.valid = String(result.valid);
	elements.validity.textContent = result.valid ? "Valid fragment" : "Browser repaired fragment";
	elements.validity.title = result.valid ? "The fragment survives a browser parse/serialize round trip unchanged." : "The browser changes this fragment while parsing it; use W3C validate for details.";
}

function validateWithW3c() {
	if (!currentOutputHtml) {
		setStatus("There is no cleaned HTML to validate.", "error");
		return;
	}
	const form = document.createElement("form");
	form.method = "post";
	form.action = "https://validator.w3.org/nu/?showsource=yes";
	form.target = "_blank";
	form.enctype = "multipart/form-data";
	form.acceptCharset = "utf-8";
	form.hidden = true;
	const content = document.createElement("textarea");
	content.name = "content";
	content.value = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Cleaned HTML validation</title></head><body>${currentOutputHtml}</body></html>`;
	form.append(content);
	document.body.append(form);
	form.submit();
	form.remove();
	setStatus("Cleaned HTML sent to the external W3C Nu HTML Checker.");
}

function savedState() {
	return {
		input: elements.input.value,
		profile: elements.profile.value,
		outputWrap: elements.outputWrap.checked,
		options: Object.fromEntries(optionInputs.map((input) => [input.dataset.option, input.checked])),
	};
}

function persistState() {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(savedState()));
	} catch {
		setStatus("Browser storage is unavailable; this input cannot be restored after refresh.", "error");
	}
}

function restoreState() {
	let state;
	try {
		state = JSON.parse(localStorage.getItem(STORAGE_KEY));
	} catch {
		return false;
	}
	if (!state || typeof state !== "object") return false;
	if (Object.hasOwn(PROFILES, state.profile)) elements.profile.value = state.profile;
	syncProfileOptions();
	if (state.options && typeof state.options === "object") {
		for (const input of optionInputs) {
			if (typeof state.options[input.dataset.option] === "boolean") input.checked = state.options[input.dataset.option];
		}
	}
	elements.formatted.checked = true;
	elements.outputWrap.checked = state.outputWrap !== false;
	setWrapping(elements.outputStack, elements.outputWrap.checked);
	if (typeof state.input !== "string" || !state.input) return false;
	exampleDismissed = true;
	elements.input.value = state.input;
	elements.inputStack.classList.remove("is-example");
	elements.outputStack.classList.remove("is-example");
	highlightHtml(state.input, elements.inputHighlight);
	runCleaner();
	return true;
}

function resetApplication() {
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		// The in-memory reset still works when storage access is unavailable.
	}
	clearTimeout(debounceTimer);
	exampleDismissed = false;
	elements.input.value = "";
	elements.output.value = "";
	currentOutputHtml = "";
	elements.profile.value = "balanced";
	elements.formatted.checked = true;
	elements.outputWrap.checked = true;
	setWrapping(elements.outputStack, true);
	syncProfileOptions();
	elements.inputStack.classList.add("is-example");
	elements.outputStack.classList.add("is-example");
	renderSourceExample();
}

function resetStatistics() {
	tokenRequestId += 1;
	pendingTokenCounts.clear();
	elements.characters.textContent = "0 → 0";
	elements.tokens.textContent = "0 → 0";
	elements.reduction.textContent = "0%";
	elements.tokensSaved.textContent = "0";
	elements.compressionRatio.textContent = "0×";
	elements.elementsRemoved.textContent = "0";
	setStatus("");
}

function dismissSourceExample() {
	if (exampleDismissed) return;
	exampleDismissed = true;
	elements.inputStack.classList.remove("is-example");
	elements.outputStack.classList.remove("is-example");
	if (!elements.input.value) highlightHtml("", elements.inputHighlight);
	if (!elements.output.value) highlightHtml("", elements.outputHighlight);
	currentOutputHtml = "";
	updateValidity("");
	resetStatistics();
}

function renderSourceExample() {
	const result = cleanHtml(SOURCE_EXAMPLE, profileOptions());
	const output = elements.formatted.checked ? formatHtml(result.html) : result.html;
	lastCleanHtml = result.html;
	currentOutputHtml = output;
	highlightHtml(SOURCE_EXAMPLE, elements.inputHighlight);
	highlightHtml(output, elements.outputHighlight);
	updateValidity(output);
	elements.characters.textContent = `${SOURCE_EXAMPLE.length.toLocaleString()} → ${output.length.toLocaleString()}`;
	elements.elementsRemoved.textContent = result.stats.elementsRemoved.toLocaleString();
	elements.reduction.textContent = "Counting…";
	elements.tokensSaved.textContent = "Counting…";
	elements.compressionRatio.textContent = "Counting…";
	countTokens(SOURCE_EXAMPLE, output);
	setStatus(`Example preview using the ${elements.profile.options[elements.profile.selectedIndex].text} profile.`);
}

function cleanCurrentInput() {
	if (exampleDismissed) runCleaner();
	else renderSourceExample();
}

function profileOptions() {
	const selected = PROFILES[elements.profile.value] || PROFILES.balanced;
	return { ...selected, ...Object.fromEntries(optionInputs.map((input) => [input.dataset.option, input.checked])) };
}

function syncProfileOptions() {
	const selected = PROFILES[elements.profile.value] || PROFILES.balanced;
	for (const input of optionInputs) input.checked = Boolean(selected[input.dataset.option]);
}

function ensureTokenizer() {
	if (!tokenizer) {
		tokenizer = new Worker("./tokenizer.bundle.js", { type: "module" });
		tokenizer.addEventListener("message", (event) => {
			const requestId = Math.abs(event.data.id);
			const request = pendingTokenCounts.get(requestId);
			if (!request) return;
			if (event.data.error) {
				pendingTokenCounts.delete(requestId);
				if (requestId === tokenRequestId) {
					elements.tokens.textContent = "Unavailable";
					setStatus(`Cleaned, but token counting failed: ${event.data.error}`, "error");
				}
				return;
			}
			request.counts.set(event.data.id, event.data.tokens);
			if (request.counts.size !== 2) return;
			pendingTokenCounts.delete(requestId);
			if (requestId !== tokenRequestId) return;
			const before = request.counts.get(requestId);
			const after = request.counts.get(-requestId);
			const reduction = before ? Math.max(0, ((before - after) / before) * 100) : 0;
			const tokensSaved = Math.max(0, before - after);
			const compressionRatio = after ? before / after : 0;
			elements.tokens.textContent = `${before.toLocaleString()} → ${after.toLocaleString()}`;
			elements.reduction.textContent = `${reduction.toFixed(1)}%`;
			elements.tokensSaved.textContent = tokensSaved.toLocaleString();
			elements.compressionRatio.textContent = `${compressionRatio.toFixed(2)}×`;
		});
	}
	return tokenizer;
}

function countTokens(input, output) {
	const requestId = ++tokenRequestId;
	elements.tokens.textContent = "Counting…";
	const worker = ensureTokenizer();
	pendingTokenCounts.clear();
	pendingTokenCounts.set(requestId, { counts: new Map() });
	worker.postMessage({ id: requestId, text: input });
	worker.postMessage({ id: -requestId, text: output });
}

function runCleaner() {
	const input = elements.input.value;
	const result = cleanHtml(input, profileOptions());
	lastCleanHtml = result.html;
	const output = elements.formatted.checked ? formatHtml(lastCleanHtml) : lastCleanHtml;
	currentOutputHtml = output;
	elements.output.value = output;
	highlightHtml(input, elements.inputHighlight);
	highlightHtml(output, elements.outputHighlight);
	updateValidity(output);
	elements.characters.textContent = `${result.stats.inputCharacters.toLocaleString()} → ${output.length.toLocaleString()}`;
	elements.elementsRemoved.textContent = result.stats.elementsRemoved.toLocaleString();
	elements.reduction.textContent = input ? "Counting…" : "0%";
	elements.tokensSaved.textContent = input ? "Counting…" : "0";
	elements.compressionRatio.textContent = input ? "Counting…" : "0×";
	if (!input) {
		elements.tokens.textContent = "0 → 0";
		setStatus("");
		return;
	}
	countTokens(input, output);
	setStatus(result.warnings[0] || `Cleaned with the ${elements.profile.options[elements.profile.selectedIndex].text} profile.`, result.warnings.length ? "error" : "info");
}

function scheduleClean() {
	clearTimeout(debounceTimer);
	debounceTimer = setTimeout(runCleaner, 300);
}

elements.profile.addEventListener("change", () => {
	syncProfileOptions();
	persistState();
	cleanCurrentInput();
});
optionInputs.forEach((input) =>
	input.addEventListener("change", () => {
		persistState();
		cleanCurrentInput();
	})
);
elements.input.addEventListener("input", () => {
	dismissSourceExample();
	highlightHtml(elements.input.value, elements.inputHighlight);
	persistState();
	scheduleClean();
});
elements.input.addEventListener("focus", dismissSourceExample);
elements.input.addEventListener("scroll", () => syncHighlightScroll(elements.input, elements.inputHighlight));
elements.output.addEventListener("scroll", () => syncHighlightScroll(elements.output, elements.outputHighlight));
elements.outputWrap.addEventListener("change", () => {
	setWrapping(elements.outputStack, elements.outputWrap.checked);
	persistState();
});
elements.run.addEventListener("click", cleanCurrentInput);
elements.formatted.addEventListener("change", () => {
	persistState();
	cleanCurrentInput();
});
elements.reset.addEventListener("click", resetApplication);
elements.w3cValidate.addEventListener("click", validateWithW3c);
syncProfileOptions();
if (!restoreState()) renderSourceExample();
