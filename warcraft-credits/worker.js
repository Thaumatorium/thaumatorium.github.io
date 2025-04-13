import { fetchJsonFile, generatePersonId } from "./dataUtils.js";
import { processDataForD3 } from "./graphProcessor.js";
import { DEFAULT_ROLE, gameTitleMap } from "./config.js";

/**
 * Transforms the short filename from the dropdown into the expected data path.
 * @param {string} shortFilename - The filename from the dropdown (e.g., 'wc1_ovh.json').
 * @returns {string} The path used for fetching the JSON data.
 */
function getActualDataPath(shortFilename) {
	if (!shortFilename || typeof shortFilename !== "string" || !shortFilename.includes(".")) {
		console.error(`Worker: Invalid short filename passed: ${shortFilename}`);
		return `./${shortFilename || "invalid_filename.json"}`;
	}
	return `./${shortFilename}`;
}

/**
 * Safely extracts the game name from the loaded JSON data.
 * @param {Object | null} jsonData - The parsed JSON data for a game.
 * @param {string} filename - The filename used to fetch this data (for fallback/logging).
 * @returns {string | null} The extracted game name or null if undetermined.
 */
function getGameNameFromData(jsonData, filename) {
	if (!jsonData || typeof jsonData !== "object") {
		console.warn(`Cannot extract game name: Invalid JSON data provided for ${filename}.`);
		return null;
	}
	const keys = Object.keys(jsonData);
	if (keys.length === 1 && typeof keys[0] === "string" && keys[0].trim() !== "") {
		return keys[0].trim();
	}
	if (gameTitleMap[filename]) {
		console.warn(`Cannot extract game name: Expected one top-level key in ${filename}, found ${keys.length}. Trying config map.`);
		return null;
	}
	console.warn(`Cannot extract game name: Expected one top-level key in ${filename}, found ${keys.length}. Keys:`, keys);
	return null;
}

/**
 * Calculates basic statistics from the raw game JSON data.
 * @param {object | null} jsonData - The parsed JSON object for a single game.
 * @param {string} filename - The filename, used for finding the game name key.
 * @returns {{personCount: number, uniqueRoleCount: number} | null} Stats object or null if data is invalid.
 */
function calculateStats(jsonData, filename) {
	if (!jsonData) return null;
	const gameName = getGameNameFromData(jsonData, filename);
	let peopleArray = null;
	if (!gameName || !Array.isArray(jsonData[gameName])) {
		console.warn(`Worker: Could not find valid people array for stats calculation in ${filename} using key '${gameName || "unknown"}'. Checking top-level values.`);
		const topLevelKeys = Object.keys(jsonData);
		for (const key of topLevelKeys) {
			if (Array.isArray(jsonData[key])) {
				peopleArray = jsonData[key];
				console.warn(`Worker: Found people array under unexpected key '${key}' in ${filename}. Using this for stats.`);
				break; // Use the first array found
			}
		}

		if (!peopleArray) {
			console.error(`Worker: No valid people array found anywhere in ${filename} for stats calculation.`);
			return { personCount: 0, uniqueRoleCount: 0 }; // Return zero stats
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
		if (person && (!person.roles || person.roles.length === 0)) {
		}
	});
	if (personCount > 0 && uniqueRoles.size === 0) {
		console.warn(`Worker: ${filename} has ${personCount} people but no explicit non-empty roles listed. Reporting 0 unique roles.`);
	}

	return {
		personCount: personCount,
		uniqueRoleCount: uniqueRoles.size,
	};
}

