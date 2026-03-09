import { choice, createGrid, finalizeGrid, link, orthogonalNeighbours } from "./helpers.js";

export const generator = {
	id: "growing-tree",
	name: "Growing Tree",
	generate({ width, height }) {
		const grid = createGrid(width, height);
		const active = [0];
		const visited = new Set([0]);
		while (active.length > 0) {
			const current = Math.random() < 0.5 ? active[active.length - 1] : choice(active);
			const candidates = orthogonalNeighbours(grid, current).filter((next) => !visited.has(next));
			if (candidates.length === 0) {
				active.splice(active.indexOf(current), 1);
				continue;
			}
			const next = choice(candidates);
			visited.add(next);
			link(grid, current, next);
			active.push(next);
		}
		return finalizeGrid(grid);
	},
};
