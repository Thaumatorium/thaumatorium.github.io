import { generatePersonId } from "./dataUtils.js";
import { gameTitleMap, NODE_TYPE_PERSON, NODE_TYPE_GAME, LINK_TYPE_WORKED_ON, CATEGORY_GAME, CATEGORY_SINGLE_GAME, CATEGORY_BOTH, CATEGORY_GAME1_ONLY, CATEGORY_GAME2_ONLY, CATEGORY_OTHER, DEFAULT_ROLE } from "./config.js";

/**
 * Generates a stable ID for a Game node based on its name for D3.
 * @param {string} gameName - The name of the game.
 * @returns {string} A generated ID string (e.g., "game_warcraft_1_orcs_vs_humans").
 */
function generateGameId(gameName) {
	if (!gameName || typeof gameName !== "string") return `game_invalid_${Date.now()}`;
	return `game_${gameName
		.toLowerCase()
		.replace(/[^a-z0-9_]+/g, "_")
		.replace(/[ _]+/g, "_")
		.replace(/^_+|_+$/g, "")}`;
}

/**
 * Extracts and normalizes the primary role for a person based on their roles array.
 * Takes the first valid role, otherwise returns DEFAULT_ROLE.
 * @param {Array<string> | undefined} roles - The array of roles for a person (e.g., ["Role1", "Role2"]).
 * @returns {string} The normalized primary role or DEFAULT_ROLE.
 */
function getPrimaryRole(roles) {
	if (Array.isArray(roles) && roles.length > 0 && roles[0] && typeof roles[0] === "string") {
		const role = roles[0].trim();
		return role ? role : DEFAULT_ROLE;
	}
	return DEFAULT_ROLE;
}

/**
 * Safely extracts the game name from the loaded JSON data (which should have one top-level key).
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
	console.warn(`Cannot extract game name: Expected one top-level key in ${filename}, found ${keys.length}. Keys:`, keys);
	return null;
}

/**
 * Processes the new person-centric JSON data from one or two files for D3.
 * Assumes JSON structure: { "Game Name": [ { "name": "Person", "roles": ["Role1", ...] }, ... ] }
 * Creates arrays of nodes (Person, Game) and links (Person -> Game).
 * Assigns categories (participation status) and primaryRole to Person nodes.
 * Populates the shared personRolesMap with all roles.
 * Calculates node degrees.
 *
 * @param {Object | null} jsonData1 - Parsed JSON data for the first selected game. Null if fetch failed.
 * @param {Object | null} jsonData2 - Parsed JSON data for the second selected game. Null if fetch failed.
 * @param {string} filename1 - The filename corresponding to jsonData1 (short version from dropdown).
 * @param {string} filename2 - The filename corresponding to jsonData2 (short version from dropdown).
 * @param {boolean} isSameGame - Indicates if data1 and data2 represent the same game file.
 * @param {Map<string, Set<string>>} personRolesMap - A Map instance passed by reference. Modified in place.
 * @returns {{nodes: Array, links: Array}} Object containing arrays of nodes and links formatted for D3.
 * @throws {Error} If crucial data (like game names) cannot be determined.
 */
