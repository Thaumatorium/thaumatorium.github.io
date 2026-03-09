const setStatus = (id, message) => {
	const output = document.getElementById(id);
	if (output) {
		output.value = message;
		output.textContent = message;
	}
};

const byId = (id) => document.getElementById(id);

const copyText = async (targetId, statusId) => {
	const target = byId(targetId);
	if (!target || !target.value) {
		setStatus(statusId, "Nothing to copy.");
		return;
	}

	try {
		await navigator.clipboard.writeText(target.value);
		setStatus(statusId, "Copied.");
	} catch {
		target.focus();
		target.select();
		document.execCommand("copy");
		setStatus(statusId, "Copied.");
	}
};

const clearTargets = (targetIds, statusId) => {
	for (const id of targetIds) {
		const element = byId(id.trim());
		if (!element) continue;
		if ("value" in element) {
			element.value = "";
		} else {
			element.textContent = "";
		}
	}
	if (statusId) {
		setStatus(statusId, "Cleared.");
	}
};

const setupTextTool = ({ inputId, outputId, statusId, transform }) => {
	const input = byId(inputId);
	const output = byId(outputId);
	if (!input || !output) return;

	input.addEventListener("input", () => {
		output.value = transform(input.value);
		setStatus(statusId, input.value ? "Updated." : "");
	});
};

const toBase64 = (text) => {
	const bytes = new TextEncoder().encode(text);
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
};

const fromBase64 = (text) => {
	const binary = atob(text);
	const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
	return new TextDecoder().decode(bytes);
};

const latinToRunes = [
	["ng", "ᛜ"],
	["th", "ᚦ"],
	["ae", "ᚨ"],
	["oe", "ᛟ"],
	["ei", "ᛇ"],
	["a", "ᚨ"],
	["b", "ᛒ"],
	["c", "ᚲ"],
	["d", "ᛞ"],
	["e", "ᛖ"],
	["f", "ᚠ"],
	["g", "ᚷ"],
	["h", "ᚺ"],
	["i", "ᛁ"],
	["j", "ᛃ"],
	["k", "ᚲ"],
	["l", "ᛚ"],
	["m", "ᛗ"],
	["n", "ᚾ"],
	["o", "ᛟ"],
	["p", "ᛈ"],
	["q", "ᚲ"],
	["r", "ᚱ"],
	["s", "ᛊ"],
	["t", "ᛏ"],
	["u", "ᚢ"],
	["v", "ᚹ"],
	["w", "ᚹ"],
	["x", "ᚲᛊ"],
	["y", "ᛇ"],
	["z", "ᛉ"],
];

const runeToLatin = new Map([
	["ᚠ", "f"],
	["ᚢ", "u"],
	["ᚦ", "th"],
	["ᚨ", "a"],
	["ᚱ", "r"],
	["ᚲ", "k"],
	["ᚷ", "g"],
	["ᚹ", "w"],
	["ᚺ", "h"],
	["ᚾ", "n"],
	["ᛁ", "i"],
	["ᛃ", "j"],
	["ᛇ", "ei"],
	["ᛈ", "p"],
	["ᛉ", "z"],
	["ᛊ", "s"],
	["ᛏ", "t"],
	["ᛒ", "b"],
	["ᛖ", "e"],
	["ᛗ", "m"],
	["ᛚ", "l"],
	["ᛜ", "ng"],
	["ᛞ", "d"],
	["ᛟ", "o"],
]);

const transliterateLatinToRunes = (value) => {
	let result = "";
	let index = 0;
	const input = value.toLowerCase();

	while (index < input.length) {
		const remaining = input.slice(index);
		const mapped = latinToRunes.find(([latin]) => remaining.startsWith(latin));
		if (mapped) {
			result += mapped[1];
			index += mapped[0].length;
			continue;
		}

		result += value[index];
		index += 1;
	}

	return result;
};

const transliterateRunesToLatin = (value) => [...value].map((char) => runeToLatin.get(char) ?? char).join("");

