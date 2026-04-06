const mapContainer = document.getElementById("morton-skulls-map");
const sourceInput = document.getElementById("morton-skulls-source");
const sizeInput = document.getElementById("morton-skulls-size");
const sizeValue = document.getElementById("morton-skulls-size-value");
const minNInput = document.getElementById("morton-skulls-min-n");
const minNValue = document.getElementById("morton-skulls-min-n-value");
const countMetric = document.getElementById("morton-skulls-count-metric");
const rangeMetric = document.getElementById("morton-skulls-range-metric");
const sourceMetric = document.getElementById("morton-skulls-source-metric");
const status = document.getElementById("morton-skulls-status");

if (!mapContainer || !sourceInput || !sizeInput || !sizeValue || !minNInput || !minNValue || !countMetric || !rangeMetric || !sourceMetric || !status) {
	throw new Error("Morton Skulls: required DOM nodes are missing.");
}

const DATASET_PATH = "/projects/morton-skulls/data/pbio_s1_all_groups_with_locations.csv";
const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

const state = {
	records: [],
	map: null,
	markerLayer: null,
};

function setStatus(message) {
	status.textContent = message;
}

function parseCsv(text) {
	const rows = [];
	let current = "";
	let row = [];
	let inQuotes = false;

	for (let index = 0; index < text.length; index += 1) {
		const char = text[index];
		const next = text[index + 1];

		if (char === '"') {
			if (inQuotes && next === '"') {
				current += '"';
				index += 1;
			} else {
				inQuotes = !inQuotes;
			}
			continue;
		}

		if (char === "," && !inQuotes) {
			row.push(current);
			current = "";
			continue;
		}

		if ((char === "\n" || char === "\r") && !inQuotes) {
			if (char === "\r" && next === "\n") {
				index += 1;
			}
			row.push(current);
			if (row.some((value) => value !== "")) {
				rows.push(row);
			}
			row = [];
			current = "";
			continue;
		}

		current += char;
	}

	if (current || row.length) {
		row.push(current);
		rows.push(row);
	}

	const [header, ...records] = rows;
	return records.map((record) => Object.fromEntries(header.map((column, index) => [column, record[index] ?? ""])));
}

function normalizeRecord(record) {
	return {
		...record,
		n: Number(record.n),
		mean_cm3: Number(record.mean_cm3),
		lat: Number(record.lat),
		lon: Number(record.lon),
		plot_lat: Number(record.plot_lat || record.lat),
		plot_lon: Number(record.plot_lon || record.lon),
	};
}

function updateSourceOptions(records, { resetSelection = false } = {}) {
	const sources = [...new Set(records.map((record) => record.Source))].sort((left, right) => left.localeCompare(right));
	const currentValue = resetSelection ? "all" : sourceInput.value;
	sourceInput.innerHTML = '<option value="all">All sources</option>';
	for (const source of sources) {
		const option = document.createElement("option");
		option.value = source;
		option.textContent = source;
		sourceInput.appendChild(option);
	}
	if (sources.includes(currentValue)) {
		sourceInput.value = currentValue;
	} else {
		sourceInput.value = "all";
	}
}

function filteredRecords() {
	const threshold = Number(minNInput.value);
	return state.records.filter((record) => {
		if (sourceInput.value !== "all" && record.Source !== sourceInput.value) {
			return false;
		}
		if (record.n < threshold) {
			return false;
		}
		return true;
	});
}

function formatVolume(value) {
	return `${Math.round(value)} cm³`;
}

function colorForVolume(volume, minVolume, maxVolume) {
	const ratio = maxVolume === minVolume ? 0.5 : (volume - minVolume) / (maxVolume - minVolume);
	const hue = 6 + ratio * 214;
	const lightness = 50 + ratio * 14;
	return `hsl(${hue} 72% ${lightness}%)`;
}

function radiusForVolume(volume, minVolume, maxVolume, scaleMultiplier) {
	const ratio = maxVolume === minVolume ? 0.5 : (volume - minVolume) / (maxVolume - minVolume);
	return (4 + ratio * 11) * scaleMultiplier;
}

function updateMetrics(records) {
	sizeValue.textContent = `${sizeInput.value}%`;
	minNValue.textContent = minNInput.value;
	countMetric.textContent = String(records.length);
	sourceMetric.textContent = String(new Set(records.map((record) => record.Source)).size);
	if (!records.length) {
		rangeMetric.textContent = "n/a";
		return;
	}
	const volumes = records.map((record) => record.mean_cm3);
	rangeMetric.textContent = `${formatVolume(Math.min(...volumes))} to ${formatVolume(Math.max(...volumes))}`;
}

