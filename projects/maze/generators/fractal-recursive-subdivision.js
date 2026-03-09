import { createGrid, finalizeGrid, fullyLinkGrid, unlink } from "./helpers.js";

const divide = (grid, x, y, width, height, depth = 0) => {
	if (width < 2 || height < 2) {
		return;
	}

	const horizontal = width < height || (width === height && depth % 2 === 0);
	if (horizontal) {
		const split = y + Math.floor(height / 2);
		const gapCount = Math.min(3, Math.max(1, Math.floor(width / 3)));
		const gaps = new Set(Array.from({ length: gapCount }, () => x + Math.floor(Math.random() * width)));
		for (let wallX = x; wallX < x + width; wallX++) {
			if (gaps.has(wallX)) continue;
			const top = split * grid.width + wallX;
			const bottom = (split - 1) * grid.width + wallX;
			unlink(grid, top, bottom);
		}
		divide(grid, x, y, width, split - y, depth + 1);
		divide(grid, x, split, width, y + height - split, depth + 1);
		return;
	}

	const split = x + Math.floor(width / 2);
	const gapCount = Math.min(3, Math.max(1, Math.floor(height / 3)));
	const gaps = new Set(Array.from({ length: gapCount }, () => y + Math.floor(Math.random() * height)));
	for (let wallY = y; wallY < y + height; wallY++) {
		if (gaps.has(wallY)) continue;
		const left = wallY * grid.width + (split - 1);
		const right = wallY * grid.width + split;
		unlink(grid, left, right);
	}
	divide(grid, x, y, split - x, height, depth + 1);
	divide(grid, split, y, x + width - split, height, depth + 1);
};

export const generator = {
	id: "fractal-recursive-subdivision",
	name: "Fractal / recursive subdivision variants",
	generate({ width, height }) {
		const grid = fullyLinkGrid(createGrid(width, height));
		divide(grid, 0, 0, width, height);
		return finalizeGrid(grid);
	},
};
