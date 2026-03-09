import { choice, createGrid, finalizeGrid, link, openCells, orthogonalNeighbours } from "./helpers.js";

export const generator = {
	id: "aldous-broder",
	name: "Aldous-Broder",
	generate({ width, height }) {
		const grid = createGrid(width, height);
		const cells = openCells(grid);
		let current = choice(cells);
		const visited = new Set([current]);
		while (visited.size < cells.length) {
			const next = choice(orthogonalNeighbours(grid, current));
			if (!visited.has(next)) {
				link(grid, current, next);
				visited.add(next);
			}
			current = next;
		}
		return finalizeGrid(grid);
	},
};
