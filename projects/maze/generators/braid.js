import { braid, recursiveBacktrackerGrid } from "./helpers.js";

export const generator = {
	id: "braid",
	name: "Braid maze generation",
	generate({ width, height }) {
		return braid(recursiveBacktrackerGrid(width, height), 1);
	},
};
