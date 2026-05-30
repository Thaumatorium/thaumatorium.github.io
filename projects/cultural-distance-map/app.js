/* global d3 */

const svg = d3.select("#culturalChart");
const chartWrap = document.querySelector(".chart-wrap");
const tooltip = document.querySelector("#tooltip");
const yearRange = document.querySelector("#yearRange");
const yearLabel = document.querySelector("#yearLabel");
const modeButtons = document.querySelectorAll("[data-mode]");
const trailToggle = document.querySelector("#trailToggle");
const trendToggle = document.querySelector("#trendToggle");
const resetZoomButton = document.querySelector("#resetZoom");
const countrySelect = document.querySelector("#countrySelect");
const selectedCountry = document.querySelector("#selectedCountry");
const selectedYear = document.querySelector("#selectedYear");
const selectedX = document.querySelector("#selectedX");
const selectedY = document.querySelector("#selectedY");
const rankingCount = document.querySelector("#rankingCount");
const distanceRanking = document.querySelector("#distanceRanking");

const dimensions = {
	standard: {
		x: "survSAgg",
		y: "tradAgg",
		xLabel: "Overlevingswaarden",
		xHighLabel: "Zelfexpressiewaarden",
		yLabel: "Traditionele waarden",
		yHighLabel: "Seculier-rationele waarden",
		format: (value) => value.toFixed(2),
	},
	welzel: {
		x: "emancipativeValue",
		y: "secularValue",
		xLabel: "Laag emancipatief",
		xHighLabel: "Hoog emancipatief",
		yLabel: "Laag seculier",
		yHighLabel: "Hoog seculier",
		format: (value) => value.toFixed(3),
	},
};

const regionColors = new Map([
	["Noordwest-Europa", "#216869"],
	["Zuid-Europa", "#c44536"],
	["Oost-Europa", "#5f5aa2"],
	["Amerika", "#d58936"],
	["Azie-Pacific", "#3d7ea6"],
	["MENA", "#8f5d46"],
	["Sub-Sahara Afrika", "#5b8c5a"],
	["Overig", "#6d6875"],
]);

const regionCountries = new Map([
	["Noordwest-Europa", ["Andorra", "Australia", "Austria", "Belgium", "Canada", "Denmark", "Finland", "France", "Germany", "Germany West", "Great Britain", "Iceland", "Ireland", "Luxembourg", "Netherlands", "New Zealand", "Northern Ireland", "Norway", "Sweden", "Switzerland", "United States"]],
	["Zuid-Europa", ["Cyprus", "Greece", "Italy", "Malta", "Portugal", "Spain"]],
	["Oost-Europa", ["Albania", "Armenia", "Azerbaijan", "Belarus", "Bosnia and Herzegovina", "Bulgaria", "Croatia", "Czechia", "Estonia", "Georgia", "Hungary", "Kosovo", "Latvia", "Lithuania", "Moldova", "Montenegro", "North Macedonia", "Poland", "Romania", "Russia", "Serbia", "Slovakia", "Slovenia", "Ukraine"]],
	["Amerika", ["Argentina", "Bolivia", "Brazil", "Chile", "Colombia", "Dominican Republic", "Ecuador", "El Salvador", "Guatemala", "Haiti", "Mexico", "Nicaragua", "Peru", "Puerto Rico", "Trinidad and Tobago", "Uruguay", "Venezuela"]],
	["Azie-Pacific", ["Bangladesh", "China", "Hong Kong SAR", "India", "Indonesia", "Japan", "Kazakhstan", "Kyrgyzstan", "Macau SAR", "Malaysia", "Maldives", "Mongolia", "Myanmar", "Pakistan", "Philippines", "Singapore", "South Korea", "Taiwan ROC", "Tajikistan", "Thailand", "Uzbekistan", "Vietnam"]],
	["MENA", ["Algeria", "Egypt", "Iran", "Iraq", "Israel", "Jordan", "Kuwait", "Lebanon", "Libya", "Morocco", "Palestine", "Qatar", "Saudi Arabia", "Tunisia", "Turkey", "Yemen"]],
	["Sub-Sahara Afrika", ["Burkina Faso", "Ethiopia", "Ghana", "Kenya", "Mali", "Nigeria", "Rwanda", "South Africa", "Tanzania", "Uganda", "Zambia", "Zimbabwe"]],
]);

