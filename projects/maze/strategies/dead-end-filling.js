import { buildSolveResult, linkedNeighbours } from "./helpers.js";

export const strategy = {
	id: "dead-end-filling",
	name: "Dead-end filling",
	category: "full-map",
	solve(grid) {
		const active = new Set(Array.from({ length: grid.size }, (_, i) => i).filter((i) => !grid.blocked?.has(i)));
		const searchOrder = [];
		const deadEndOrder = [];
		let changed = true;

		while (changed) {
			changed = false;
			for (const cell of [...active]) {
				if (cell === grid.start || cell === grid.end) continue;
				const openNeighbours = linkedNeighbours(grid, cell).filter((next) => active.has(next));
				if (openNeighbours.length <= 1) {
					active.delete(cell);
					deadEndOrder.push(cell);
					searchOrder.push(cell);
					changed = true;
				}
			}
		}

		const path = [];
		let current = grid.start;
		const seen = new Set([current]);
		path.push(current);
		while (current !== grid.end) {
			const next = linkedNeighbours(grid, current).find((neighbour) => active.has(neighbour) && !seen.has(neighbour));
			if (next === undefined) break;
			current = next;
			seen.add(current);
			path.push(current);
		}
		return buildSolveResult({
			searchOrder,
			path,
			deadEndOrder,
			// Pruning dead ends and then tracing the surviving corridor are both work.
			steps: deadEndOrder.length + path.length,
		});
	},
};
