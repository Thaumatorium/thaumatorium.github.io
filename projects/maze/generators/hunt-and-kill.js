import { choice, createGrid, finalizeGrid, link, openCells, orthogonalNeighbours } from "./helpers.js";

export const generator = {
	id: "hunt-and-kill",
	name: "Hunt-and-Kill",
	generate({ width, height }) {
		const grid = createGrid(width, height);
		const visited = new Set();
		let current = 0;
		visited.add(current);

		while (current !== undefined) {
			const unvisitedNeighbours = orthogonalNeighbours(grid, current).filter((next) => !visited.has(next));
			if (unvisitedNeighbours.length > 0) {
				const next = choice(unvisitedNeighbours);
				link(grid, current, next);
				visited.add(next);
				current = next;
				continue;
			}

			current = undefined;
			for (const cell of openCells(grid)) {
				if (visited.has(cell)) continue;
				const visitedNeighbours = orthogonalNeighbours(grid, cell).filter((next) => visited.has(next));
				if (visitedNeighbours.length > 0) {
					current = cell;
					visited.add(cell);
					link(grid, cell, choice(visitedNeighbours));
					break;
				}
			}
		}

		return finalizeGrid(grid);
	},
};
