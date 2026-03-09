import { fetchJsonFile, generatePersonId, getGameNameFromData } from "./dataUtils.js";
import { processDataForD3 } from "./graphProcessor.js";
import { DEFAULT_ROLE } from "./config.js";

/**
 * Transforms the short filename from the dropdown into the expected data path.
 * @param {string} shortFilename - The filename from the dropdown (e.g., 'wc1_ovh.json').
 * @returns {string} The path used for fetching the JSON data.
 */
function getActualDataPath(shortFilename) {
	if (!shortFilename || typeof shortFilename !== "string" || !shortFilename.includes(".")) {
		return `./${shortFilename || "invalid_filename.json"}`;
	}
	return `./${shortFilename}`;
}

/**
 * Calculates basic statistics from the raw game JSON data.
 * @param {object | null} jsonData - The parsed JSON object for a single game.
 * @param {string} filename - The filename, used for finding the game name key.
 * @returns {{personCount: number, uniqueRoleCount: number} | null} Stats object or null if data is invalid.
 */
function calculateRawStats(jsonData, filename) {
	if (!jsonData) return null;
	const gameName = getGameNameFromData(jsonData, filename);
	let peopleArray = null;
	if (!gameName || !Array.isArray(jsonData[gameName])) {
		const topLevelKeys = Object.keys(jsonData);
		for (const key of topLevelKeys) {
			if (Array.isArray(jsonData[key])) {
				peopleArray = jsonData[key];
				break;
			}
		}

		if (!peopleArray) {
			return { personCount: 0, uniqueRoleCount: 0 };
		}
	} else {
		peopleArray = jsonData[gameName];
	}

	const personCount = peopleArray.length;
	const uniqueRoles = new Set();

	peopleArray.forEach((person) => {
		if (person && Array.isArray(person.roles)) {
			person.roles.forEach((role) => {
				const trimmedRole = typeof role === "string" ? role.trim() : null;
				if (trimmedRole) {
					uniqueRoles.add(trimmedRole);
				}
			});
		}
	});

	return {
		personCount: personCount,
		uniqueRoleCount: uniqueRoles.size,
	};
}

