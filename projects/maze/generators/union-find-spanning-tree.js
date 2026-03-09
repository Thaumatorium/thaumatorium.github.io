import { allEdges, createGrid, DisjointSet, finalizeGrid, link } from "./helpers.js";

export const generator = {
	id: "union-find-spanning-tree",
	name: "Union-Find spanning tree generation",
	generate({ width, height }) {
		const grid = createGrid(width, height);
		const dsu = new DisjointSet(grid.size);
		const edges = allEdges(grid);
		let added = 0;
		while (added < grid.size - 1 && edges.length > 0) {
			const edge = edges.splice(Math.floor(Math.random() * edges.length), 1)[0];
			if (dsu.union(edge[0], edge[1])) {
				link(grid, edge[0], edge[1]);
				added += 1;
			}
		}
		return finalizeGrid(grid);
	},
};
