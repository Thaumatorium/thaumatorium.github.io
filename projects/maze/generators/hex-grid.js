import { createGrid, finalizeGrid, indexOf, link, shuffle } from "./helpers.js";

const hexNeighbours = (grid, index) => {
	const x = index % grid.width;
	const y = Math.floor(index / grid.width);
	const evenRow = y % 2 === 0;
	const deltas = evenRow
		? [
				[1, 0],
				[-1, 0],
				[0, -1],
				[-1, -1],
				[0, 1],
				[-1, 1],
			]
		: [
				[1, 0],
				[-1, 0],
				[1, -1],
				[0, -1],
				[1, 1],
				[0, 1],
			];

	return deltas
		.map(([dx, dy]) => [x + dx, y + dy])
		.filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < grid.width && ny < grid.height)
		.map(([nx, ny]) => indexOf(grid, nx, ny));
};

export const generator = {
	id: "hex-grid",
	name: "Hex-grid maze generation",
	generate({ width, height }) {
		const grid = createGrid(width, height);
		grid.topology = "hex";
		const visited = new Set();
		const stack = [];
		const start = indexOf(grid, 0, 0);
		visited.add(start);
		stack.push(start);
		while (stack.length > 0) {
			const current = stack[stack.length - 1];
			const next = shuffle(hexNeighbours(grid, current).filter((n) => !visited.has(n)));
			if (next.length === 0) {
				stack.pop();
				continue;
			}
			const picked = next[0];
			visited.add(picked);
			link(grid, current, picked);
			stack.push(picked);
		}
		return finalizeGrid(grid);
	},
};
