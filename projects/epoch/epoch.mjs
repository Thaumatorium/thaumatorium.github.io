const currentTime = document.getElementById("currentTime");
const singleInput = document.getElementById("singleInput");
const singleUnit = document.getElementById("singleUnit");
const convertSingleBtn = document.getElementById("convertSingleBtn");
const useNowBtn = document.getElementById("useNowBtn");
const clearSingleBtn = document.getElementById("clearSingleBtn");
const singleStatus = document.getElementById("singleStatus");
const batchInput = document.getElementById("batchInput");
const batchUnit = document.getElementById("batchUnit");
const convertBatchBtn = document.getElementById("convertBatchBtn");
const clearBatchBtn = document.getElementById("clearBatchBtn");
const downloadBatchBtn = document.getElementById("downloadBatchBtn");
const batchStatus = document.getElementById("batchStatus");
const batchResults = document.getElementById("batchResults");
const batchTbody = document.getElementById("batchTbody");

const singleOutputs = {
	detected: document.getElementById("singleDetected"),
	utc: document.getElementById("singleUtc"),
	local: document.getElementById("singleLocal"),
	seconds: document.getElementById("singleSeconds"),
	milliseconds: document.getElementById("singleMilliseconds"),
	nanoseconds: document.getElementById("singleNanoseconds"),
};

if (!currentTime || !singleInput || !singleUnit || !convertSingleBtn || !useNowBtn || !clearSingleBtn || !singleStatus || !batchInput || !batchUnit || !convertBatchBtn || !clearBatchBtn || !downloadBatchBtn || !batchStatus || !batchResults || !batchTbody || Object.values(singleOutputs).some((node) => !node)) {
	throw new Error("Epoch converter: required DOM nodes are missing.");
}

function setStatus(node, message, tone = "info") {
	node.textContent = message;
	node.dataset.tone = tone;
}

function formatLocalIso(date) {
	const localISOString = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString();
	const timezoneOffset = -date.getTimezoneOffset();
	const hours = String(Math.floor(Math.abs(timezoneOffset) / 60)).padStart(2, "0");
	const minutes = String(Math.abs(timezoneOffset) % 60).padStart(2, "0");
	const sign = timezoneOffset >= 0 ? "+" : "-";
	return `${localISOString.slice(0, -1)}${sign}${hours}:${minutes}`;
}

function detectEpochFormat(raw) {
	const digits = String(BigInt(raw) < 0n ? -BigInt(raw) : BigInt(raw)).toString().length;
	if (digits <= 10) return "seconds";
	if (digits <= 13) return "milliseconds";
	if (digits <= 19) return "nanoseconds";
	throw new Error("Unknown unit; pick seconds, milliseconds, or nanoseconds explicitly.");
}

function convertSingle(raw, unitPreference) {
	const input = String(raw).trim();
	if (!/^[-+]?\d+$/.test(input)) {
		throw new Error("Input must be an integer timestamp.");
	}

	const detectedUnit = unitPreference === "auto" ? detectEpochFormat(input) : unitPreference;
	let milliseconds;
	if (detectedUnit === "seconds") {
		milliseconds = Number(input) * 1000;
	} else if (detectedUnit === "milliseconds") {
		milliseconds = Number(input);
	} else if (detectedUnit === "nanoseconds") {
		milliseconds = Number(BigInt(input) / 1000000n);
	} else {
		throw new Error("Unsupported unit.");
	}

	const date = new Date(milliseconds);
	if (Number.isNaN(date.getTime())) {
		throw new Error("Invalid timestamp.");
	}

	return {
		unit: detectedUnit,
		isoUTC: date.toISOString(),
		isoLocal: formatLocalIso(date),
		unixS: String(Math.floor(milliseconds / 1000)),
		unixMs: String(Math.trunc(milliseconds)),
		unixNs: (BigInt(Math.trunc(milliseconds)) * 1000000n).toString(),
	};
}

async function copyText(text, node) {
	try {
		await navigator.clipboard.writeText(text);
		const original = node.textContent;
		node.textContent = "Copied!";
		setTimeout(() => {
			node.textContent = original;
		}, 900);
	} catch {}
}

function renderCurrentTime() {
	const now = new Date();
	const values = [
		["RFC3339", now.toISOString()],
		["Local ISO8601", formatLocalIso(now)],
		["Local Human", now.toString()],
		["Unix Seconds", String(Math.floor(now.getTime() / 1000))],
		["Unix Milliseconds", String(now.getTime())],
		["Unix Nanoseconds", String(BigInt(now.getTime()) * 1000000n)],
	];
	currentTime.replaceChildren(
		...values.map(([label, value]) => {
			const wrapper = document.createElement("div");
			const title = document.createElement("span");
			title.className = "epoch-copy-label";
			title.textContent = label;
			const output = document.createElement("div");
			output.className = "epoch-current-value";
			output.textContent = value;
			output.addEventListener("click", () => copyText(value, output));
			wrapper.append(title, output);
			return wrapper;
		})
	);
}

