import { generatePersonId, getGameNameFromData } from "./dataUtils.js";
import { gameTitleMap, NODE_TYPE_PERSON, NODE_TYPE_GAME, LINK_TYPE_WORKED_ON, CATEGORY_GAME, CATEGORY_SINGLE_GAME, CATEGORY_MULTI_GAME, DEFAULT_ROLE } from "./config.js";

function generateGameId(gameName, filename, index) {
	const base = `${gameName || filename || "unknown"}_${filename || index || "game"}`
		.toLowerCase()
		.replace(/[^a-z0-9_]+/g, "_")
		.replace(/[ _]+/g, "_")
		.replace(/^_+|_+$/g, "");
	return `game_${base || `fallback_${index}`}`;
}

function collectRoles(personObj) {
	const roles = new Set((Array.isArray(personObj?.roles) ? personObj.roles : []).map((role) => String(role).trim()).filter(Boolean));
	if (roles.size === 0) roles.add(DEFAULT_ROLE);
	return roles;
}

function addPersonToMap(peopleMap, allPeopleNames, personObj) {
	const name = personObj?.name?.trim();
	if (!name) return;

	allPeopleNames.add(name);
	const roles = collectRoles(personObj);
	const existing = peopleMap.get(name);
	if (existing) {
		roles.forEach((role) => existing.roles.add(role));
		return;
	}

	peopleMap.set(name, { roles });
}

function getPrimaryRole(contributions) {
	for (const contribution of contributions) {
		for (const role of contribution.roles) {
			if (role && role !== DEFAULT_ROLE) return role;
		}
	}
	return contributions[0]?.roles?.[0] ?? DEFAULT_ROLE;
}

function passesFilters(personName, personRoles, filters) {
	const nameFilterTerms = filters.name.terms.map((term) => term.toLowerCase());
	const nameFilterMode = filters.name.mode;
	const roleFilterTerms = filters.role.terms.map((term) => term.toLowerCase());
	const roleFilterMode = filters.role.mode;

	let namePass = true;
	if (nameFilterTerms.length > 0) {
		const lowerPersonName = personName.toLowerCase();
		switch (nameFilterMode) {
			case "contains":
				namePass = nameFilterTerms.some((term) => lowerPersonName.includes(term));
				break;
			case "not_contains":
				namePass = !nameFilterTerms.some((term) => lowerPersonName.includes(term));
				break;
			case "exact":
				namePass = nameFilterTerms.some((term) => lowerPersonName === term);
				break;
			case "not_exact":
				namePass = !nameFilterTerms.some((term) => lowerPersonName === term);
				break;
		}
	}

	if (!namePass) return false;

	let rolePass = true;
	if (roleFilterTerms.length > 0) {
		const lowerPersonRoles = Array.from(personRoles).map((role) => role.toLowerCase());
		if (lowerPersonRoles.length === 0) {
			rolePass = roleFilterMode === "not_contains" || roleFilterMode === "not_exact";
		} else {
			switch (roleFilterMode) {
				case "contains":
					rolePass = lowerPersonRoles.some((role) => roleFilterTerms.some((term) => role.includes(term)));
					break;
				case "not_contains":
					rolePass = !lowerPersonRoles.some((role) => roleFilterTerms.some((term) => role.includes(term)));
					break;
				case "exact":
					rolePass = lowerPersonRoles.some((role) => roleFilterTerms.some((term) => role === term));
					break;
				case "not_exact":
					rolePass = !lowerPersonRoles.some((role) => roleFilterTerms.some((term) => role === term));
					break;
			}
		}
	}

	return namePass && rolePass;
}

function buildRoleDetails(contributions) {
	const allRoles = new Set();
	const repeatedRoleCounts = new Map();
	const games = contributions.map((contribution) => {
		const roleSet = new Set(contribution.roles);
		roleSet.forEach((role) => {
			allRoles.add(role);
			repeatedRoleCounts.set(role, (repeatedRoleCounts.get(role) ?? 0) + 1);
		});
		return {
			gameId: contribution.gameId,
			gameName: contribution.gameName,
			roles: roleSet,
		};
	});

	const repeatedRoles = new Set(
		Array.from(repeatedRoleCounts.entries())
			.filter(([, count]) => count > 1)
			.map(([role]) => role)
	);

	return {
		allRoles,
		repeatedRoles,
		games,
	};
}

function getPeopleArray(jsonData, gameName) {
	if (gameName && Array.isArray(jsonData?.[gameName])) {
		return jsonData[gameName];
	}
	for (const key of Object.keys(jsonData ?? {})) {
		if (Array.isArray(jsonData[key])) {
			return jsonData[key];
		}
	}
	return [];
}

