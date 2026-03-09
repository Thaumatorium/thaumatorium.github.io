import { fetchJsonFile } from "./dataUtils.js";
import { processDataForD3 } from "./graphProcessor.js";
import { DEFAULT_ROLE } from "./config.js";

function getActualDataPath(shortFilename) {
	if (!shortFilename || typeof shortFilename !== "string" || !shortFilename.includes(".")) {
		return `./${shortFilename || "invalid_filename.json"}`;
	}
	return `./${shortFilename}`;
}

function collectAllRoles(jsonData) {
	if (!jsonData) return new Set();

	let peopleArray = null;
	for (const key of Object.keys(jsonData)) {
		if (Array.isArray(jsonData[key])) {
			peopleArray = jsonData[key];
			break;
		}
	}

	const roles = new Set();
	for (const person of peopleArray ?? []) {
		if (person && Array.isArray(person.roles)) {
			for (const role of person.roles) {
				const trimmedRole = typeof role === "string" ? role.trim() : "";
				if (trimmedRole) roles.add(trimmedRole);
			}
		}
	}

	return roles;
}

const ROLE_FAMILY_ORDER = ["leadership", "design", "engineering", "art", "audio_voice", "qa", "localization", "production", "marketing_support", "other"];

function classifyRoleFamily(role) {
	const normalizedRole = role.toLowerCase().trim();

	if (/voice|voices|audio|sound|music|casting/.test(normalizedRole)) return "audio_voice";
	if (/locali|translation|translated|german|italian|korean|french|spanish|russian|polish|portuguese|chinese/.test(normalizedRole)) return "localization";
	if (/designer|design|quest|narrative|writer/.test(normalizedRole)) return "design";
	if (/programmer|engineer|developer|technical/.test(normalizedRole)) return "engineering";
	if (/artist|art |art$|animator|cinematic|illustration/.test(normalizedRole)) return "art";
	if (/qa|quality assurance|tester|test /.test(normalizedRole)) return "qa";
	if (/producer|project lead|production/.test(normalizedRole)) return "production";
	if (/director|president|vice president|ceo|lead /.test(normalizedRole)) return "leadership";
	if (/marketing|sales|support|community|web designer|public relations/.test(normalizedRole)) return "marketing_support";

	return "other";
}

function getRoleLaneKey(role) {
	const normalizedRole = role.toLowerCase().trim();

	if (/^voice over cast\b/.test(normalizedRole)) return "voice_over_cast";
	if (/^character voices?\b/.test(normalizedRole) || /^voices?\b/.test(normalizedRole)) return "voices";
	if (/monster voice effects/.test(normalizedRole)) return "monster_voice_effects";
	if (/voice direction|voice director|casting/.test(normalizedRole)) return "voice_direction";
	if (/audio/.test(normalizedRole) && /voice/.test(normalizedRole)) return "audio_voice";
	if (/locali|translation|translated/.test(normalizedRole)) return "localization";

	return normalizedRole;
}

function compareLaneKeysForLayout(a, b) {
	const familyA = classifyRoleFamily(a);
	const familyB = classifyRoleFamily(b);
	const familyIndexA = ROLE_FAMILY_ORDER.indexOf(familyA);
	const familyIndexB = ROLE_FAMILY_ORDER.indexOf(familyB);
	if (familyIndexA !== familyIndexB) return familyIndexA - familyIndexB;
	return a.localeCompare(b);
}

