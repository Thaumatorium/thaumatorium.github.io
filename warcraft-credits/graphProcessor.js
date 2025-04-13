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
	console.warn(`Cannot extract game name: Expected one top-level key in ${filename}, found ${keys.length}. Using title map fallback.`);
	return null;
}

/**
 * Checks if a person matches the provided name and role filters,
 * handling multiple comma-separated terms.
 *
 * @param {string} personName - The name of the person.
 * @param {Set<string>} personRoles - A Set of roles the person has.
 * @param {object} filters - Filter criteria: { name: { terms: string[], mode: string }, role: { terms: string[], mode: string } }.
 * @returns {boolean} True if the person passes all active filters, false otherwise.
 */
function passesFilters(personName, personRoles, filters) {
	const nameFilterTerms = filters.name.terms.map((t) => t.toLowerCase());
	const nameFilterMode = filters.name.mode;
	const roleFilterTerms = filters.role.terms.map((t) => t.toLowerCase());
	const roleFilterMode = filters.role.mode;

	let namePass = true;
	if (nameFilterTerms.length > 0) {
		const lowerPersonName = personName.toLowerCase();
		switch (nameFilterMode) {
			case "contains": // OR logic: Pass if name contains ANY term
				namePass = nameFilterTerms.some((term) => lowerPersonName.includes(term));
				break;
			case "not_contains": // AND logic: Pass if name contains NONE of the terms
				namePass = !nameFilterTerms.some((term) => lowerPersonName.includes(term));
				break;
			case "exact": // OR logic: Pass if name exactly matches ANY term
				namePass = nameFilterTerms.some((term) => lowerPersonName === term);
				break;
			case "not_exact": // AND logic: Pass if name exactly matches NONE of the terms
				namePass = !nameFilterTerms.some((term) => lowerPersonName === term);
				break;
		}
	}

	// If name filter fails, no need to check roles
	if (!namePass) return false;

	let rolePass = true;
	if (roleFilterTerms.length > 0) {
		const lowerPersonRoles = Array.from(personRoles).map((r) => r.toLowerCase());

		// Handle cases where the person has no roles
		if (lowerPersonRoles.length === 0) {
			// If filtering for inclusion ('contains', 'exact'), having no roles means automatic fail.
			// If filtering for exclusion ('not_contains', 'not_exact'), having no roles means automatic pass.
			rolePass = roleFilterMode === "not_contains" || roleFilterMode === "not_exact";
		} else {
			// Person has roles, apply term logic
			switch (roleFilterMode) {
				case "contains": // OR logic: Pass if ANY role contains ANY term
					rolePass = lowerPersonRoles.some((role) => roleFilterTerms.some((term) => role.includes(term)));
					break;
				case "not_contains": // AND logic: Pass if NO role contains ANY of the terms
					rolePass = !lowerPersonRoles.some((role) => roleFilterTerms.some((term) => role.includes(term)));
					break;
				case "exact": // OR logic: Pass if ANY role exactly matches ANY term
					rolePass = lowerPersonRoles.some((role) => roleFilterTerms.some((term) => role === term));
					break;
				case "not_exact": // AND logic: Pass if NO role exactly matches ANY of the terms
					rolePass = !lowerPersonRoles.some((role) => roleFilterTerms.some((term) => role === term));
					break;
			}
		}
	}

	// Must pass both name and role filters
	return namePass && rolePass;
}

/**
 * Processes the new person-centric JSON data for D3.
 * Applies multi-term filters.
 * // ... (rest of JSDoc remains the same) ...
 * @param {object} filters - Filter criteria: { name: { terms: string[], mode: string }, role: { terms: string[], mode: string } }. // Updated type
 * @returns {{nodes: Array, links: Array, filteredStats1: object|null, filteredStats2: object|null}}
 */
