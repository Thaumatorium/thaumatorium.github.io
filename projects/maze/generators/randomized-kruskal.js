import { allEdges, createGrid, DisjointSet, finalizeGrid, link, shuffle } from "./helpers.js";

export const generator = {
	id: "randomized-kruskal",
	name: "Randomized Kruskal",
	generate({ width, height }) {
		const grid = createGrid(width, height);
		const dsu = new DisjointSet(grid.size);
		for (const [a, b] of shuffle(allEdges(grid))) {
			if (dsu.union(a, b)) {
				link(grid, a, b);
			}
		}
		return finalizeGrid(grid);
	},
};
