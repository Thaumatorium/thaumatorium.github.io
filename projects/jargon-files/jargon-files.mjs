const statusEl = document.querySelector("#jargon-status");
const resultsMetaEl = document.querySelector("#jargon-results-meta");
const resultsListEl = document.querySelector("#jargon-results-list");
const detailCardEl = document.querySelector("#jargon-detail-card");
const searchInputEl = document.querySelector("#jargon-search");
const randomButtonEl = document.querySelector("#jargon-random");
const clearButtonEl = document.querySelector("#jargon-clear");

const state = {
	data: null,
	query: "",
	filteredEntries: [],
	selectedIndex: -1,
};

function escapeHtml(value) {
	return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function makeSnippet(entry, query) {
	const body = entry.body.replace(/\s+/g, " ").trim();
	if (!body) {
		return entry.header || "No summary.";
	}

	if (!query) {
		return body.slice(0, 180) + (body.length > 180 ? "…" : "");
	}

	const haystack = `${entry.headword} ${entry.header} ${body}`;
	const index = haystack.toLowerCase().indexOf(query.toLowerCase());
	if (index === -1) {
		return body.slice(0, 180) + (body.length > 180 ? "…" : "");
	}

	const start = Math.max(0, index - 60);
	const end = Math.min(haystack.length, index + 140);
	const slice = haystack.slice(start, end).trim();
	return (start > 0 ? "…" : "") + slice + (end < haystack.length ? "…" : "");
}

function sortAndFilterEntries(entries, query) {
	const needle = query.trim().toLowerCase();
	if (!needle) {
		return [...entries].sort((left, right) => left.headword.localeCompare(right.headword));
	}

	const scored = [];
	for (const entry of entries) {
		const headword = entry.headword.toLowerCase();
		const haystack = `${entry.headword}\n${entry.header}\n${entry.body}`.toLowerCase();
		let score = null;
		if (headword === needle) {
			score = 0;
		} else if (headword.includes(needle)) {
			score = 1;
		} else if (haystack.includes(needle)) {
			score = 2;
		}

		if (score !== null) {
			scored.push({ score, entry });
		}
	}

	scored.sort((left, right) => {
		if (left.score !== right.score) {
			return left.score - right.score;
		}
		return left.entry.headword.localeCompare(right.entry.headword);
	});

	return scored.map((item) => item.entry);
}

function setStatus(message) {
	statusEl.textContent = message;
}

function renderResults() {
	const { filteredEntries, query, selectedIndex } = state;

	if (!filteredEntries.length) {
		resultsMetaEl.textContent = `0 matches${query ? ` for “${query}”` : ""}.`;
		resultsListEl.innerHTML = '<p class="jargon-empty">No entries matched this query.</p>';
		return;
	}

	resultsMetaEl.textContent = `${filteredEntries.length} entries${query ? ` matched “${query}”` : " in the lexicon"}.`;
	resultsListEl.innerHTML = filteredEntries
		.map((entry, index) => {
			const activeClass = index === selectedIndex ? " is-active" : "";
			return `
				<button class="jargon-result-button${activeClass}" type="button" data-entry-index="${index}">
					<span class="jargon-result-title">${escapeHtml(entry.headword)}</span>
					<span class="jargon-result-snippet">${escapeHtml(makeSnippet(entry, query))}</span>
				</button>
			`;
		})
		.join("");
}

function renderDetail() {
	const entry = state.filteredEntries[state.selectedIndex];
	if (!entry) {
		detailCardEl.innerHTML = '<div class="jargon-loading">Choose an entry from the list or hit Random jargon.</div>';
		return;
	}

	const paragraphs = entry.body
		.split(/\n{2,}/)
		.filter(Boolean)
		.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
		.join("");

	detailCardEl.innerHTML = `
		<div class="jargon-detail-head">
			<p class="jargon-detail-meta">Jargon File ${escapeHtml(state.data.version)} · line ${entry.line_start}</p>
			<h3 id="jargon-detail-heading">${escapeHtml(entry.headword)}</h3>
			${entry.header ? `<p class="jargon-detail-meta">${escapeHtml(entry.header)}</p>` : ""}
		</div>
		<div class="jargon-detail-body">
			${paragraphs || '<p class="jargon-empty">No entry body was parsed.</p>'}
		</div>
	`;

	history.replaceState(null, "", `#${entry.url_key}`);
}

function scrollSelectedIntoView() {
	const button = resultsListEl.querySelector(`[data-entry-index="${state.selectedIndex}"]`);
	if (button) {
		button.scrollIntoView({ block: "nearest" });
	}
}

function selectEntry(index, { scroll = false } = {}) {
	if (!state.filteredEntries.length) {
		state.selectedIndex = -1;
		renderResults();
		renderDetail();
		return;
	}

	state.selectedIndex = Math.max(0, Math.min(index, state.filteredEntries.length - 1));
	renderResults();
	renderDetail();
	if (scroll) {
		scrollSelectedIntoView();
	}
}

function applyQuery(query, { preserveCurrent = true } = {}) {
	const previousEntry = state.filteredEntries[state.selectedIndex] ?? null;
	state.query = query;
	state.filteredEntries = sortAndFilterEntries(state.data.entries, query);

	if (!state.filteredEntries.length) {
		state.selectedIndex = -1;
		renderResults();
		renderDetail();
		return;
	}

	if (preserveCurrent) {
		if (previousEntry) {
			const newIndex = state.filteredEntries.findIndex((entry) => entry.url_key === previousEntry.url_key);
			if (newIndex !== -1) {
				state.selectedIndex = newIndex;
				renderResults();
				renderDetail();
				return;
			}
		}
	}

	selectEntry(0);
}

function selectByHash() {
	const rawHash = window.location.hash.replace(/^#/, "");
	const decodedHash = decodeURIComponent(rawHash);
	if (!rawHash) {
		return false;
	}

	const index = state.filteredEntries.findIndex((entry) => entry.url_key === rawHash || entry.headword === decodedHash);
	if (index === -1) {
		return false;
	}

	selectEntry(index, { scroll: true });
	return true;
}

function bindEvents() {
	searchInputEl.addEventListener("input", (event) => {
		applyQuery(event.currentTarget.value);
	});

	randomButtonEl.addEventListener("click", () => {
		if (!state.filteredEntries.length) {
			return;
		}
		const index = Math.floor(Math.random() * state.filteredEntries.length);
		selectEntry(index, { scroll: true });
	});

	clearButtonEl.addEventListener("click", () => {
		searchInputEl.value = "";
		applyQuery("");
		searchInputEl.focus();
	});

	resultsListEl.addEventListener("click", (event) => {
		const button = event.target.closest("[data-entry-index]");
		if (!button) {
			return;
		}
		selectEntry(Number(button.dataset.entryIndex), { scroll: false });
	});

	window.addEventListener("hashchange", () => {
		selectByHash();
	});
}

async function loadData() {
	const response = await fetch("./build/jargon-4.4.7.json");
	if (!response.ok) {
		throw new Error(`Failed to load jargon dataset (${response.status})`);
	}
	return response.json();
}

async function main() {
	try {
		setStatus("Loading 4.4.7 lexicon…");
		const data = await loadData();
		state.data = data;
		state.filteredEntries = sortAndFilterEntries(data.entries, "");
		setStatus(`Loaded ${data.entry_count} entries from Jargon File ${data.version}.`);
		bindEvents();
		if (!selectByHash()) {
			const randomIndex = Math.floor(Math.random() * state.filteredEntries.length);
			selectEntry(randomIndex, { scroll: true });
		}
	} catch (error) {
		console.error(error);
		setStatus("Could not load the jargon dataset.");
		resultsMetaEl.textContent = "The browser could not fetch the generated JSON file.";
		resultsListEl.innerHTML = '<p class="jargon-empty">Dataset load failed.</p>';
		detailCardEl.innerHTML = `<div class="jargon-loading">${escapeHtml(String(error.message || error))}</div>`;
	}
}

main();
