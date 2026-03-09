import { buildSolveResult, getDirectionalMap, turnBack, turnLeft, turnRight } from "./helpers.js";

const headingAngle = {
	north: 0,
	east: 1,
	south: 2,
	west: 3,
};

const quarterTurnDelta = (from, to) => {
	const raw = headingAngle[to] - headingAngle[from];
	if (raw === 3) return -1;
	if (raw === -3) return 1;
	return raw;
};

export const strategy = {
	id: "pledge",
	name: "Pledge",
	category: "local",
	solve(grid) {
		const preferred = "east";
		let heading = preferred;
		let turnBalance = 0;
		let current = grid.start;
		const path = [grid.start];
		const searchOrder = [grid.start];
		const deadEndOrder = [];
		const maxSteps = grid.size * 40;

		for (let step = 0; step < maxSteps && current !== grid.end; step++) {
			const map = getDirectionalMap(grid, current);

			// Pledge invariant: once the turn balance is back to zero,
			// resume the preferred heading as soon as possible.
			let nextHeading = null;
			if (turnBalance === 0 && map.has(preferred)) {
				nextHeading = preferred;
			} else {
				const wallFollowOrder = [turnRight(heading), heading, turnLeft(heading), turnBack(heading)];
				nextHeading = wallFollowOrder.find((candidate) => map.has(candidate)) ?? null;
			}

			if (!nextHeading) {
				break;
			}

			turnBalance += quarterTurnDelta(heading, nextHeading);
			heading = nextHeading;
			current = map.get(nextHeading);
			path.push(current);
			searchOrder.push(current);
		}

		return buildSolveResult({ searchOrder, path, deadEndOrder, steps: searchOrder.length });
	},
};
