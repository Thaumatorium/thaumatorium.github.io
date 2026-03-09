import { solveWithFrontier } from "./helpers.js";

export const strategy = {
	id: "lee-algorithm",
	name: "Lee algorithm",
	category: "full-map",
	solve(grid) {
		return solveWithFrontier(grid, {
			popFrontier: (frontier) => frontier.shift(),
		});
	},
};
