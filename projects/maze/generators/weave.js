import { cardinalNeighbourMap, createGrid, finalizeGrid, isLinked, link, recursiveBacktrackerGrid } from "./helpers.js";

export const generator = {
	id: "weave",
	name: "Weave maze generation",
	generate({ width, height }) {
		const grid = recursiveBacktrackerGrid(width, height);
		for (let y = 1; y < height - 1; y++) {
			for (let x = 1; x < width - 1; x++) {
				if (Math.random() > 0.12) {
					continue;
				}
				const cell = y * width + x;
				const { north, east, south, west } = cardinalNeighbourMap(grid, cell);
				if ([north, east, south, west].some((next) => next < 0)) {
					continue;
				}
				const verticalClosed = !isLinked(grid, cell, north) && !isLinked(grid, cell, south);
				const horizontalClosed = !isLinked(grid, cell, east) && !isLinked(grid, cell, west);
				if (verticalClosed) {
					link(grid, cell, north);
					link(grid, cell, south);
				}
				if (horizontalClosed) {
					link(grid, cell, east);
					link(grid, cell, west);
				}
			}
		}
		return finalizeGrid(grid);
	},
};