let data = [];
let metadata = {};
let state = {
	mode: "standard",
	year: 2022,
	selectedCode: "528",
	showTrail: true,
	showTrends: true,
	zoomTransform: d3.zoomIdentity,
};

const zoomBehavior = d3
	.zoom()
	.scaleExtent([0.75, 12])
	.filter((event) => {
		if (event.type === "wheel") return true;
		return !event.ctrlKey && !event.button;
	})
	.on("zoom", (event) => {
		state.zoomTransform = event.transform;
		renderChart();
	});

function metric() {
	return dimensions[state.mode];
}

function regionFor(country) {
	for (const [region, countries] of regionCountries) {
		if (countries.includes(country)) return region;
	}
	return "Overig";
}

function hasPoint(record, mode = state.mode) {
	const dimension = dimensions[mode];
	return Number.isFinite(record?.[dimension.x]) && Number.isFinite(record?.[dimension.y]);
}

function latestRecordsUntil(year, mode = state.mode) {
	const latest = new Map();
	for (const record of data) {
		if (record.year > year || !hasPoint(record, mode)) continue;
		const current = latest.get(record.countryCode);
		if (!current || record.year > current.year) latest.set(record.countryCode, record);
	}
	return [...latest.values()].sort((a, b) => a.country.localeCompare(b.country));
}

function countryOptions() {
	const latest = new Map();
	for (const record of data) {
		if (!hasPoint(record, state.mode)) continue;
		const current = latest.get(record.countryCode);
		if (!current || record.year > current.year) latest.set(record.countryCode, record);
	}
	return [...latest.values()].sort((a, b) => a.country.localeCompare(b.country));
}

function selectedRecord(records = latestRecordsUntil(state.year)) {
	return records.find((record) => record.countryCode === state.selectedCode) || records[0] || null;
}

function pointDistance(a, b) {
	const dimension = metric();
	return Math.hypot(a[dimension.x] - b[dimension.x], a[dimension.y] - b[dimension.y]);
}

function rankedDistances(records, selected) {
	if (!selected) return [];
	return records
		.filter((record) => record.countryCode !== selected.countryCode)
		.map((record) => ({ ...record, distance: pointDistance(selected, record) }))
		.sort((a, b) => a.distance - b.distance);
}

function historicalRecordsFor(record) {
	return data.filter((candidate) => candidate.countryCode === record.countryCode && candidate.year <= state.year && hasPoint(candidate)).sort((a, b) => a.year - b.year);
}

function weightedSlope(records, key) {
	if (records.length < 2) return null;

	const first = records[0];
	const last = records[records.length - 1];
	if (records.length === 2) {
		const yearDelta = last.year - first.year;
		return yearDelta ? (last[key] - first[key]) / yearDelta : null;
	}

	const referenceYear = last.year;
	const halfLifeYears = 12;
	const weighted = records.map((record) => ({
		year: record.year,
		value: record[key],
		weight: Math.pow(0.5, (referenceYear - record.year) / halfLifeYears),
	}));
	const weightTotal = d3.sum(weighted, (record) => record.weight);
	const meanYear = d3.sum(weighted, (record) => record.year * record.weight) / weightTotal;
	const meanValue = d3.sum(weighted, (record) => record.value * record.weight) / weightTotal;
	const variance = d3.sum(weighted, (record) => record.weight * (record.year - meanYear) ** 2);
	if (!variance) return null;
	const covariance = d3.sum(weighted, (record) => record.weight * (record.year - meanYear) * (record.value - meanValue));
	return covariance / variance;
}

function trendArrowFor(record, x, y, dimension) {
	const records = historicalRecordsFor(record);
	if (records.length < 2) return null;

	const xSlope = weightedSlope(records, dimension.x);
	const ySlope = weightedSlope(records, dimension.y);
	if (!Number.isFinite(xSlope) || !Number.isFinite(ySlope)) return null;

	const startX = x(record[dimension.x]);
	const startY = y(record[dimension.y]);
	const projectionYears = 10;
	let dx = x(record[dimension.x] + xSlope * projectionYears) - startX;
	let dy = y(record[dimension.y] + ySlope * projectionYears) - startY;
	const length = Math.hypot(dx, dy);
	if (length < 2.5) return null;

	const minLength = 9;
	const maxLength = 24;
	const targetLength = Math.max(minLength, Math.min(maxLength, length));
	dx = (dx / length) * targetLength;
	dy = (dy / length) * targetLength;

	return {
		...record,
		historyCount: records.length,
		x1: startX - dx * 0.38,
		y1: startY - dy * 0.38,
		x2: startX + dx * 0.62,
		y2: startY + dy * 0.62,
	};
}

