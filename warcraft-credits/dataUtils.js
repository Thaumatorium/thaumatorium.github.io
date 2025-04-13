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
		const request = new Request(filename, {
			method: "GET",
			headers: { Accept: "application/json" },
		});
		const response = await fetch(request);

		if (!response.ok) {
			console.error(`HTTP Error ${response.status} (${response.statusText}) while fetching ${filename}`);
			return null;
		}

		const contentType = response.headers.get("content-type");
		if (!contentType || !contentType.includes("application/json")) {
			console.warn(`Received non-JSON Content-Type "${contentType}" for ${filename}. Attempting to parse anyway.`);
		}

		const data = await response.json();

		return data;
	} catch (error) {
		console.error(`Fetch or JSON parse error for ${filename}:`, error);
		return null;
	}
}

let invalidIdCounter = 0;

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
		invalidIdCounter++;
		const fallbackId = `person_invalid_${invalidIdCounter}`;
		console.warn(`Generating fallback ID "${fallbackId}" for invalid/empty name input:`, name);
		return fallbackId;
	}

	const sanitizedName = name
		.trim()
		.replace(/[\s_-]+/g, "_")
		.replace(/[^a-zA-Z0-9_\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uAC00-\uD7A3]+/g, "")
		.replace(/^_+|_+$/g, "");

	if (sanitizedName === "") {
		invalidIdCounter++;
		const originalSimplified = name.trim().replace(/[^a-zA-Z0-9]/g, "") || `original_empty_${invalidIdCounter}`;
		const fallbackId = `person_${originalSimplified}_sanitized_empty_${invalidIdCounter}`;
		console.warn(`Generating fallback ID "${fallbackId}" because name sanitized to empty:`, name);
		return fallbackId.substring(0, 60);
	}

	return `person_${sanitizedName}`.substring(0, 100);
}
