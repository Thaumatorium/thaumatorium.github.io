import { createGrid, finalizeGrid, link, orthogonalNeighbours, shuffle } from "./helpers.js";

const countWalls = (cells, width, height, x, y) => {
	let count = 0;
	for (let dy = -1; dy <= 1; dy++) {
		for (let dx = -1; dx <= 1; dx++) {
			if (dx === 0 && dy === 0) continue;
			const nx = x + dx;
			const ny = y + dy;
			if (nx < 0 || ny < 0 || nx >= width || ny >= height || cells[ny * width + nx]) {
				count += 1;
			}
		}
	}
	return count;
};

const floodFillOpenRegions = (cells, width, height) => {
	const seen = new Set();
	const regions = [];

	for (let index = 0; index < cells.length; index++) {
		if (cells[index] || seen.has(index)) {
			continue;
		}

		const region = [];
		const queue = [index];
		seen.add(index);

		while (queue.length > 0) {
			const current = queue.shift();
			region.push(current);

			const x = current % width;
			const y = Math.floor(current / width);
			const neighbours = [];
			if (y > 0) neighbours.push(current - width);
			if (x < width - 1) neighbours.push(current + 1);
			if (y < height - 1) neighbours.push(current + width);
			if (x > 0) neighbours.push(current - 1);

			for (const next of neighbours) {
				if (!cells[next] && !seen.has(next)) {
					seen.add(next);
					queue.push(next);
				}
			}
		}

		regions.push(region);
	}

	return regions.sort((a, b) => b.length - a.length);
};

export const generator = {
	id: "cellular-automata",
	name: "Cellular automata",
	generate({ width, height }) {
		let cells = Array.from({ length: width * height }, () => Math.random() < 0.43);

		for (let i = 0; i < 5; i++) {
			cells = cells.map((_, index) => {
				const x = index % width;
				const y = Math.floor(index / width);
				return countWalls(cells, width, height, x, y) >= 5;
			});
		}

		const regions = floodFillOpenRegions(cells, width, height);
		const mainRegion = new Set(regions[0] ?? [0]);

		// Keep only the largest cave region open; everything else becomes blocked.
		cells = cells.map((filled, index) => filled || !mainRegion.has(index));
		const blocked = new Set(cells.map((filled, index) => (filled ? index : -1)).filter((index) => index >= 0));
		const grid = createGrid(width, height, blocked);

		const start = regions[0]?.[0] ?? 0;
		const visited = new Set([start]);
		const stack = [start];

		while (stack.length > 0) {
			const current = stack[stack.length - 1];
			const nextOptions = shuffle(orthogonalNeighbours(grid, current).filter((next) => !visited.has(next)));

			if (nextOptions.length === 0) {
				stack.pop();
				continue;
			}

			const next = nextOptions[0];
			visited.add(next);
			link(grid, current, next);
			stack.push(next);
		}

		return finalizeGrid(grid);
	},
};