function clearSingleOutputs() {
	Object.values(singleOutputs).forEach((node) => {
		node.textContent = "-";
	});
}

function handleSingleConvert() {
	try {
		const converted = convertSingle(singleInput.value, singleUnit.value);
		singleOutputs.detected.textContent = converted.unit;
		singleOutputs.utc.textContent = converted.isoUTC;
		singleOutputs.local.textContent = converted.isoLocal;
		singleOutputs.seconds.textContent = converted.unixS;
		singleOutputs.milliseconds.textContent = converted.unixMs;
		singleOutputs.nanoseconds.textContent = converted.unixNs;
		setStatus(singleStatus, `Converted as ${converted.unit}.`);
	} catch (error) {
		clearSingleOutputs();
		setStatus(singleStatus, error.message, "error");
	}
}

function readBatchLines() {
	return batchInput.value
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)
		.slice(0, 5000);
}

function handleBatchConvert() {
	const lines = readBatchLines();
	if (lines.length === 0) {
		batchResults.hidden = true;
		batchTbody.replaceChildren();
		setStatus(batchStatus, "Enter one or more integer timestamps, one per line.", "error");
		return;
	}

	const rows = [];
	lines.forEach((line, index) => {
		try {
			const converted = convertSingle(line, batchUnit.value);
			rows.push({ index, input: line, ...converted, error: "" });
		} catch (error) {
			rows.push({ index, input: line, unit: "", isoUTC: "", isoLocal: "", unixS: "", unixMs: "", unixNs: "", error: error.message });
		}
	});

	batchTbody.replaceChildren(
		...rows.map((row) => {
			const tr = document.createElement("tr");
			const cells = [String(row.index + 1), row.input, row.unit, row.isoUTC, row.isoLocal, row.unixS, row.unixMs, row.unixNs, row.error];
			cells.forEach((value, cellIndex) => {
				const td = document.createElement("td");
				td.textContent = value;
				if (cellIndex >= 3 && cellIndex <= 7 && value) {
					td.className = "copyable";
					td.addEventListener("click", () => copyText(value, td));
				}
				if (cellIndex === 8 && value) {
					td.style.color = "#a31717";
				}
				tr.appendChild(td);
			});
			return tr;
		})
	);

	batchResults.hidden = false;
	setStatus(batchStatus, `Converted ${rows.length} row${rows.length === 1 ? "" : "s"}.`);
}

function clearBatch() {
	batchInput.value = "";
	batchTbody.replaceChildren();
	batchResults.hidden = true;
	setStatus(batchStatus, "");
}

function downloadBatchCsv() {
	if (batchResults.hidden || batchTbody.children.length === 0) {
		setStatus(batchStatus, "No batch results to export.", "error");
		return;
	}
	const rows = [...document.querySelectorAll("#batchResults tr")];
	const csv = rows.map((tr) => [...tr.querySelectorAll("th,td")].map((cell) => `"${cell.textContent.replaceAll('"', '""')}"`).join(",")).join("\n");
	const blob = new Blob([`${csv}\n`], { type: "text/csv;charset=utf-8;" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `epoch_batch_${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

Object.values(singleOutputs).forEach((node) => {
	node.addEventListener("click", () => {
		if (node.textContent && node.textContent !== "-") {
			copyText(node.textContent, node);
		}
	});
});

convertSingleBtn.addEventListener("click", handleSingleConvert);
useNowBtn.addEventListener("click", () => {
	const nowSeconds = String(Math.floor(Date.now() / 1000));
	singleInput.value = nowSeconds;
	singleUnit.value = "seconds";
	handleSingleConvert();
});
clearSingleBtn.addEventListener("click", () => {
	singleInput.value = "";
	singleUnit.value = "auto";
	clearSingleOutputs();
	setStatus(singleStatus, "");
});
singleInput.addEventListener("keydown", (event) => {
	if (event.key === "Enter") {
		event.preventDefault();
		handleSingleConvert();
	}
});
convertBatchBtn.addEventListener("click", handleBatchConvert);
clearBatchBtn.addEventListener("click", clearBatch);
downloadBatchBtn.addEventListener("click", downloadBatchCsv);
batchInput.addEventListener("paste", () => {
	setTimeout(() => {
		if (batchInput.value.trim()) handleBatchConvert();
	}, 0);
});

renderCurrentTime();
setInterval(renderCurrentTime, 1000);
clearSingleOutputs();
setStatus(singleStatus, "Ready.");
