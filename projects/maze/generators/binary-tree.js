import { cardinalNeighbourMap, choice, createGrid, finalizeGrid, link, openCells } from "./helpers.js";

export const generator = {
	id: "binary-tree",
	name: "Binary Tree",
	generate({ width, height }) {
		const grid = createGrid(width, height);
		for (const cell of openCells(grid)) {
			const { north, east } = cardinalNeighbourMap(grid, cell);
			const candidates = [north, east].filter((next) => next >= 0);
			if (candidates.length > 0) {
				link(grid, cell, choice(candidates));
			}
		}
		return finalizeGrid(grid);
	},
};