self.onmessage = async (event) => {
	const { filenames = [], filters } = event.data;

	const parseFilterText = (text) =>
		String(text || "")
			.split(",")
			.map((term) => term.trim())
			.filter(Boolean);

	const validatedFilters = {
		name: {
			text: String(filters?.name?.text ?? ""),
			terms: parseFilterText(filters?.name?.text),
			mode: ["contains", "not_contains", "exact", "not_exact"].includes(filters?.name?.mode) ? filters.name.mode : "contains",
		},
		role: {
			text: String(filters?.role?.text ?? ""),
			terms: parseFilterText(filters?.role?.text),
			mode: ["contains", "not_contains", "exact", "not_exact"].includes(filters?.role?.mode) ? filters.role.mode : "contains",
		},
	};

	const selectedFilenames = Array.from(new Set((Array.isArray(filenames) ? filenames : []).filter((filename) => typeof filename === "string" && filename.trim() !== "")));

	if (selectedFilenames.length === 0) {
		self.postMessage({
			status: "error",
			message: "No games selected.",
			perGameStats: [],
			sharedCount: 0,
			selectedGameCount: 0,
			effectiveFilters: validatedFilters,
		});
		return;
	}

	const allDatasetRoles = new Set();

	try {
		const results = await Promise.allSettled(
			selectedFilenames.map(async (filename) => {
				const jsonData = await fetchJsonFile(getActualDataPath(filename));
				if (!jsonData) return null;
				collectAllRoles(jsonData).forEach((role) => allDatasetRoles.add(role));
				return { filename, jsonData };
			})
		);

		const loadedDatasets = results.map((result) => (result.status === "fulfilled" ? result.value : null)).filter((dataset) => dataset && dataset.jsonData);

		if (loadedDatasets.length === 0) {
			throw new Error(`Failed to fetch data for all selections: ${selectedFilenames.join(", ")}`);
		}

		const workerPersonRolesMap = new Map();
		const workerNormalizedRolePositions = new Map();

		const { nodes, links, perGameStats, sharedCount, selectedGameCount } = processDataForD3(loadedDatasets, workerPersonRolesMap, validatedFilters);
		const d3GraphData = { nodes, links };

		const personRolesMapData = Array.from(workerPersonRolesMap.entries()).map(([key, value]) => [
			key,
			{
				allRoles: Array.from(value.allRoles ?? []),
				repeatedRoles: Array.from(value.repeatedRoles ?? []),
				games: Array.isArray(value.games)
					? value.games.map((gameEntry) => ({
							gameId: gameEntry.gameId,
							gameName: gameEntry.gameName,
							roles: Array.from(gameEntry.roles ?? []),
						}))
					: [],
			},
		]);

		const hasPersonNodes = d3GraphData.nodes.some((node) => node.type === "person");
		if (allDatasetRoles.size === 0 && hasPersonNodes) {
			allDatasetRoles.add(DEFAULT_ROLE);
		}

		const laneKeys = Array.from(new Set(Array.from(allDatasetRoles).map((role) => getRoleLaneKey(role)))).sort(compareLaneKeysForLayout);
		const count = laneKeys.length || 1;
		const laneIndexByKey = new Map(laneKeys.map((laneKey, index) => [laneKey, index]));

		Array.from(allDatasetRoles).forEach((role) => {
			const laneKey = getRoleLaneKey(role);
			const laneIndex = laneIndexByKey.get(laneKey) ?? 0;
			workerNormalizedRolePositions.set(role, {
				normX: 0.5,
				normY: count === 1 ? 0.5 : laneIndex / (count - 1),
			});
		});

		if (hasPersonNodes && !workerNormalizedRolePositions.has(DEFAULT_ROLE)) {
			workerNormalizedRolePositions.set(DEFAULT_ROLE, { normX: 0.5, normY: 0.5 });
		}

		self.postMessage({
			status: "success",
			graphData: d3GraphData,
			personRolesMapData,
			normalizedRolePositionsData: Array.from(workerNormalizedRolePositions.entries()),
			perGameStats,
			sharedCount,
			selectedGameCount,
			effectiveFilters: validatedFilters,
		});
	} catch (error) {
		console.error("Worker processing error:", error);
		self.postMessage({
			status: "error",
			message: error.message || "Unknown worker error",
			perGameStats: [],
			sharedCount: 0,
			selectedGameCount: selectedFilenames.length,
			effectiveFilters: validatedFilters,
		});
	}
};
