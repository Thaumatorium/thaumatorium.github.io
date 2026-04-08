const gridEl = document.querySelector("#home-jargon-grid");
const statusEl = document.querySelector("#home-jargon-status");
const refreshButtonEl = document.querySelector("#home-jargon-refresh");

if (gridEl && statusEl && refreshButtonEl) {
	const DATA_URL = "/projects/jargon-files/build/jargon-4.4.7.json";
	let entries = [];

	function escapeHtml(value) {
		return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
	}

	function snippet(entry) {
		const source = entry.body || entry.header || "";
		const compact = source.replace(/\s+/g, " ").trim();
		if (!compact) {
			return "No summary available.";
		}
		return compact.length > 220 ? `${compact.slice(0, 220).trim()}…` : compact;
	}

	function sampleThree(items) {
		const pool = [...items];
		for (let index = pool.length - 1; index > 0; index -= 1) {
			const swapIndex = Math.floor(Math.random() * (index + 1));
			[pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
		}
		return pool.slice(0, 3);
	}

	function renderCards() {
		if (!entries.length) {
			statusEl.textContent = "No jargon entries available.";
			return;
		}

		const picked = sampleThree(entries);
		gridEl.innerHTML = picked
			.map(
				(entry) => `
					<article class="home-jargon-card">
						<p class="home-jargon-kicker">Jargon File 4.4.7</p>
						<h3><a href="/projects/jargon-files/#${entry.url_key}">${escapeHtml(entry.headword)}</a></h3>
						${entry.header ? `<p class="home-jargon-meta">${escapeHtml(entry.header)}</p>` : ""}
						<p class="home-jargon-copy">${escapeHtml(snippet(entry))}</p>
					</article>
				`
			)
			.join("");
	}

	async function loadEntries() {
		statusEl.textContent = "Loading jargon cards…";
		try {
			const response = await fetch(DATA_URL);
			if (!response.ok) {
				throw new Error(`Dataset request failed with ${response.status}`);
			}

			const data = await response.json();
			entries = Array.isArray(data.entries) ? data.entries : [];
			renderCards();
		} catch (error) {
			console.error(error);
			statusEl.textContent = "Could not load random jargon cards.";
		}
	}

	refreshButtonEl.addEventListener("click", () => {
		renderCards();
	});

	loadEntries();
}