const setupFetchTool = () => {
	const input = byId("fetch-input");
	const run = byId("fetch-run");
	const timing = byId("fetch-timing");
	const length = byId("fetch-length");
	const httpStatus = byId("fetch-http-status");

	if (!input || !run || !timing || !length || !httpStatus) return;

	run.addEventListener("click", async () => {
		timing.textContent = "?";
		length.textContent = "?";
		httpStatus.textContent = "?";
		setStatus("fetch-status", "Fetching...");
		run.disabled = true;

		const startedAt = performance.now();

		try {
			const response = await fetch(input.value);
			const text = await response.text();
			timing.textContent = `${Math.round(performance.now() - startedAt)} ms`;
			length.textContent = `${text.length} bytes`;
			httpStatus.textContent = `${response.status} ${response.statusText}`;
			setStatus("fetch-status", response.ok ? "Done." : "Fetched, but response was not OK.");
		} catch (error) {
			setStatus("fetch-status", `Failed: ${error instanceof Error ? error.message : String(error)}`);
		} finally {
			run.disabled = false;
		}
	});
};

document.querySelectorAll("[data-details-action]").forEach((button) => {
	button.addEventListener("click", () => {
		const open = button.dataset.detailsAction === "open";
		document.querySelectorAll("details").forEach((element) => {
			element.open = open;
		});
	});
});

document.querySelectorAll("[data-copy-target]").forEach((button) => {
	button.addEventListener("click", () => {
		const targetId = button.dataset.copyTarget;
		const status = button.parentElement?.querySelector(".tool-status")?.id;
		copyText(targetId, status);
	});
});

document.querySelectorAll("[data-clear-target]").forEach((button) => {
	button.addEventListener("click", () => {
		const targetIds = (button.dataset.clearTarget ?? "").split(",");
		const status = button.parentElement?.querySelector(".tool-status")?.id;
		clearTargets(targetIds, status);
	});
});

setupTextTool({
	inputId: "runifier-encode-in",
	outputId: "runifier-encode-out",
	statusId: "runifier-encode-status",
	transform: (value) => transliterateLatinToRunes(value),
});

{
	const input = byId("runifier-decode-in");
	const output = byId("runifier-decode-out");
	if (input && output) {
		input.addEventListener("input", () => {
			if (!input.value) {
				output.value = "";
				setStatus("runifier-decode-status", "");
				return;
			}
			output.value = transliterateRunesToLatin(input.value);
			setStatus("runifier-decode-status", "Decoded.");
		});
	}
}

setupTextTool({
	inputId: "mstg-in",
	outputId: "mstg-out",
	statusId: "mstg-status",
	transform: (value) => {
		let result = "";
		let lettersSeen = 0;
		for (const char of value) {
			if (char === " ") {
				result += char;
				continue;
			}
			result += lettersSeen % 2 === 0 ? char.toUpperCase() : char.toLowerCase();
			lettersSeen += 1;
		}
		return result;
	},
});

setupTextTool({
	inputId: "rot13-in",
	outputId: "rot13-out",
	statusId: "rot13-status",
	transform: (value) =>
		value.replace(/[a-z]/gi, (char) => {
			const base = char <= "Z" ? 65 : 97;
			return String.fromCharCode(((char.charCodeAt(0) - base + 13) % 26) + base);
		}),
});

setupTextTool({
	inputId: "slugify-in",
	outputId: "slugify-out",
	statusId: "slugify-status",
	transform: (value) =>
		value
			.normalize("NFKD")
			.replace(/[\u0300-\u036f]/g, "")
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, ""),
});

setupTextTool({
	inputId: "base64-encode-in",
	outputId: "base64-encode-out",
	statusId: "base64-encode-status",
	transform: (value) => (value ? toBase64(value) : ""),
});

{
	const input = byId("base64-decode-in");
	const output = byId("base64-decode-out");
	if (input && output) {
		input.addEventListener("input", () => {
			if (!input.value) {
				output.value = "";
				setStatus("base64-decode-status", "");
				return;
			}

			try {
				output.value = fromBase64(input.value);
				setStatus("base64-decode-status", "Decoded.");
			} catch {
				output.value = "";
				setStatus("base64-decode-status", "Invalid Base64.");
			}
		});
	}
}

setupFetchTool();
