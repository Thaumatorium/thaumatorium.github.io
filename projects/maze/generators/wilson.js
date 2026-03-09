import { choice, createGrid, finalizeGrid, link, openCells, orthogonalNeighbours } from "./helpers.js";

export const generator = {
	id: "wilson",
	name: "Wilson",
	generate({ width, height }) {
		const grid = createGrid(width, height);
		const cells = openCells(grid);
		const unvisited = new Set(cells);
		const seed = choice(cells);
		unvisited.delete(seed);

		while (unvisited.size > 0) {
			let current = choice([...unvisited]);
			let path = [current];
			const positions = new Map([[current, 0]]);

			while (unvisited.has(current)) {
				current = choice(orthogonalNeighbours(grid, current));
				if (positions.has(current)) {
					path = path.slice(0, positions.get(current) + 1);
				} else {
					path.push(current);
				}
				positions.clear();
				path.forEach((cell, index) => positions.set(cell, index));
			}

			for (let i = 0; i < path.length - 1; i++) {
				link(grid, path[i], path[i + 1]);
				unvisited.delete(path[i]);
			}
			unvisited.delete(path[path.length - 1]);
		}

		return finalizeGrid(grid);
	},
};
