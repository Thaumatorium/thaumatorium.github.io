import { solveWithFrontier } from "./helpers.js";

export const strategy = {
	id: "bfs",
	name: "Breadth-first search (BFS)",
	category: "full-map",
	solve(grid) {
		return solveWithFrontier(grid, {
			popFrontier: (frontier) => frontier.shift(),
		});
	},
};
