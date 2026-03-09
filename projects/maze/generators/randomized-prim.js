import { choice, createGrid, finalizeGrid, link, orthogonalNeighbours } from "./helpers.js";

export const generator = {
	id: "randomized-prim",
	name: "Randomized Prim",
	generate({ width, height }) {
		const grid = createGrid(width, height);
		const visited = new Set([0]);
		const frontier = orthogonalNeighbours(grid, 0).map((next) => [0, next]);
		while (frontier.length > 0) {
			const edge = frontier.splice(Math.floor(Math.random() * frontier.length), 1)[0];
			const [from, to] = edge;
			if (visited.has(to)) continue;
			visited.add(to);
			link(grid, from, to);
			for (const next of orthogonalNeighbours(grid, to)) {
				if (!visited.has(next)) {
					frontier.push([to, next]);
				}
			}
		}
		return finalizeGrid(grid);
	},
};
