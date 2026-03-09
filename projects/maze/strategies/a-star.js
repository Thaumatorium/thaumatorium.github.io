import { buildSolveResult, linkedNeighbours, manhattan, reconstructPath } from "./helpers.js";

export const strategy = {
	id: "a-star",
	name: "A*",
	category: "full-map",
	solve(grid) {
		const frontier = [grid.start];
		const gScore = new Map([[grid.start, 0]]);
		const parentByNode = new Map();
		const seen = new Set([grid.start]);
		const searchOrder = [grid.start];

		while (frontier.length > 0) {
			frontier.sort((a, b) => gScore.get(a) + manhattan(grid, a, grid.end) - (gScore.get(b) + manhattan(grid, b, grid.end)));
			const current = frontier.shift();
			if (current === grid.end) {
				const path = reconstructPath(parentByNode, current);
				return buildSolveResult({ searchOrder, path });
			}
			for (const neighbour of linkedNeighbours(grid, current)) {
				const tentative = gScore.get(current) + 1;
				if (tentative < (gScore.get(neighbour) ?? Infinity)) {
					gScore.set(neighbour, tentative);
					parentByNode.set(neighbour, current);
					if (!seen.has(neighbour)) {
						seen.add(neighbour);
						searchOrder.push(neighbour);
						frontier.push(neighbour);
					}
				}
			}
		}
		return buildSolveResult({ searchOrder, path: [], deadEndOrder: [] });
	},
};