function resolveGameDatasets(gameDatasets) {
	return gameDatasets
		.map(({ filename, jsonData }, index) => {
			const gameName =
				getGameNameFromData(jsonData, filename) ||
				gameTitleMap[filename] ||
				filename
					.replace(".json", "")
					.replace(/_/g, " ")
					.replace(/\b\w/g, (letter) => letter.toUpperCase());

			const gameId = generateGameId(gameName, filename, index + 1);
			const peopleMap = new Map();
			const peopleArray = getPeopleArray(jsonData, gameName);
			const allPeopleNames = new Set();
			peopleArray.forEach((personObj) => addPersonToMap(peopleMap, allPeopleNames, personObj));

			return {
				filename,
				gameId,
				gameIndex: index + 1,
				gameName,
				peopleMap,
			};
		})
		.filter((gameData) => gameData.gameName);
}

export function processDataForD3(gameDatasets, personRolesMap, filters) {
	if (!Array.isArray(gameDatasets) || gameDatasets.length === 0) {
		throw new Error("No input data sources are available.");
	}

	personRolesMap.clear();
	const nodes = [];
	const links = [];
	const nodesMap = new Map();
	const resolvedGames = resolveGameDatasets(gameDatasets);

	if (resolvedGames.length === 0) {
		throw new Error("Could not identify any selected games.");
	}

	const allPeopleNames = new Set();
	resolvedGames.forEach((gameData) => {
		gameData.peopleMap.forEach((_, personName) => allPeopleNames.add(personName));
	});

	const perGameTracking = new Map(
		resolvedGames.map((gameData) => [
			gameData.gameId,
			{
				filename: gameData.filename,
				gameId: gameData.gameId,
				gameName: gameData.gameName,
				personIds: new Set(),
				roles: new Set(),
			},
		])
	);

	const addNode = (nodeData) => {
		if (!nodesMap.has(nodeData.id)) {
			nodes.push(nodeData);
			nodesMap.set(nodeData.id, nodeData);
		}
		return nodesMap.get(nodeData.id);
	};

	resolvedGames.forEach((gameData) => {
		addNode({
			id: gameData.gameId,
			name: gameData.gameName,
			type: NODE_TYPE_GAME,
			category: CATEGORY_GAME,
			gameIndex: gameData.gameIndex,
			degree: 0,
		});
	});

	let sharedCount = 0;

	allPeopleNames.forEach((personName) => {
		const contributions = resolvedGames
			.map((gameData) => {
				const personData = gameData.peopleMap.get(personName);
				if (!personData) return null;
				return {
					gameId: gameData.gameId,
					gameName: gameData.gameName,
					roles: Array.from(personData.roles),
				};
			})
			.filter(Boolean);

		if (contributions.length === 0) return;

		const roleDetails = buildRoleDetails(contributions);
		if (roleDetails.allRoles.size === 0) {
			roleDetails.allRoles.add(DEFAULT_ROLE);
		}
		if (!passesFilters(personName, roleDetails.allRoles, filters)) {
			return;
		}

		const personId = generatePersonId(personName);
		const category = contributions.length > 1 ? CATEGORY_MULTI_GAME : CATEGORY_SINGLE_GAME;
		const primaryRole = getPrimaryRole(contributions);

		addNode({
			id: personId,
			name: personName,
			type: NODE_TYPE_PERSON,
			category,
			primaryRole,
			contributionCount: contributions.length,
			gameIds: contributions.map((contribution) => contribution.gameId),
			degree: 0,
		});

		personRolesMap.set(personId, roleDetails);

		if (contributions.length > 1) {
			sharedCount++;
		}

		contributions.forEach((contribution) => {
			links.push({
				source: personId,
				target: contribution.gameId,
				type: LINK_TYPE_WORKED_ON,
			});

			const tracking = perGameTracking.get(contribution.gameId);
			tracking.personIds.add(personId);
			contribution.roles.forEach((role) => tracking.roles.add(role));
		});
	});

	nodes.forEach((node) => {
		node.degree = 0;
	});

	links.forEach((link) => {
		const sourceNode = nodesMap.get(link.source);
		const targetNode = nodesMap.get(link.target);
		if (sourceNode) sourceNode.degree++;
		if (targetNode) targetNode.degree++;
	});

	const perGameStats = resolvedGames.map((gameData) => {
		const tracking = perGameTracking.get(gameData.gameId);
		return {
			filename: gameData.filename,
			gameId: gameData.gameId,
			gameName: gameData.gameName,
			personCount: tracking.personIds.size,
			uniqueRoleCount: tracking.roles.size,
		};
	});

	return {
		nodes,
		links,
		perGameStats,
		sharedCount,
		selectedGameCount: resolvedGames.length,
	};
}