function fullExtent(key, fallback) {
	const values = data.filter((record) => Number.isFinite(record[key])).map((record) => record[key]);
	if (!values.length) return fallback;
	const extent = d3.extent(values);
	const padding = (extent[1] - extent[0] || 1) * 0.08;
	return [extent[0] - padding, extent[1] + padding];
}

function populateCountries() {
	const options = countryOptions();
	countrySelect.innerHTML = options.map((record) => `<option value="${record.countryCode}">${record.country}</option>`).join("");
	if (options.some((record) => record.countryCode === state.selectedCode)) {
		countrySelect.value = state.selectedCode;
	} else {
		state.selectedCode = options[0]?.countryCode || metadata.defaultCountryCode;
		countrySelect.value = state.selectedCode;
	}
}

function updateSummary(selected) {
	const dimension = metric();
	selectedCountry.textContent = selected?.country || "-";
	selectedYear.textContent = selected?.year || "-";
	selectedX.textContent = selected ? dimension.format(selected[dimension.x]) : "-";
	selectedY.textContent = selected ? dimension.format(selected[dimension.y]) : "-";
}

function updateRanking(ranked) {
	const rows = ranked.slice(0, 12);
	rankingCount.textContent = `${ranked.length} landen`;
	distanceRanking.innerHTML = rows
		.map(
			(record) => `<li>
				<button type="button" data-country-code="${record.countryCode}">
					<span><b>${record.country}</b><br />${record.year}</span>
					<output>${record.distance.toFixed(2)}</output>
				</button>
			</li>`
		)
		.join("");
}

function showTooltip(event, record, distance) {
	const rect = chartWrap.getBoundingClientRect();
	const dimension = metric();
	const distanceText = Number.isFinite(distance) ? `<br />Afstand: ${distance.toFixed(2)}` : "";
	tooltip.innerHTML = `<strong>${record.country} (${record.year})</strong>${dimension.xHighLabel}: ${dimension.format(record[dimension.x])}<br />${dimension.yHighLabel}: ${dimension.format(record[dimension.y])}${distanceText}`;
	tooltip.hidden = false;
	tooltip.style.left = `${Math.min(rect.width - 290, Math.max(12, event.clientX - rect.left + 14))}px`;
	tooltip.style.top = `${Math.min(rect.height - 120, Math.max(12, event.clientY - rect.top + 14))}px`;
}

function hideTooltip() {
	tooltip.hidden = true;
}

