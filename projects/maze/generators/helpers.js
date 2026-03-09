export const randomInt = (max) => Math.floor(Math.random() * max);

export const shuffle = (items) => {
	const result = [...items];
	for (let i = result.length - 1; i > 0; i--) {
		const j = randomInt(i + 1);
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
};

export const choice = (items) => items[randomInt(items.length)];

export const indexOf = (grid, x, y) => y * grid.width + x;
export const coordsOf = (grid, index) => ({
	x: index % grid.width,
	y: Math.floor(index / grid.width),
});

export const createGrid = (width, height, blocked = new Set()) => ({
	topology: "square",
	width,
	height,
	size: width * height,
	blocked,
	links: Array.from({ length: width * height }, () => new Set()),
	start: 0,
	end: width * height - 1,
});

export const isOpen = (grid, index) => !grid.blocked.has(index);

export const orthogonalNeighbours = (grid, index, includeBlocked = false) => {
	const { x, y } = coordsOf(grid, index);
	const neighbours = [];
	if (y > 0) neighbours.push(indexOf(grid, x, y - 1));
	if (x < grid.width - 1) neighbours.push(indexOf(grid, x + 1, y));
	if (y < grid.height - 1) neighbours.push(indexOf(grid, x, y + 1));
	if (x > 0) neighbours.push(indexOf(grid, x - 1, y));
	return includeBlocked ? neighbours : neighbours.filter((next) => isOpen(grid, next));
};

export const cardinalNeighbourMap = (grid, index) => {
	const { x, y } = coordsOf(grid, index);
	return {
		north: y > 0 ? indexOf(grid, x, y - 1) : -1,
		east: x < grid.width - 1 ? indexOf(grid, x + 1, y) : -1,
		south: y < grid.height - 1 ? indexOf(grid, x, y + 1) : -1,
		west: x > 0 ? indexOf(grid, x - 1, y) : -1,
	};
};

export const link = (grid, a, b) => {
	if (a < 0 || b < 0 || !isOpen(grid, a) || !isOpen(grid, b)) {
		return;
	}
	grid.links[a].add(b);
	grid.links[b].add(a);
};

export const unlink = (grid, a, b) => {
	grid.links[a]?.delete(b);
	grid.links[b]?.delete(a);
};

export const isLinked = (grid, a, b) => grid.links[a]?.has(b) ?? false;
export const degree = (grid, index) => grid.links[index].size;

export const openCells = (grid) => {
	const cells = [];
	for (let i = 0; i < grid.size; i++) {
		if (isOpen(grid, i)) {
			cells.push(i);
		}
	}
	return cells;
};

export const allEdges = (grid) => {
	const edges = [];
	for (const cell of openCells(grid)) {
		for (const neighbour of orthogonalNeighbours(grid, cell)) {
			if (neighbour > cell) {
				edges.push([cell, neighbour]);
			}
		}
	}
	return edges;
};

export const fullyLinkGrid = (grid) => {
	for (const [a, b] of allEdges(grid)) {
		link(grid, a, b);
	}
	return grid;
};

export const buildTreeFromParent = (width, height, parent, blocked = new Set()) => {
	const grid = createGrid(width, height, blocked);
	for (let i = 0; i < parent.length; i++) {
		if (parent[i] >= 0 && !blocked.has(i) && !blocked.has(parent[i])) {
			link(grid, i, parent[i]);
		}
	}
	return grid;
};

export class DisjointSet {
	constructor(size) {
		this.parent = Array.from({ length: size }, (_, index) => index);
		this.rank = Array.from({ length: size }, () => 0);
	}

	find(value) {
		if (this.parent[value] !== value) {
			this.parent[value] = this.find(this.parent[value]);
		}
		return this.parent[value];
	}

	union(a, b) {
		const rootA = this.find(a);
		const rootB = this.find(b);
		if (rootA === rootB) {
			return false;
		}
		if (this.rank[rootA] < this.rank[rootB]) {
			this.parent[rootA] = rootB;
		} else if (this.rank[rootA] > this.rank[rootB]) {
			this.parent[rootB] = rootA;
		} else {
			this.parent[rootB] = rootA;
			this.rank[rootA] += 1;
		}
		return true;
	}
}

export const deadEnds = (grid) => openCells(grid).filter((cell) => degree(grid, cell) === 1);

export const braid = (grid, probability = 1) => {
	for (const cell of deadEnds(grid)) {
		if (Math.random() > probability) {
			continue;
		}
		const candidates = orthogonalNeighbours(grid, cell)
			.filter((next) => !isLinked(grid, cell, next))
			.sort((a, b) => degree(grid, a) - degree(grid, b));
		if (candidates.length > 0) {
			link(grid, cell, candidates[0]);
		}
	}
	return grid;
};

const bfsDistances = (grid, start) => {
	const queue = [start];
	const distance = new Map([[start, 0]]);
	while (queue.length > 0) {
		const current = queue.shift();
		for (const neighbour of grid.links[current]) {
			if (!distance.has(neighbour)) {
				distance.set(neighbour, distance.get(current) + 1);
				queue.push(neighbour);
			}
		}
	}
	return distance;
};

export const connectedComponents = (grid) => {
	const remaining = new Set(openCells(grid));
	const components = [];
	while (remaining.size > 0) {
		const [start] = remaining;
		const queue = [start];
		const component = [];
		remaining.delete(start);
		while (queue.length > 0) {
			const current = queue.shift();
			component.push(current);
			for (const neighbour of grid.links[current]) {
				if (remaining.has(neighbour)) {
					remaining.delete(neighbour);
					queue.push(neighbour);
				}
			}
		}
		components.push(component);
	}
	return components;
};

export const finalizeGrid = (grid) => {
	const components = connectedComponents(grid);
	if (components.length === 0) {
		return grid;
	}
	const main = components.sort((a, b) => b.length - a.length)[0];
	const start = main[0];
	const farFromStart = [...bfsDistances(grid, start).entries()].sort((a, b) => b[1] - a[1])[0][0];
	const farFromFar = [...bfsDistances(grid, farFromStart).entries()].sort((a, b) => b[1] - a[1])[0][0];
	grid.start = farFromStart;
	grid.end = farFromFar;
	return grid;
};

export const recursiveBacktrackerGrid = (width, height) => {
	const grid = createGrid(width, height);
	const start = 0;
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
};

export const bfsTreeGrid = (width, height) => {
	const grid = createGrid(width, height);
	const start = 0;
	const visited = new Set([start]);
	const queue = [start];
	while (queue.length > 0) {
		const current = queue.shift();
		for (const next of shuffle(orthogonalNeighbours(grid, current))) {
			if (visited.has(next)) {
				continue;
			}
			visited.add(next);
			link(grid, current, next);
			queue.push(next);
		}
	}
	return finalizeGrid(grid);
};

export const carveCorridor = (grid, from, to) => {
	let current = from;
	while (current !== to) {
		const { x, y } = coordsOf(grid, current);
		const target = coordsOf(grid, to);
		const nextX = x === target.x ? x : x + Math.sign(target.x - x);
		const nextY = y === target.y ? y : y + Math.sign(target.y - y);
		const next = nextX !== x ? indexOf(grid, nextX, y) : indexOf(grid, x, nextY);
		link(grid, current, next);
		current = next;
	}
};

export const createMaskedGridFromPredicate = (width, height, predicate) => {
	const blocked = new Set();
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const index = y * width + x;
			if (!predicate(x, y, index)) {
				blocked.add(index);
			}
		}
	}
	return createGrid(width, height, blocked);
};
