import { choice, createGrid, finalizeGrid, indexOf, link, shuffle } from "./helpers.js";

export const generator = {
	id: "eller",
	name: "Eller",
	generate({ width, height }) {
		const grid = createGrid(width, height);
		let nextSetId = 1;
		let rowSets = Array.from({ length: width }, () => nextSetId++);

		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width - 1; x++) {
				const shouldJoin = y === height - 1 || Math.random() < 0.5;
				if (shouldJoin && rowSets[x] !== rowSets[x + 1]) {
					const left = indexOf(grid, x, y);
					const right = indexOf(grid, x + 1, y);
					link(grid, left, right);
					const from = rowSets[x + 1];
					const to = rowSets[x];
					rowSets = rowSets.map((setId) => (setId === from ? to : setId));
				}
			}

			if (y === height - 1) {
				break;
			}

			const nextRowSets = Array.from({ length: width }, () => 0);
			const groups = new Map();
			for (let x = 0; x < width; x++) {
				const setId = rowSets[x];
				const group = groups.get(setId) ?? [];
				group.push(x);
				groups.set(setId, group);
			}

			for (const [setId, group] of groups.entries()) {
				const downward = shuffle(group).filter(() => Math.random() < 0.5);
				const ensured = downward.length > 0 ? downward : [choice(group)];
				for (const x of ensured) {
					link(grid, indexOf(grid, x, y), indexOf(grid, x, y + 1));
					nextRowSets[x] = setId;
				}
			}

			for (let x = 0; x < width; x++) {
				if (nextRowSets[x] === 0) {
					nextRowSets[x] = nextSetId++;
				}
			}
			rowSets = nextRowSets;
		}

		return finalizeGrid(grid);
	},
};
