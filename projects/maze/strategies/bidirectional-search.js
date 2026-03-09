import { buildSolveResult, linkedNeighbours, reconstructPath } from "./helpers.js";

const expand = (queue, visited, parent, otherVisited, searchOrder, appendPath) => {
	const current = queue.shift();
	for (const neighbour of linkedNeighbours(appendPath.grid, current)) {
		if (visited.has(neighbour)) continue;
		visited.add(neighbour);
		parent.set(neighbour, current);
		searchOrder.push(neighbour);
		if (otherVisited.has(neighbour)) {
			return neighbour;
		}
		queue.push(neighbour);
	}
	return null;
};

export const strategy = {
	id: "bidirectional-search",
	name: "Bidirectional search",
	category: "full-map",
	solve(grid) {
		const forwardQueue = [grid.start];
		const backwardQueue = [grid.end];
		const forwardVisited = new Set([grid.start]);
		const backwardVisited = new Set([grid.end]);
		const forwardParent = new Map();
		const backwardParent = new Map();
		const searchOrder = [grid.start, grid.end];
		let meet = null;

		while (forwardQueue.length > 0 && backwardQueue.length > 0 && meet === null) {
			meet = expand(forwardQueue, forwardVisited, forwardParent, backwardVisited, searchOrder, { grid });
			if (meet !== null) break;
			meet = expand(backwardQueue, backwardVisited, backwardParent, forwardVisited, searchOrder, { grid });
		}

		if (meet === null) {
			return buildSolveResult({ searchOrder, path: [], deadEndOrder: [] });
		}

		const forwardPath = reconstructPath(forwardParent, meet);
		const backwardPath = [];
		let cursor = backwardParent.get(meet);
		while (cursor !== undefined) {
			backwardPath.push(cursor);
			cursor = backwardParent.get(cursor);
		}
		const path = [...forwardPath, ...backwardPath];
		return buildSolveResult({ searchOrder, path });
	},
};