export function processDataForD3(jsonData1, jsonData2, filename1, filename2, isSameGame, personRolesMap, filters) {
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
		gameId1 = null;
	let gameName2 = null,
		gameId2 = null;

	const addNode = (nodeData) => {
		if (!nodesMap.has(nodeData.id)) {
			nodes.push(nodeData);
			nodesMap.set(nodeData.id, nodeData);
			nodeData.degree = 0;
			return true;
		}
		return false;
	};

	// Phase 1: Extract all potential people and their roles
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
			const peopleArray1 = jsonData1[gameName1];
			if (Array.isArray(peopleArray1)) {
				peopleArray1.forEach((personObj) => {
					const name = personObj?.name?.trim();
					if (name) {
						allPeopleNames.add(name);
						const roles = new Set((Array.isArray(personObj.roles) ? personObj.roles : []).map((r) => String(r).trim()).filter(Boolean));
						if (roles.size === 0) roles.add(DEFAULT_ROLE);
						peopleMap1.set(name, { roles });
					}
				});
			} else console.warn(`Game 1 data for '${gameName1}' is not an array in ${filename1}`);
		} else console.error(`Could not determine identity for Game 1 from ${filename1}.`);
	} else console.error(`Could not load data for Game 1 (${filename1}).`);

	// Process Game 2
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
				console.warn(`Game 2 ('${gameName2}') resolved to the same ID as Game 1 ('${gameName1}'). Forcing single game view.`);
				isSameGame = true;
				gameName2 = gameName1;
				gameId2 = gameId1;
			} else {
				const peopleArray2 = jsonData2[gameName2];
				if (Array.isArray(peopleArray2)) {
					peopleArray2.forEach((personObj) => {
						const name = personObj?.name?.trim();
						if (name) {
							allPeopleNames.add(name);
							const roles = new Set((Array.isArray(personObj.roles) ? personObj.roles : []).map((r) => String(r).trim()).filter(Boolean));
							if (roles.size === 0) roles.add(DEFAULT_ROLE);
							// Only add to map2 if name not already in map1 to avoid overwriting
							// OR always add/overwrite if distinct people can exist with same name?
							// Let's assume names are unique identifiers for now, so only add if not in map1.
							// This needs clarification based on data structure. If needed, merge roles later.
							// Sticking with the simple approach: overwrite/update roles in peopleMap2.
							peopleMap2.set(name, { roles });
						}
					});
				} else console.warn(`Game 2 data for '${gameName2}' is not an array in ${filename2}`);
			}
		} else {
			console.error(`Could not determine identity for Game 2 from ${filename2}.`);
			if (gameId1) {
				isSameGame = true;
				gameName2 = gameName1;
				gameId2 = gameId1;
			}
		}
	} else if (isSameGame && gameId1) {
		gameName2 = gameName1;
		gameId2 = gameId1;
	}

	if (!gameId1 && !gameId2) {
		throw new Error("Could not identify or load data for either selected game. Cannot process contributors.");
	}

	// Phase 2: Filter people and create final nodes/links
	const filteredPeopleGame1 = new Set();
	const filteredPeopleGame2 = new Set();
	const filteredUniqueRolesGame1 = new Set();
	const filteredUniqueRolesGame2 = new Set();

	allPeopleNames.forEach((personName) => {
		const personId = generatePersonId(personName);
		const personData1 = peopleMap1.get(personName);
		const personData2 = isSameGame ? personData1 : peopleMap2.get(personName);

		const inGame1 = !!personData1;
		const inGame2 = !!personData2;

		// Combine all unique roles across both games for this person for filtering check
		const allRolesForPerson = new Set();
		if (personData1) personData1.roles.forEach((role) => allRolesForPerson.add(role));
		if (personData2 && !isSameGame) personData2.roles.forEach((role) => allRolesForPerson.add(role));
		if (allRolesForPerson.size === 0 && (inGame1 || inGame2)) {
			// Ensure default role is considered if person exists but has no listed roles
			allRolesForPerson.add(DEFAULT_ROLE);
		}

		// +++ Apply Filters (using the updated passesFilters) +++
		if (!passesFilters(personName, allRolesForPerson, filters)) {
			return; // Skip this person
		}

		// Person passed filters, proceed
		let category = CATEGORY_OTHER;
		let primaryRole = DEFAULT_ROLE;
		let rolesForNodeCreation = []; // Roles specific to the context (game1, game2, or both)

		if (isSameGame) {
			if (inGame1) {
				category = CATEGORY_SINGLE_GAME;
				rolesForNodeCreation = Array.from(personData1.roles);
				primaryRole = getPrimaryRole(rolesForNodeCreation);
				filteredPeopleGame1.add(personId);
				personData1.roles.forEach((role) => filteredUniqueRolesGame1.add(role));
			}
		} else {
			// Two different games
			if (inGame1 && inGame2) {
				category = CATEGORY_BOTH;
				const combinedRoles = new Set([...personData1.roles, ...personData2.roles]);
				rolesForNodeCreation = Array.from(combinedRoles);
				primaryRole = getPrimaryRole(Array.from(personData1.roles)) !== DEFAULT_ROLE ? getPrimaryRole(Array.from(personData1.roles)) : getPrimaryRole(Array.from(personData2.roles));

				filteredPeopleGame1.add(personId);
				personData1.roles.forEach((role) => filteredUniqueRolesGame1.add(role));
				filteredPeopleGame2.add(personId);
				personData2.roles.forEach((role) => filteredUniqueRolesGame2.add(role));
			} else if (inGame1) {
				category = CATEGORY_GAME1_ONLY;
				rolesForNodeCreation = Array.from(personData1.roles);
				primaryRole = getPrimaryRole(rolesForNodeCreation);
				filteredPeopleGame1.add(personId);
				personData1.roles.forEach((role) => filteredUniqueRolesGame1.add(role));
			} else if (inGame2) {
				category = CATEGORY_GAME2_ONLY;
				rolesForNodeCreation = Array.from(personData2.roles);
				primaryRole = getPrimaryRole(rolesForNodeCreation);
				filteredPeopleGame2.add(personId);
				personData2.roles.forEach((role) => filteredUniqueRolesGame2.add(role));
			}
		}

		// Ensure primary role validity
		primaryRole = primaryRole !== DEFAULT_ROLE ? primaryRole : getPrimaryRole(rolesForNodeCreation) || DEFAULT_ROLE;

		// Add/update person node if they contributed to at least one game contextually
		if (category !== CATEGORY_OTHER) {
			let personNodeData = nodesMap.get(personId);
			if (!personNodeData) {
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
				// Update existing node if somehow added before (should be rare now)
				personNodeData.category = category;
				personNodeData.primaryRole = primaryRole;
			}

			// Populate the output personRolesMap with the roles used for node creation context
			const rolesSetForOutput = new Set(rolesForNodeCreation);
			if (rolesSetForOutput.size === 0) rolesSetForOutput.add(DEFAULT_ROLE);
			personRolesMap.set(personId, rolesSetForOutput);

			// Add links
			if (inGame1 && gameId1) {
				links.push({ source: personId, target: gameId1, type: LINK_TYPE_WORKED_ON });
			}
			if (!isSameGame && inGame2 && gameId2) {
				links.push({ source: personId, target: gameId2, type: LINK_TYPE_WORKED_ON });
			}
		}
	});

	// Phase 3: Add Game Nodes, Calculate Degrees/Stats (remains the same)
	let game1DataNode = null;
	let game2DataNode = null;

	if (gameId1 && links.some((link) => link.target === gameId1 || link.source === gameId1)) {
		game1DataNode = {
			id: gameId1,
			name: gameName1,
			type: NODE_TYPE_GAME,
			category: CATEGORY_GAME,
			gameIndex: 1,
			degree: 0,
		};
		addNode(game1DataNode);
	} else if (gameId1) {
		console.log(`Processor: Game 1 (${gameName1 || "ID:" + gameId1}) has no links after filtering. Node not added.`);
	}

	if (gameId2 && !isSameGame && links.some((link) => link.target === gameId2 || link.source === gameId2)) {
		game2DataNode = {
			id: gameId2,
			name: gameName2,
			type: NODE_TYPE_GAME,
			category: CATEGORY_GAME,
			gameIndex: 2,
			degree: 0,
		};
		addNode(game2DataNode);
	} else if (gameId2 && !isSameGame) {
		console.log(`Processor: Game 2 (${gameName2 || "ID:" + gameId2}) has no links after filtering. Node not added.`);
	} else if (isSameGame && game1DataNode) {
		game2DataNode = game1DataNode; // Point to the same node object
	}

	// Calculate degrees based on the final nodes and links
	nodes.forEach((node) => (node.degree = 0));

	links.forEach((link) => {
		const sourceNode = nodesMap.get(link.source);
		const targetNode = nodesMap.get(link.target);
		if (sourceNode) sourceNode.degree++;
		if (targetNode) targetNode.degree++;
	});

	// Calculate filtered stats based on the sets populated during filtering
	const filteredStats1 = game1DataNode
		? {
				personCount: filteredPeopleGame1.size,
				uniqueRoleCount: filteredUniqueRolesGame1.size,
			}
		: null;

	const filteredStats2 = game2DataNode
		? {
				// Use game 1 sets if same game, otherwise game 2 sets
				personCount: isSameGame ? filteredPeopleGame1.size : filteredPeopleGame2.size,
				uniqueRoleCount: isSameGame ? filteredUniqueRolesGame1.size : filteredUniqueRolesGame2.size,
			}
		: null;

	console.log(`D3 Processor: Filtered to ${nodes.length} nodes and ${links.length} links.`);
	console.log(`D3 Processor: Filtered Role map contains ${personRolesMap.size} entries.`);

	return { nodes, links, filteredStats1, filteredStats2 };
}
