import { recursiveBacktrackerGrid } from "./helpers.js";

export const generator = {
	id: "recursive-backtracker",
	name: "Recursive backtracker",
	generate({ width, height }) {
		return recursiveBacktrackerGrid(width, height);
	},
};