self.onmessage = async (event) => {
	const { filename1: shortFilename1, filename2: shortFilename2 } = event.data;
	console.log(`Worker (D3): Received job for short names: ${shortFilename1}, ${shortFilename2}`);

	const actualPath1 = getActualDataPath(shortFilename1);
	const actualPath2 = getActualDataPath(shortFilename2);
	console.log(`Worker (D3): Mapped to actual fetch paths: ${actualPath1}, ${actualPath2}`);

	let jsonData1 = null;
	let jsonData2 = null;
	let stats1 = null; // <-- Initialize stats holders
	let stats2 = null; // <-- Initialize stats holders

	try {
		const isSameGame = actualPath1 === actualPath2;

		try {
			if (isSameGame) {
				jsonData1 = await fetchJsonFile(actualPath1);
				jsonData2 = jsonData1; // Reference the same data
				if (jsonData1) {
					console.log(`Worker (D3): Fetched single file: ${actualPath1}`);
					stats1 = calculateStats(jsonData1, shortFilename1); // Calculate stats
					stats2 = stats1; // Assign same stats
					if (!stats1) console.error(`Worker: Stat calculation failed for ${shortFilename1}`);
				} else {
					console.error(`Worker (D3): Failed to fetch single file: ${actualPath1}`);
				}
			} else {
				const results = await Promise.allSettled([fetchJsonFile(actualPath1), fetchJsonFile(actualPath2)]);

				jsonData1 = results[0].status === "fulfilled" ? results[0].value : null;
				jsonData2 = results[1].status === "fulfilled" ? results[1].value : null;

				console.log(`Worker (D3): Fetched file 1 (${results[0].status}): ${actualPath1}`);
				console.log(`Worker (D3): Fetched file 2 (${results[1].status}): ${actualPath2}`);

				if (jsonData1) {
					stats1 = calculateStats(jsonData1, shortFilename1); // Calculate stats for file 1
					if (!stats1) console.error(`Worker: Stat calculation failed for ${shortFilename1}`);
				}
				if (jsonData2) {
					stats2 = calculateStats(jsonData2, shortFilename2); // Calculate stats for file 2
					if (!stats2) console.error(`Worker: Stat calculation failed for ${shortFilename2}`);
				}

				if (!jsonData1 && jsonData2) console.warn(`Worker (D3): Failed to fetch ${actualPath1}, proceeding with ${actualPath2}.`);
				if (jsonData1 && !jsonData2) console.warn(`Worker (D3): Failed to fetch ${actualPath2}, proceeding with ${actualPath1}.`);
			}
		} catch (fetchError) {
			console.error("Worker (D3) fetch execution error:", fetchError);
			throw new Error(`Failed during game data fetch attempt: ${fetchError.message}`);
		}

		if (!jsonData1 && !jsonData2) {
			throw new Error(`Failed to fetch data for both selections: ${shortFilename1}, ${shortFilename2}`);
		}

		console.log("Worker (D3): Starting data processing for D3...");
		const workerPersonRolesMap = new Map();
		const workerNormalizedRolePositions = new Map();
		const d3GraphData = processDataForD3(jsonData1, jsonData2, shortFilename1, shortFilename2, isSameGame, workerPersonRolesMap);
		console.log(`Worker (D3): Finished data processing. Nodes: ${d3GraphData.nodes.length}, Links: ${d3GraphData.links.length}`);

		const personRolesMapData = Array.from(workerPersonRolesMap.entries()).map(([key, valueSet]) => [key, Array.from(valueSet)]);
		const allRoles = new Set();
		for (const rolesSet of workerPersonRolesMap.values()) {
			rolesSet.forEach((role) => allRoles.add(role));
		}
		if (allRoles.size === 0 && d3GraphData.nodes.some((n) => n.type === "person")) {
			allRoles.add(DEFAULT_ROLE); // Ensure default role exists if graph has people but no roles
		}

		const sortedRoles = Array.from(allRoles).sort();
		const numRoles = sortedRoles.length;
		const angleStep = (2 * Math.PI) / (numRoles > 0 ? numRoles : 1);
		const radius = 0.4; // Controls how far from center roles are placed

		sortedRoles.forEach((role, index) => {
			const angle = index * angleStep - Math.PI / 2; // Start from top
			const normX = 0.5 + radius * Math.cos(angle);
			const normY = 0.5 + radius * Math.sin(angle);
			workerNormalizedRolePositions.set(role, { normX, normY });
		});
		if (!workerNormalizedRolePositions.has(DEFAULT_ROLE) && allRoles.has(DEFAULT_ROLE)) {
			workerNormalizedRolePositions.set(DEFAULT_ROLE, {
				normX: 0.5,
				normY: 0.5,
			}); // Center if missing but needed
		} else if (numRoles === 0) {
			workerNormalizedRolePositions.set(DEFAULT_ROLE, {
				normX: 0.5,
				normY: 0.5,
			}); // Center fallback
		}
		const normalizedRolePositionsData = Array.from(workerNormalizedRolePositions.entries());

		console.log(`Worker (D3): Posting back stats1: ${JSON.stringify(stats1)}, stats2: ${JSON.stringify(stats2)}`);

		self.postMessage({
			status: "success",
			graphData: d3GraphData,
			personRolesMapData: personRolesMapData,
			normalizedRolePositionsData: normalizedRolePositionsData,
			stats1: stats1, // <-- Add stats1 to payload
			stats2: stats2, // <-- Add stats2 to payload
		});
	} catch (error) {
		console.error("Worker (D3) processing error:", error);
		self.postMessage({
			status: "error",
			message: error.message || "Unknown D3 worker error",
			stats1: null, // Send null stats on error
			stats2: null,
		});
	}
};
