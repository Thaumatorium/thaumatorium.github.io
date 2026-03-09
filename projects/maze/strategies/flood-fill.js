import { solveWithFrontier } from "./helpers.js";

export const strategy = {
	id: "flood-fill",
	name: "Flood fill",
	category: "full-map",
	solve(grid) {
		return solveWithFrontier(grid, {
			popFrontier: (frontier) => frontier.shift(),
		});
	},
};
