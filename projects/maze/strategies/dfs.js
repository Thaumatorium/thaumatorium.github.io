import { buildSolveResult, linkedNeighbours, reconstructPath } from "./helpers.js";
import { shuffle } from "../generators/helpers.js";

export const strategy = {
	id: "dfs",
	name: "Depth-first search (DFS)",
	category: "full-map",
	solve(grid) {
		const stack = [grid.start];
		const visited = new Set([grid.start]);
		const parentByNode = new Map();
		const searchOrder = [grid.start];
		const deadEndOrder = [];

		while (stack.length > 0) {
			const current = stack[stack.length - 1];
			if (current === grid.end) {
				const path = reconstructPath(parentByNode, current);
				return buildSolveResult({
					searchOrder,
					path,
					deadEndOrder,
					steps: searchOrder.length + deadEndOrder.length,
				});
			}
			const next = shuffle(linkedNeighbours(grid, current)).find((neighbour) => !visited.has(neighbour));
			if (next !== undefined) {
				visited.add(next);
				parentByNode.set(next, current);
				searchOrder.push(next);
				stack.push(next);
				continue;
			}
			const dead = stack.pop();
			if (dead !== grid.start) {
				deadEndOrder.push(dead);
			}
		}

		return buildSolveResult({
			searchOrder,
			path: [],
			deadEndOrder,
			steps: searchOrder.length + deadEndOrder.length,
		});
	},
};
