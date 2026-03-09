import { createGrid, finalizeGrid, link, orthogonalNeighbours, shuffle } from "./helpers.js";

export const generator = {
	id: "dfs",
	name: "DFS maze generation",
	generate({ width, height }) {
		const grid = createGrid(width, height);
		const visited = new Set([0]);
		const stack = [0];
		while (stack.length > 0) {
			const current = stack.pop();
			for (const next of shuffle(orthogonalNeighbours(grid, current))) {
				if (visited.has(next)) continue;
				visited.add(next);
				link(grid, current, next);
				stack.push(current);
				stack.push(next);
				break;
			}
		}
		return finalizeGrid(grid);
	},
};
