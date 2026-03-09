import { carveCorridor, choice, createGrid, finalizeGrid, indexOf, link, orthogonalNeighbours, shuffle } from "./helpers.js";

const manhattan = (a, b, width) => {
	const ax = a % width;
	const ay = Math.floor(a / width);
	const bx = b % width;
	const by = Math.floor(b / width);
	return Math.abs(ax - bx) + Math.abs(ay - by);
};

export const generator = {
	id: "voronoi-based",
	name: "Voronoi-based maze generation",
	generate({ width, height }) {
		const grid = createGrid(width, height);
		const seedCount = Math.max(4, Math.round(Math.sqrt(width * height) / 2));
		const seeds = [];
		while (seeds.length < seedCount) {
			const candidate = indexOf(grid, Math.floor(Math.random() * width), Math.floor(Math.random() * height));
			if (!seeds.includes(candidate)) {
				seeds.push(candidate);
			}
		}

		const regions = Array.from({ length: grid.size }, (_, cell) => seeds.reduce((best, seed) => (manhattan(cell, seed, width) < manhattan(cell, best, width) ? seed : best), seeds[0]));

		const spanning = new Set([seeds[0]]);
		while (spanning.size < seeds.length) {
			let best = null;
			for (const from of spanning) {
				for (const to of seeds) {
					if (spanning.has(to)) continue;
					const weight = manhattan(from, to, width);
					if (!best || weight < best.weight) {
						best = { from, to, weight };
					}
				}
			}
			carveCorridor(grid, best.from, best.to);
			spanning.add(best.to);
		}

		const byRegion = new Map();
		for (let cell = 0; cell < grid.size; cell++) {
			const region = regions[cell];
			const bucket = byRegion.get(region) ?? [];
			bucket.push(cell);
			byRegion.set(region, bucket);
		}

		for (const cells of byRegion.values()) {
			const visited = new Set([cells[0]]);
			const active = [cells[0]];
			while (active.length > 0) {
				const current = active[active.length - 1];
				const candidates = shuffle(orthogonalNeighbours(grid, current).filter((next) => regions[next] === regions[current] && !visited.has(next)));
				if (candidates.length === 0) {
					active.pop();
					continue;
				}
				const next = candidates[0];
				visited.add(next);
				link(grid, current, next);
				active.push(next);
			}
		}

		return finalizeGrid(grid);
	},
};
