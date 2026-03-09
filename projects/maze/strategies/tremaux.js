import { buildSolveResult, linkedNeighbours } from "./helpers.js";
import { shuffle } from "../generators/helpers.js";

const edgeKey = (a, b) => (a < b ? `${a}:${b}` : `${b}:${a}`);

export const strategy = {
	id: "tremaux",
	name: "Trémaux",
	category: "local",
	solve(grid) {
		const marks = new Map();
		const path = [grid.start];
		const searchOrder = [grid.start];
		const deadEndOrder = [];
		let current = grid.start;
		const maxSteps = grid.size * 30;

		for (let step = 0; step < maxSteps && current !== grid.end; step++) {
			const options = shuffle(linkedNeighbours(grid, current)).sort((a, b) => (marks.get(edgeKey(current, a)) ?? 0) - (marks.get(edgeKey(current, b)) ?? 0));
			const next = options[0];
			if (next === undefined) break;
			const key = edgeKey(current, next);
			marks.set(key, (marks.get(key) ?? 0) + 1);
			if (path.length > 1 && next === path[path.length - 2]) {
				deadEndOrder.push(current);
				path.pop();
			} else {
				path.push(next);
			}
			current = next;
			searchOrder.push(current);
		}

		return buildSolveResult({ searchOrder, path, deadEndOrder, steps: searchOrder.length });
	},
};