function renderChart() {
	const records = latestRecordsUntil(state.year);
	if (!records.some((record) => record.countryCode === state.selectedCode)) {
		state.selectedCode = records[0]?.countryCode || state.selectedCode;
		countrySelect.value = state.selectedCode;
	}

	const selected = selectedRecord(records);
	const ranked = rankedDistances(records, selected);
	const dimension = metric();
	const width = chartWrap.clientWidth || 900;
	const height = svg.node().clientHeight || 680;
	const highlightCount = width < 600 ? 4 : 8;
	const nearCodes = new Set(ranked.slice(0, highlightCount).map((record) => record.countryCode));
	const margin = { top: 36, right: 34, bottom: 58, left: 64 };
	const innerWidth = Math.max(320, width - margin.left - margin.right);
	const innerHeight = Math.max(300, height - margin.top - margin.bottom);
	const baseX = d3
		.scaleLinear()
		.domain(fullExtent(dimension.x, [-2, 2]))
		.range([margin.left, margin.left + innerWidth]);
	const baseY = d3
		.scaleLinear()
		.domain(fullExtent(dimension.y, [-2, 2]))
		.range([margin.top + innerHeight, margin.top]);
	const x = state.zoomTransform.rescaleX(baseX);
	const y = state.zoomTransform.rescaleY(baseY);

	svg.attr("viewBox", `0 0 ${width} ${height}`).attr("aria-label", `Culturele kaart met ${records.length} landen tot en met ${state.year}`);
	svg
		.call(
			zoomBehavior
				.extent([
					[margin.left, margin.top],
					[margin.left + innerWidth, margin.top + innerHeight],
				])
				.translateExtent([
					[margin.left - innerWidth * 8, margin.top - innerHeight * 8],
					[margin.left + innerWidth * 9, margin.top + innerHeight * 9],
				])
		)
		.on("dblclick.zoom", null);
	svg.selectAll("*").remove();
	svg.append("title").attr("id", "chartTitle").text("Culturele afstandskaart");
	svg.append("desc").attr("id", "chartDescription").text("Landen als punten in een tweedimensionale culturele waardenruimte.");
	svg.append("clipPath").attr("id", "plotClip").append("rect").attr("x", margin.left).attr("y", margin.top).attr("width", innerWidth).attr("height", innerHeight);
	svg.append("defs").append("marker").attr("id", "trendArrowHead").attr("viewBox", "0 -4 8 8").attr("refX", 7).attr("refY", 0).attr("markerWidth", 7).attr("markerHeight", 7).attr("orient", "auto").append("path").attr("d", "M0,-3.5L8,0L0,3.5").attr("fill", "rgba(36, 34, 29, 0.52)");

	const grid = svg.append("g").attr("class", "grid").attr("clip-path", "url(#plotClip)");
	grid
		.selectAll("line.x-grid")
		.data(x.ticks(8))
		.join("line")
		.attr("x1", (tick) => x(tick))
		.attr("x2", (tick) => x(tick))
		.attr("y1", margin.top)
		.attr("y2", margin.top + innerHeight);
	grid
		.selectAll("line.y-grid")
		.data(y.ticks(8))
		.join("line")
		.attr("x1", margin.left)
		.attr("x2", margin.left + innerWidth)
		.attr("y1", (tick) => y(tick))
		.attr("y2", (tick) => y(tick));

	if (x.domain()[0] < 0 && x.domain()[1] > 0) {
		svg
			.append("line")
			.attr("class", "zero-line")
			.attr("clip-path", "url(#plotClip)")
			.attr("x1", x(0))
			.attr("x2", x(0))
			.attr("y1", margin.top)
			.attr("y2", margin.top + innerHeight);
	}
	if (y.domain()[0] < 0 && y.domain()[1] > 0) {
		svg
			.append("line")
			.attr("class", "zero-line")
			.attr("clip-path", "url(#plotClip)")
			.attr("x1", margin.left)
			.attr("x2", margin.left + innerWidth)
			.attr("y1", y(0))
			.attr("y2", y(0));
	}

	svg
		.append("g")
		.attr("transform", `translate(0,${margin.top + innerHeight})`)
		.call(d3.axisBottom(x).ticks(7));
	svg.append("g").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(7));

	svg
		.append("text")
		.attr("class", "axis-label")
		.attr("x", margin.left)
		.attr("y", height - 18)
		.attr("text-anchor", "start")
		.text(dimension.xLabel);
	svg
		.append("text")
		.attr("class", "axis-label")
		.attr("x", margin.left + innerWidth)
		.attr("y", height - 18)
		.attr("text-anchor", "end")
		.text(dimension.xHighLabel);
	svg
		.append("text")
		.attr("class", "axis-label")
		.attr("x", -margin.top - 4)
		.attr("y", 20)
		.attr("text-anchor", "end")
		.attr("transform", "rotate(-90)")
		.text(dimension.yHighLabel);
	svg
		.append("text")
		.attr("class", "axis-label")
		.attr("x", -margin.top - innerHeight)
		.attr("y", 20)
		.attr("text-anchor", "start")
		.attr("transform", "rotate(-90)")
		.text(dimension.yLabel);

	const selectedTrail = data.filter((record) => record.countryCode === selected?.countryCode && record.year <= state.year && hasPoint(record)).sort((a, b) => a.year - b.year);
	const line = d3
		.line()
		.x((record) => x(record[dimension.x]))
		.y((record) => y(record[dimension.y]));

	if (state.showTrail && selectedTrail.length > 1) {
		svg.append("path").datum(selectedTrail).attr("class", "country-trail").attr("clip-path", "url(#plotClip)").attr("d", line);
	}

	svg
		.append("g")
		.attr("clip-path", "url(#plotClip)")
		.selectAll("line")
		.data(ranked.slice(0, width < 600 ? 3 : 5))
		.join("line")
		.attr("class", "distance-line")
		.attr("x1", x(selected?.[dimension.x] || 0))
		.attr("y1", y(selected?.[dimension.y] || 0))
		.attr("x2", (record) => x(record[dimension.x]))
		.attr("y2", (record) => y(record[dimension.y]));

	if (state.showTrends) {
		svg
			.append("g")
			.attr("clip-path", "url(#plotClip)")
			.selectAll("line")
			.data(records.map((record) => trendArrowFor(record, x, y, dimension)).filter(Boolean), (record) => record.countryCode)
			.join("line")
			.attr("class", "trend-arrow")
			.attr("x1", (record) => record.x1)
			.attr("y1", (record) => record.y1)
			.attr("x2", (record) => record.x2)
			.attr("y2", (record) => record.y2)
			.attr("marker-end", "url(#trendArrowHead)");
	}

	const pointGroup = svg.append("g").attr("clip-path", "url(#plotClip)");
	pointGroup
		.selectAll("circle")
		.data(records, (record) => record.countryCode)
		.join("circle")
		.attr("class", (record) => ["country-point", nearCodes.has(record.countryCode) ? "is-near" : "", record.countryCode === selected?.countryCode ? "is-selected" : ""].filter(Boolean).join(" "))
		.attr("cx", (record) => x(record[dimension.x]))
		.attr("cy", (record) => y(record[dimension.y]))
		.attr("r", (record) => (record.countryCode === selected?.countryCode ? 7 : nearCodes.has(record.countryCode) ? 5.8 : 4.6))
		.attr("fill", (record) => regionColors.get(regionFor(record.country)) || regionColors.get("Overig"))
		.on("mouseenter", (event, record) => {
			showTooltip(event, record, record.countryCode === selected?.countryCode ? null : pointDistance(selected, record));
		})
		.on("mousemove", (event, record) => showTooltip(event, record, record.countryCode === selected?.countryCode ? null : pointDistance(selected, record)))
		.on("mouseleave", hideTooltip)
		.on("click", (_event, record) => {
			if (_event.defaultPrevented) return;
			state.selectedCode = record.countryCode;
			countrySelect.value = record.countryCode;
			hideTooltip();
			render();
		});

	const labels = [selected, ...ranked.slice(0, highlightCount)].filter(Boolean);
	svg
		.append("g")
		.attr("clip-path", "url(#plotClip)")
		.selectAll("text")
		.data(labels, (record) => record.countryCode)
		.join("text")
		.attr("class", "country-label")
		.attr("x", (record) => x(record[dimension.x]) + 8)
		.attr("y", (record) => y(record[dimension.y]) - 8)
		.text((record) => record.country);

	updateSummary(selected);
	updateRanking(ranked);
}

