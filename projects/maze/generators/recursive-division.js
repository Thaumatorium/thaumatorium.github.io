import { createGrid, finalizeGrid, fullyLinkGrid, unlink } from "./helpers.js";

const divide = (grid, x, y, width, height) => {
	if (width <= 1 || height <= 1) {
		return;
	}
	const horizontal = width < height;
	if (horizontal) {
		const wallY = y + Math.floor(Math.random() * (height - 1));
		const passageX = x + Math.floor(Math.random() * width);
		for (let dx = 0; dx < width; dx++) {
			if (x + dx === passageX) continue;
			unlink(grid, wallY * grid.width + (x + dx), (wallY + 1) * grid.width + (x + dx));
		}
		divide(grid, x, y, width, wallY - y + 1);
		divide(grid, x, wallY + 1, width, y + height - wallY - 1);
		return;
	}
	const wallX = x + Math.floor(Math.random() * (width - 1));
	const passageY = y + Math.floor(Math.random() * height);
	for (let dy = 0; dy < height; dy++) {
		if (y + dy === passageY) continue;
		unlink(grid, (y + dy) * grid.width + wallX, (y + dy) * grid.width + wallX + 1);
	}
	divide(grid, x, y, wallX - x + 1, height);
	divide(grid, wallX + 1, y, x + width - wallX - 1, height);
};

export const generator = {
	id: "recursive-division",
	name: "Recursive Division",
	generate({ width, height }) {
		const grid = fullyLinkGrid(createGrid(width, height));
		divide(grid, 0, 0, width, height);
		return finalizeGrid(grid);
	},
};
