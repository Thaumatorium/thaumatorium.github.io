import { buildSolveResult, linkedNeighbours, reconstructPath } from "./helpers.js";

export const strategy = {
	id: "dijkstra",
	name: "Dijkstra",
	category: "full-map",
	solve(grid) {
		const frontier = [grid.start];
		const distance = new Map([[grid.start, 0]]);
		const parentByNode = new Map();
		const searchOrder = [grid.start];
		const seen = new Set([grid.start]);

		while (frontier.length > 0) {
			frontier.sort((a, b) => distance.get(a) - distance.get(b));
			const current = frontier.shift();
			if (current === grid.end) {
				const path = reconstructPath(parentByNode, current);
				return buildSolveResult({ searchOrder, path });
			}
			for (const neighbour of linkedNeighbours(grid, current)) {
				const tentative = distance.get(current) + 1;
				if (tentative < (distance.get(neighbour) ?? Infinity)) {
					distance.set(neighbour, tentative);
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
