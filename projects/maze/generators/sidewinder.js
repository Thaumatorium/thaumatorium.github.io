import { createGrid, finalizeGrid, indexOf, link, choice } from "./helpers.js";

export const generator = {
	id: "sidewinder",
	name: "Sidewinder",
	generate({ width, height }) {
		const grid = createGrid(width, height);
		for (let y = 0; y < height; y++) {
			let run = [];
			for (let x = 0; x < width; x++) {
				const cell = indexOf(grid, x, y);
				run.push(cell);
				const atEasternBoundary = x === width - 1;
				const atNorthernBoundary = y === 0;
				const closeRun = atEasternBoundary || (!atNorthernBoundary && Math.random() < 0.5);
				if (closeRun) {
					if (!atNorthernBoundary) {
						const member = choice(run);
						link(grid, member, member - width);
					}
					run = [];
				} else {
					link(grid, cell, indexOf(grid, x + 1, y));
				}
			}
		}
		return finalizeGrid(grid);
	},
};