export function processDataForD3(jsonData1, jsonData2, filename1, filename2, isSameGame, personRolesMap) {
	if (!jsonData1 && !jsonData2) {
		throw new Error("Both input data sources are missing or invalid.");
	}
	if (!jsonData1) console.warn("jsonData1 is missing or invalid for:", filename1);
	if (!jsonData2) console.warn("jsonData2 is missing or invalid for:", filename2);

	personRolesMap.clear();
	const nodes = [];
	const links = [];
	const nodesMap = new Map();

	const peopleMap1 = new Map();
	const peopleMap2 = new Map();
	const allPeopleNames = new Set();

	let gameName1 = null,
		gameId1 = null,
		game1DataNode = null;
	let gameName2 = null,
		gameId2 = null,
		game2DataNode = null;

	const addNode = (nodeData) => {
		if (!nodesMap.has(nodeData.id)) {
			nodes.push(nodeData);
			nodesMap.set(nodeData.id, nodeData);
			nodeData.degree = nodeData.degree === undefined ? 0 : nodeData.degree;
			return true;
		}
		return false;
	};

	if (jsonData1) {
		gameName1 = getGameNameFromData(jsonData1, filename1) || gameTitleMap[filename1];
		if (!gameName1) {
			gameName1 = filename1
				.replace(".json", "")
				.replace(/_/g, " ")
				.replace(/\b\w/g, (l) => l.toUpperCase());
			console.warn(`Using filename guess fallback for Game 1: ${gameName1}`);
		}

		if (gameName1) {
			gameId1 = generateGameId(gameName1);
			game1DataNode = {
				id: gameId1,
				name: gameName1,
				type: NODE_TYPE_GAME,
				category: CATEGORY_GAME,
				gameIndex: 1,
				degree: 0,
			};
			addNode(game1DataNode);

			const peopleArray1 = jsonData1[gameName1];
			if (Array.isArray(peopleArray1)) {
				peopleArray1.forEach((personObj) => {
					if (personObj?.name && typeof personObj.name === "string") {
						const name = personObj.name.trim();
						if (name) {
							allPeopleNames.add(name);
							const roles = Array.isArray(personObj.roles) ? personObj.roles.map((r) => String(r).trim()).filter(Boolean) : [];
							peopleMap1.set(name, {
								roles: roles.length > 0 ? roles : [DEFAULT_ROLE],
							});
						}
					}
				});
			} else {
				console.warn(`Game 1 data for '${gameName1}' is not an array in ${filename1}`);
			}
		} else {
			console.error(`Could not determine identity for Game 1 from ${filename1}.`);
		}
	} else {
		console.error(`Could not load data for Game 1 (${filename1}).`);
	}

	if (!isSameGame && jsonData2) {
		gameName2 = getGameNameFromData(jsonData2, filename2) || gameTitleMap[filename2];
		if (!gameName2) {
			gameName2 = filename2
				.replace(".json", "")
				.replace(/_/g, " ")
				.replace(/\b\w/g, (l) => l.toUpperCase());
			console.warn(`Using filename guess fallback for Game 2: ${gameName2}`);
		}

		if (gameName2) {
			gameId2 = generateGameId(gameName2);
			if (gameId1 && gameId1 === gameId2) {
				console.warn(`Game 2 ('${gameName2}') resolved to the same ID as Game 1 ('${gameName1}'). Treating as single game view.`);
				isSameGame = true;
				gameName2 = gameName1;
				gameId2 = gameId1;
				game2DataNode = game1DataNode;
			} else {
				game2DataNode = {
					id: gameId2,
					name: gameName2,
					type: NODE_TYPE_GAME,
					category: CATEGORY_GAME,
					gameIndex: 2,
					degree: 0,
				};
				addNode(game2DataNode);

				const peopleArray2 = jsonData2[gameName2];
				if (Array.isArray(peopleArray2)) {
					peopleArray2.forEach((personObj) => {
						if (personObj?.name && typeof personObj.name === "string") {
							const name = personObj.name.trim();
							if (name) {
								allPeopleNames.add(name);
								const roles = Array.isArray(personObj.roles) ? personObj.roles.map((r) => String(r).trim()).filter(Boolean) : [];
								peopleMap2.set(name, {
									roles: roles.length > 0 ? roles : [DEFAULT_ROLE],
								});
							}
						}
					});
				} else {
					console.warn(`Game 2 data for '${gameName2}' is not an array in ${filename2}`);
				}
			}
		} else {
			console.error(`Could not determine identity for Game 2 from ${filename2}.`);

			if (gameId1) {
				isSameGame = true;
				gameName2 = gameName1;
				gameId2 = gameId1;
				game2DataNode = game1DataNode;
			}
		}
	} else if (isSameGame && gameId1) {
		gameName2 = gameName1;
		gameId2 = gameId1;
		game2DataNode = game1DataNode;
	}

	if (!gameId1 && !gameId2) {
		throw new Error("Could not identify or load data for either selected game. Cannot process contributors.");
	}

	allPeopleNames.forEach((personName) => {
		const personId = generatePersonId(personName);
		const personData1 = peopleMap1.get(personName);
		const personData2 = isSameGame ? personData1 : peopleMap2.get(personName);

		const inGame1 = !!personData1;
		const inGame2 = !!personData2;

		let category = CATEGORY_OTHER;
		let primaryRole = DEFAULT_ROLE;
		let personNodeData = null;
		let shouldProcessPerson = false;
		let rolesForMap = [];

		if (isSameGame) {
			if (inGame1) {
				category = CATEGORY_SINGLE_GAME;
				shouldProcessPerson = true;
				rolesForMap = personData1.roles || [DEFAULT_ROLE];
				primaryRole = getPrimaryRole(rolesForMap);
			}
		} else {
			if (inGame1 && inGame2) {
				category = CATEGORY_BOTH;
				shouldProcessPerson = true;
				rolesForMap = [...new Set([...(personData1.roles || []), ...(personData2.roles || [])])];
				if (rolesForMap.length === 0) rolesForMap.push(DEFAULT_ROLE);

				primaryRole = getPrimaryRole(personData1.roles) !== DEFAULT_ROLE ? getPrimaryRole(personData1.roles) : getPrimaryRole(personData2.roles);
			} else if (inGame1) {
				category = CATEGORY_GAME1_ONLY;
				shouldProcessPerson = true;
				rolesForMap = personData1.roles || [DEFAULT_ROLE];
				primaryRole = getPrimaryRole(rolesForMap);
			} else if (inGame2) {
				category = CATEGORY_GAME2_ONLY;
				shouldProcessPerson = true;
				rolesForMap = personData2.roles || [DEFAULT_ROLE];
				primaryRole = getPrimaryRole(rolesForMap);
			}
		}

		if (shouldProcessPerson) {
			primaryRole = primaryRole && primaryRole !== DEFAULT_ROLE ? primaryRole : getPrimaryRole(rolesForMap);

			if (!nodesMap.has(personId)) {
				personNodeData = {
					id: personId,
					name: personName,
					type: NODE_TYPE_PERSON,
					category: category,
					primaryRole: primaryRole,
					degree: 0,
				};
				addNode(personNodeData);
			} else {
				personNodeData = nodesMap.get(personId);
				personNodeData.category = category;
				personNodeData.primaryRole = primaryRole;
			}

			const rolesSet = personRolesMap.get(personId) || new Set();
			if (!personRolesMap.has(personId)) {
				personRolesMap.set(personId, rolesSet);
			}
			rolesForMap.forEach((role) => rolesSet.add(role));
			if (rolesSet.size === 0) {
				rolesSet.add(DEFAULT_ROLE);
			}

			if (inGame1 && gameId1) {
				links.push({
					source: personId,
					target: gameId1,
					type: LINK_TYPE_WORKED_ON,
				});
			}

			if (!isSameGame && inGame2 && gameId2) {
				links.push({
					source: personId,
					target: gameId2,
					type: LINK_TYPE_WORKED_ON,
				});
			}
		}
	});

	nodes.forEach((node) => (node.degree = 0));

	links.forEach((link) => {
		const sourceNode = nodesMap.get(link.source);
		const targetNode = nodesMap.get(link.target);
		if (sourceNode) {
			sourceNode.degree++;
		} else {
			console.warn(`Degree calculation: Source node ${link.source} not found in nodesMap.`);
		}
		if (targetNode) {
			targetNode.degree++;
		} else {
			console.warn(`Degree calculation: Target node ${link.target} not found in nodesMap.`);
		}
	});

	console.log(`D3 Processor: Created ${nodes.length} nodes and ${links.length} links.`);
	console.log(`D3 Processor: Role map contains ${personRolesMap.size} entries.`);
	return { nodes, links };
}
