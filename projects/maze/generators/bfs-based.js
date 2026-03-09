import { choice, createGrid, finalizeGrid, link, openCells, orthogonalNeighbours, shuffle } from "./helpers.js";

export const generator = {
	id: "bfs-based",
	name: "BFS-based maze generation",
	generate({ width, height }) {
		const grid = createGrid(width, height);
		const start = choice(openCells(grid));
		const visited = new Set([start]);
		let frontier = [start];

		while (frontier.length > 0) {
			const nextFrontier = [];

			for (const current of shuffle(frontier)) {
				for (const next of shuffle(orthogonalNeighbours(grid, current))) {
					if (visited.has(next)) {
						continue;
					}

					visited.add(next);

					// Pick a random already-visited neighbor to keep the BFS layering
					// while avoiding a too-regular "wavefront" tree.
					const candidateParents = shuffle(orthogonalNeighbours(grid, next).filter((cell) => visited.has(cell)));
					link(grid, next, candidateParents[0]);
					nextFrontier.push(next);
				}
			}

			frontier = shuffle(nextFrontier);
		}

		return finalizeGrid(grid);
	},
};
