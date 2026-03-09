/**
 * Asynchronously fetches and parses a JSON file from a given path.
 * Handles common fetch errors gracefully by returning null.
 *
 * @param {string} filename - The path to the JSON file relative to the executing script (e.g., worker).
 * @returns {Promise<object|null>} A promise resolving with the parsed JSON data, or null if fetching/parsing fails gracefully.
 * @throws {Error} If the filename argument itself is missing or invalid (programmer error).
 */
export async function fetchJsonFile(filename) {
	if (!filename || typeof filename !== "string" || filename.trim() === "") {
		throw new Error("fetchJsonFile: No valid filename provided.");
	}

	try {
		const response = await fetch(filename, {
			headers: { Accept: "application/json" },
		});

		if (!response.ok) {
			console.error(`HTTP ${response.status} fetching ${filename}`);
			return null;
		}

		return await response.json();
	} catch (error) {
		console.error(`Fetch/parse error for ${filename}:`, error);
		return null;
	}
}

/**
 * Safely extracts the game name from JSON data (which should have one top-level key).
 * @param {Object | null} jsonData - The parsed JSON data for a game.
 * @param {string} filename - The filename used to fetch this data (for logging).
 * @returns {string | null} The extracted game name or null if undetermined.
 */
export function getGameNameFromData(jsonData, filename) {
	if (!jsonData || typeof jsonData !== "object") return null;
	const keys = Object.keys(jsonData);
	if (keys.length === 1 && typeof keys[0] === "string" && keys[0].trim() !== "") {
		return keys[0].trim();
	}
	return null;
}

function hashString(value) {
	let hash = 2166136261;
	for (let i = 0; i < value.length; i++) {
		hash ^= value.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(36);
}

/**
 * Generates a consistent, sanitized ID for a person node based on their name.
 * Preserves Latin alphanumeric chars, common CJK characters (Hanzi/Kanji/Hangul),
 * Hiragana, Katakana, spaces, hyphens, and underscores.
 * Replaces separators with single underscores and provides fallbacks.
 *
 * @param {string | null | undefined} name - The name of the person.
 * @returns {string} A generated ID string (e.g., "person_john_smith", "person_홍진욱", "person_佐藤_太郎", "person_invalid_1").
 */
export function generatePersonId(name) {
	if (!name || typeof name !== "string" || name.trim() === "") {
		return "person_invalid_empty";
	}

	const sanitizedName = name
		.trim()
		.replace(/[\s_-]+/g, "_")
		.replace(/[^a-zA-Z0-9_\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uAC00-\uD7A3]+/g, "")
		.replace(/^_+|_+$/g, "");

	if (sanitizedName === "") {
		const hashed = hashString(name.trim());
		return `person_hashed_${hashed}`.substring(0, 60);
	}

	return `person_${sanitizedName}`.substring(0, 100);
}