function render() {
	yearLabel.textContent = state.year;
	trailToggle.checked = state.showTrail;
	trendToggle.checked = state.showTrends;
	modeButtons.forEach((button) => button.classList.toggle("active", button.dataset.mode === state.mode));
	populateCountries();
	renderChart();
}

async function init() {
	const response = await fetch("cultural-map-data.json");
	const payload = await response.json();
	data = payload.records;
	metadata = payload.metadata;
	state.selectedCode = metadata.defaultCountryCode || state.selectedCode;
	state.year = metadata.yearExtent?.[1] || state.year;
	yearRange.min = metadata.yearExtent?.[0] || 1981;
	yearRange.max = metadata.yearExtent?.[1] || 2022;
	yearRange.value = state.year;
	render();
}

modeButtons.forEach((button) => {
	button.addEventListener("click", () => {
		state.mode = button.dataset.mode;
		render();
	});
});

yearRange.addEventListener("input", () => {
	state.year = Number(yearRange.value);
	render();
});

countrySelect.addEventListener("change", () => {
	state.selectedCode = countrySelect.value;
	render();
});

trailToggle.addEventListener("change", () => {
	state.showTrail = trailToggle.checked;
	renderChart();
});

trendToggle.addEventListener("change", () => {
	state.showTrends = trendToggle.checked;
	renderChart();
});

resetZoomButton.addEventListener("click", () => {
	svg.transition().duration(220).call(zoomBehavior.transform, d3.zoomIdentity);
});

distanceRanking.addEventListener("click", (event) => {
	const button = event.target.closest("[data-country-code]");
	if (!button) return;
	state.selectedCode = button.dataset.countryCode;
	countrySelect.value = state.selectedCode;
	render();
});

new ResizeObserver(() => renderChart()).observe(chartWrap);

init();
