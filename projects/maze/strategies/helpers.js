import { coordsOf, shuffle } from "../generators/helpers.js";

export const linkedNeighbours = (grid, node) => [...(grid.links[node] ?? [])];

export const reconstructPath = (parentByNode, end) => {
	const path = [];
	let cursor = end;
	while (cursor !== undefined) {
		path.push(cursor);
		cursor = parentByNode.get(cursor);
	}
	return path.reverse();
};

export const defaultDeadEndOrder = (searchOrder, path) => {
	const pathSet = new Set(path);
	return searchOrder.filter((index) => !pathSet.has(index)).reverse();
};

export const buildSolveResult = ({ searchOrder, path, deadEndOrder = defaultDeadEndOrder(searchOrder, path), steps = searchOrder.length }) => ({
	searchOrder,
	path,
	deadEndOrder,
	steps,
});

export const manhattan = (grid, a, b) => {
	const ca = coordsOf(grid, a);
	const cb = coordsOf(grid, b);
	return Math.abs(ca.x - cb.x) + Math.abs(ca.y - cb.y);
};

export const solveWithFrontier = (grid, { popFrontier, pushFrontier = (frontier, value) => frontier.push(value), score = () => 0 }) => {
	const frontier = [grid.start];
	const visited = new Set([grid.start]);
	const parentByNode = new Map();
	const searchOrder = [grid.start];

	while (frontier.length > 0) {
		frontier.sort((a, b) => score(a, parentByNode) - score(b, parentByNode));
		const current = popFrontier(frontier);

		if (current === grid.end) {
			const path = reconstructPath(parentByNode, current);
			return buildSolveResult({ searchOrder, path });
		}

		for (const neighbour of shuffle(linkedNeighbours(grid, current))) {
			if (visited.has(neighbour)) continue;
			visited.add(neighbour);
			parentByNode.set(neighbour, current);
			pushFrontier(frontier, neighbour);
			searchOrder.push(neighbour);
		}
	}

	return buildSolveResult({ searchOrder, path: [], deadEndOrder: [] });
};

export const getDirectionalMap = (grid, node) => {
	const result = new Map();
	const { x, y } = coordsOf(grid, node);
	for (const neighbour of linkedNeighbours(grid, node)) {
		const target = coordsOf(grid, neighbour);
		if (target.x === x && target.y === y - 1) result.set("north", neighbour);
		if (target.x === x + 1 && target.y === y) result.set("east", neighbour);
		if (target.x === x && target.y === y + 1) result.set("south", neighbour);
		if (target.x === x - 1 && target.y === y) result.set("west", neighbour);
	}
	return result;
};

export const turnLeft = (heading) => ({ north: "west", west: "south", south: "east", east: "north" })[heading];
export const turnRight = (heading) => ({ north: "east", east: "south", south: "west", west: "north" })[heading];
export const turnBack = (heading) => ({ north: "south", south: "north", east: "west", west: "east" })[heading];

export const firstAvailableHeading = (grid, node) => {
	for (const heading of ["north", "east", "south", "west"]) {
		if (getDirectionalMap(grid, node).has(heading)) {
			return heading;
		}
	}
	return "east";
};