function collectAllRoles(jsonData, filename) {
	if (!jsonData) return new Set();

	const gameName = getGameNameFromData(jsonData, filename);
	let peopleArray = null;

	if (gameName && Array.isArray(jsonData[gameName])) {
		peopleArray = jsonData[gameName];
	} else {
		for (const key of Object.keys(jsonData)) {
			if (Array.isArray(jsonData[key])) {
				peopleArray = jsonData[key];
				break;
			}
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
	const {
		filename1: shortFilename1,
		filename2: shortFilename2,
		filters, // Raw filters from main.js (text might have commas)
	} = event.data;

	// Split comma-separated terms and validate
	const parseFilterText = (text) => {
		return String(text || "")
			.split(",")
			.map((term) => term.trim())
			.filter(Boolean); // Remove empty strings resulting from double commas etc.
	};

	const validatedFilters = {
		name: {
			// Store the original text and the parsed terms
			text: String(filters?.name?.text ?? ""),
			terms: parseFilterText(filters?.name?.text),
			mode: ["contains", "not_contains", "exact", "not_exact"].includes(filters?.name?.mode) ? filters.name.mode : "contains",
		},
		role: {
			// Store the original text and the parsed terms
			text: String(filters?.role?.text ?? ""),
			terms: parseFilterText(filters?.role?.text),
			mode: ["contains", "not_contains", "exact", "not_exact"].includes(filters?.role?.mode) ? filters.role.mode : "contains",
		},
	};

	const actualPath1 = getActualDataPath(shortFilename1);
	const actualPath2 = getActualDataPath(shortFilename2);

	let jsonData1 = null;
	let jsonData2 = null;
	let rawStats1 = null;
	let rawStats2 = null;
	const allDatasetRoles = new Set();

	try {
		const isSameGame = actualPath1 === actualPath2;

		try {
			if (isSameGame) {
				jsonData1 = await fetchJsonFile(actualPath1);
				jsonData2 = jsonData1;
				if (jsonData1) {
					rawStats1 = calculateRawStats(jsonData1, shortFilename1);
					rawStats2 = rawStats1;
					collectAllRoles(jsonData1, shortFilename1).forEach((role) => allDatasetRoles.add(role));
				}
			} else {
				const results = await Promise.allSettled([fetchJsonFile(actualPath1), fetchJsonFile(actualPath2)]);

				jsonData1 = results[0].status === "fulfilled" ? results[0].value : null;
				jsonData2 = results[1].status === "fulfilled" ? results[1].value : null;

				if (jsonData1) {
					rawStats1 = calculateRawStats(jsonData1, shortFilename1);
					collectAllRoles(jsonData1, shortFilename1).forEach((role) => allDatasetRoles.add(role));
				}
				if (jsonData2) {
					rawStats2 = calculateRawStats(jsonData2, shortFilename2);
					collectAllRoles(jsonData2, shortFilename2).forEach((role) => allDatasetRoles.add(role));
				}
			}
		} catch (fetchError) {
			console.error("Worker (D3) fetch execution error:", fetchError);
			throw new Error(`Failed during game data fetch attempt: ${fetchError.message}`);
		}

		if (!jsonData1 && !jsonData2) {
			throw new Error(`Failed to fetch data for both selections: ${shortFilename1}, ${shortFilename2}`);
		}

		const workerPersonRolesMap = new Map();
		const workerNormalizedRolePositions = new Map();

		// Pass the filters object (which now contains 'terms' arrays)
		const { nodes, links, filteredStats1, filteredStats2, sharedCount } = processDataForD3(
			jsonData1,
			jsonData2,
			shortFilename1,
			shortFilename2,
			isSameGame,
			workerPersonRolesMap,
			validatedFilters // Pass the object with 'terms' arrays
		);
		const d3GraphData = { nodes, links };

		const personRolesMapData = Array.from(workerPersonRolesMap.entries()).map(([key, value]) => [
			key,
			{
				allRoles: Array.from(value.allRoles ?? []),
				game1Roles: Array.from(value.game1Roles ?? []),
				game2Roles: Array.from(value.game2Roles ?? []),
				sharedRoles: Array.from(value.sharedRoles ?? []),
				game1OnlyRoles: Array.from(value.game1OnlyRoles ?? []),
				game2OnlyRoles: Array.from(value.game2OnlyRoles ?? []),
			},
		]);

		const hasPersonNodes = d3GraphData.nodes.some((n) => n.type === "person");
		if (allDatasetRoles.size === 0 && hasPersonNodes) {
			allDatasetRoles.add(DEFAULT_ROLE);
		}

		// Map exact roles onto shared lane keys so variants like localized voice-over casts collapse together.
		const laneKeys = Array.from(new Set(Array.from(allDatasetRoles).map((role) => getRoleLaneKey(role)))).sort(compareLaneKeysForLayout);
		const count = laneKeys.length || 1;
		const laneIndexByKey = new Map(laneKeys.map((laneKey, index) => [laneKey, index]));
		workerNormalizedRolePositions.clear();
		Array.from(allDatasetRoles).forEach((role) => {
			const laneKey = getRoleLaneKey(role);
			const laneIndex = laneIndexByKey.get(laneKey) ?? 0;
			workerNormalizedRolePositions.set(role, {
				normX: 0.5,
				normY: count === 1 ? 0.5 : laneIndex / (count - 1),
			});
		});
		// Ensure DEFAULT_ROLE has a center fallback if not already positioned
		if (hasPersonNodes && !workerNormalizedRolePositions.has(DEFAULT_ROLE)) {
			workerNormalizedRolePositions.set(DEFAULT_ROLE, {
				normX: 0.5,
				normY: 0.5,
			});
		}
		const normalizedRolePositionsData = Array.from(workerNormalizedRolePositions.entries());

		self.postMessage({
			status: "success",
			graphData: d3GraphData,
			personRolesMapData: personRolesMapData,
			normalizedRolePositionsData: normalizedRolePositionsData,
			stats1: filteredStats1,
			stats2: filteredStats2,
			sharedCount,
			effectiveFilters: validatedFilters, // Send back the parsed filters including the 'terms' arrays
		});
	} catch (error) {
		console.error("Worker (D3) processing error:", error);
		self.postMessage({
			status: "error",
			message: error.message || "Unknown D3 worker error",
			stats1: null,
			stats2: null,
			sharedCount: 0,
			effectiveFilters: validatedFilters, // Still send filters used
		});
	}
};
