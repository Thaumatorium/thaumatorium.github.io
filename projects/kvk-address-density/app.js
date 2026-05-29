const resultsBody = document.querySelector("#resultsBody");
const searchInput = document.querySelector("#searchInput");
const riskFilter = document.querySelector("#riskFilter");
const scoreInput = document.querySelector("#scoreInput");
const scoreLabel = document.querySelector("#scoreLabel");
const resultCount = document.querySelector("#resultCount");
const areaCount = document.querySelector("#areaCount");
const maxScore = document.querySelector("#maxScore");
const signalCount = document.querySelector("#signalCount");
const medianDensity = document.querySelector("#medianDensity");
const sortButtons = document.querySelectorAll("[data-sort]");

const numberFormatter = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 2 });
let rows = [];
let sortKey = "riskScore";
let sortDirection = "desc";

function median(values) {
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	if (!sorted.length) return 0;
	return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function riskSignals(data) {
	return data.filter((row) => row.riskLevel === "hoog" || row.riskLevel === "verhoogd");
}

function updateKpis(data) {
	areaCount.textContent = data.length.toLocaleString("nl-NL");
	maxScore.textContent = Math.max(...data.map((row) => row.riskScore)).toLocaleString("nl-NL");
	signalCount.textContent = riskSignals(data).length.toLocaleString("nl-NL");
	medianDensity.textContent = `${numberFormatter.format(median(data.map((row) => row.companiesPerUsableM2)))} / 100 m2`;
}

function matchesSearch(row, query) {
	if (!query) return true;
	const haystack = [row.area, row.municipality, row.areaType, row.branchMix, row.riskLevel].join(" ").toLowerCase();
	return haystack.includes(query);
}

function filteredRows() {
	const query = searchInput.value.trim().toLowerCase();
	const minScore = Number(scoreInput.value);
	return rows.filter((row) => {
		if (!matchesSearch(row, query)) return false;
		if (riskFilter.value !== "all" && row.riskLevel !== riskFilter.value) return false;
		return row.riskScore >= minScore;
	});
}

function compareRows(a, b) {
	const aValue = a[sortKey];
	const bValue = b[sortKey];
	const direction = sortDirection === "asc" ? 1 : -1;
	if (typeof aValue === "number" && typeof bValue === "number") {
		return (aValue - bValue) * direction;
	}
	return String(aValue).localeCompare(String(bValue), "nl-NL") * direction;
}

function rowTemplate(row) {
	return `
		<tr>
			<td>
				<strong>${row.area}</strong><br />
				<span>${row.areaType}</span>
			</td>
			<td>${row.municipality}</td>
			<td>
				<strong>${row.riskScore}</strong><br />
				<span class="risk-pill ${row.riskLevel}">${row.riskLevel}</span>
			</td>
			<td>${numberFormatter.format(row.companiesPerUsableM2)}</td>
			<td>${numberFormatter.format(row.companiesPerObject)}</td>
			<td>${numberFormatter.format(row.peerDeviation)}x</td>
			<td>
				<details>
					<summary>Waarom deze score?</summary>
					<p>${row.explanation}</p>
					<p><strong>Branchemix:</strong> ${row.branchMix}.</p>
					<p><strong>Volume:</strong> ${row.companyCount.toLocaleString("nl-NL")} registraties op ${row.buildingObjects.toLocaleString("nl-NL")} objecten en ${row.usableM2.toLocaleString("nl-NL")} m2.</p>
				</details>
			</td>
		</tr>
	`;
}

function render() {
	const visibleRows = filteredRows().sort(compareRows);
	scoreLabel.textContent = scoreInput.value;
	resultCount.textContent = `${visibleRows.length.toLocaleString("nl-NL")} van ${rows.length.toLocaleString("nl-NL")} gebieden`;
	resultsBody.innerHTML = visibleRows.map(rowTemplate).join("");
}

function setSort(nextKey) {
	if (sortKey === nextKey) {
		sortDirection = sortDirection === "asc" ? "desc" : "asc";
	} else {
		sortKey = nextKey;
		sortDirection = typeof rows[0]?.[nextKey] === "number" ? "desc" : "asc";
	}
	render();
}

async function init() {
	const response = await fetch("sample-data.json");
	rows = await response.json();
	updateKpis(rows);
	render();
}

searchInput.addEventListener("input", render);
riskFilter.addEventListener("change", render);
scoreInput.addEventListener("input", render);
sortButtons.forEach((button) => button.addEventListener("click", () => setSort(button.dataset.sort)));

init().catch((error) => {
	resultsBody.innerHTML = `<tr><td colspan="7">De sampledata kon niet worden geladen: ${error.message}</td></tr>`;
});
