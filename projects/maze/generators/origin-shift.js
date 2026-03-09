import { buildTreeFromParent, finalizeGrid, indexOf, orthogonalNeighbours, randomInt } from "./helpers.js";

const rerootAt = (parent, newRoot) => {
	let current = newRoot;
	let previous = -1;
	while (current !== -1) {
		const next = parent[current];
		parent[current] = previous;
		previous = current;
		current = next;
	}
};

export const generator = {
	id: "origin-shift",
	name: "Origin Shift",
	generate({ width, height, generationCoverage = 95 }) {
		const size = width * height;
		const parent = Array.from({ length: size }, (_, index) => {
			const x = index % width;
			const y = Math.floor(index / width);
			if (x === 0 && y === 0) return -1;
			if (x > 0) return index - 1;
			return index - width;
		});
		const crawlers = [indexOf({ width }, 0, 0), indexOf({ width }, width - 1, 0), indexOf({ width }, 0, height - 1), indexOf({ width }, width - 1, height - 1)];
		const visited = new Set(crawlers);
		const target = Math.max(1, Math.ceil((size * generationCoverage) / 100));

		while (visited.size < target) {
			const crawlerIndex = randomInt(crawlers.length);
			const root = crawlers[crawlerIndex];
			rerootAt(parent, root);
			const neighbours = orthogonalNeighbours({ width, height, blocked: new Set() }, root, true);
			const next = neighbours[randomInt(neighbours.length)];
			parent[root] = next;
			parent[next] = -1;
			crawlers[crawlerIndex] = next;
			visited.add(next);
		}

		return finalizeGrid(buildTreeFromParent(width, height, parent));
	},
};
