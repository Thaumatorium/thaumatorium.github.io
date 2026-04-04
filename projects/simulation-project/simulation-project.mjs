const els = {
	form: document.getElementById("seasonTimeSimulationForm"),
	start: document.getElementById("seasonTimeStart"),
	timezone: document.getElementById("seasonTimeTimezone"),
	notes: document.getElementById("seasonTimeNotes"),
	runButton: document.getElementById("seasonTimeRunButton"),
	resetButton: document.getElementById("seasonTimeResetButton"),
	canvas: document.getElementById("seasonTimeSimulationCanvas"),
	stats: document.getElementById("seasonTimeSimulationStats"),
	log: document.getElementById("seasonTimeSimulationLog"),
};

function escapeHtml(value) {
	return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function setStats(items) {
	els.stats.innerHTML = items
		.map(
			(item) => `
				<div class="season-time-sim-stat">
					<small>${escapeHtml(item.label)}</small>
					<strong>${escapeHtml(item.value)}</strong>
				</div>
			`
		)
		.join("");
}

function setLog(lines) {
	els.log.innerHTML = `<code>${escapeHtml(lines.join("\n"))}</code>`;
}

function renderPlaceholderSimulation({ start, timezone, notes }) {
	const startDate = new Date(start);
	const beforeHour = Number.isNaN(startDate.getTime()) ? "?" : String(startDate.getHours()).padStart(2, "0");
	const afterHour = Number.isNaN(startDate.getTime()) ? "?" : String((startDate.getHours() + 1) % 24).padStart(2, "0");

	setStats([
		{ label: "Start", value: start || "n/a" },
		{ label: "Timezone", value: timezone || "n/a" },
		{ label: "Example shift", value: `${beforeHour}:00 -> ${afterHour}:00` },
	]);

	els.canvas.innerHTML = `
		<div class="season-time-sim-empty">
			<div>
				<strong>Placeholder renderer</strong>
				<p>Replace <code>renderPlaceholderSimulation()</code> with your actual summer/winter time simulation code.</p>
			</div>
		</div>
	`;

	setLog(["Template simulation ran.", "", `start: ${start || "(empty)"}`, `timezone: ${timezone || "(empty)"}`, `notes: ${notes || "(empty)"}`, "", "Next step:", "Replace the placeholder render function in static/projects/simulation-project/simulation-project.mjs."]);
}

function runSimulation() {
	renderPlaceholderSimulation({
		start: els.start.value,
		timezone: els.timezone.value.trim(),
		notes: els.notes.value.trim(),
	});
}

function resetSimulation() {
	els.form.reset();
	els.start.value = "2026-03-29T00:30";
	els.timezone.value = "Europe/Amsterdam";
	runSimulation();
}

els.form?.addEventListener("submit", (event) => {
	event.preventDefault();
	runSimulation();
});

els.resetButton?.addEventListener("click", () => {
	resetSimulation();
});

runSimulation();