function popupHtml(record) {
	return [`<strong>${record.Group}</strong>`, `${record.Source}`, `${record.location_label}`, `mean volume: <code>${formatVolume(record.mean_cm3)}</code>`, `sample size: <code>${record.n}</code>`, `confidence: <code>${record.location_confidence}</code>`].join("<br>");
}

function fitMapToRecords(records) {
	if (!records.length || !state.map) {
		return;
	}
	const bounds = records.map((record) => [record.plot_lat, record.plot_lon]);
	state.map.fitBounds(bounds, { padding: [24, 24] });
}

function renderPoints(records) {
	if (!state.map || !state.markerLayer) {
		return;
	}

	state.markerLayer.clearLayers();
	updateMetrics(records);

	if (!records.length) {
		setStatus("No points match the current filters.");
		return;
	}

	const volumes = records.map((record) => record.mean_cm3);
	const minVolume = Math.min(...volumes);
	const maxVolume = Math.max(...volumes);
	const scaleMultiplier = Number(sizeInput.value) / 100;

	for (const record of records) {
		const marker = window.L.circleMarker([record.plot_lat, record.plot_lon], {
			radius: radiusForVolume(record.mean_cm3, minVolume, maxVolume, scaleMultiplier),
			fillColor: colorForVolume(record.mean_cm3, minVolume, maxVolume),
			color: "rgba(36, 24, 24, 0.6)",
			weight: 1.2,
			fillOpacity: 0.82,
		});

		marker.bindPopup(popupHtml(record), {
			closeButton: false,
			offset: [0, -2],
		});

		marker.on("mouseover", function () {
			this.openPopup();
		});
		marker.on("mouseout", function () {
			this.closePopup();
		});
		marker.on("focus", function () {
			this.openPopup();
		});
		marker.on("blur", function () {
			this.closePopup();
		});

		state.markerLayer.addLayer(marker);
	}

	fitMapToRecords(records);
	setStatus(`Showing ${records.length} mapped skull groups from the full dataset with n >= ${minNInput.value}.`);
}

function render() {
	renderPoints(filteredRecords());
}

async function loadDataset(path) {
	const response = await fetch(path);
	if (!response.ok) {
		throw new Error(`Failed to load ${path}`);
	}
	const text = await response.text();
	return parseCsv(text)
		.map(normalizeRecord)
		.filter((record) => Number.isFinite(record.plot_lat) && Number.isFinite(record.plot_lon) && Number.isFinite(record.mean_cm3));
}

function ensureLeafletAssets() {
	const existingStylesheet = document.querySelector(`link[href="${LEAFLET_CSS_URL}"]`);
	if (!existingStylesheet) {
		const link = document.createElement("link");
		link.rel = "stylesheet";
		link.href = LEAFLET_CSS_URL;
		link.crossOrigin = "";
		document.head.appendChild(link);
	}

	if (window.L) {
		return Promise.resolve();
	}

	return new Promise((resolve, reject) => {
		const existingScript = document.querySelector(`script[src="${LEAFLET_JS_URL}"]`);
		if (existingScript) {
			existingScript.addEventListener("load", () => resolve(), { once: true });
			existingScript.addEventListener("error", () => reject(new Error("Failed to load Leaflet.")), { once: true });
			return;
		}

		const script = document.createElement("script");
		script.src = LEAFLET_JS_URL;
		script.crossOrigin = "";
		script.onload = () => resolve();
		script.onerror = () => reject(new Error("Failed to load Leaflet."));
		document.head.appendChild(script);
	});
}

function createMap() {
	state.map = window.L.map(mapContainer, {
		worldCopyJump: true,
		minZoom: 2,
		maxZoom: 7,
	});

	window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
		attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
	}).addTo(state.map);

	state.markerLayer = window.L.layerGroup().addTo(state.map);
	state.map.setView([20, 10], 2);
}

async function bootstrap() {
	try {
		await ensureLeafletAssets();
		createMap();
		state.records = await loadDataset(DATASET_PATH);
		updateSourceOptions(state.records, { resetSelection: true });
		render();
	} catch (error) {
		setStatus(error.message);
	}
}

sourceInput.addEventListener("change", () => {
	render();
});

sizeInput.addEventListener("input", () => {
	render();
});

minNInput.addEventListener("input", () => {
	render();
});

bootstrap();
