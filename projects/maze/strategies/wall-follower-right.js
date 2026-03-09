import { buildSolveResult, firstAvailableHeading, getDirectionalMap, turnBack, turnLeft, turnRight } from "./helpers.js";

const solveWallFollower = (grid, handedness) => {
	const path = [grid.start];
	const searchOrder = [grid.start];
	const deadEndOrder = [];
	let current = grid.start;
	let heading = firstAvailableHeading(grid, current);
	const maxSteps = grid.size * 20;

	for (let step = 0; step < maxSteps && current !== grid.end; step++) {
		const map = getDirectionalMap(grid, current);
		const turn = handedness === "left" ? turnLeft : turnRight;
		const oppositeTurn = handedness === "left" ? turnRight : turnLeft;
		const order = [turn(heading), heading, oppositeTurn(heading), turnBack(heading)];
		const nextHeading = order.find((candidate) => map.has(candidate));
		if (!nextHeading) break;
		heading = nextHeading;
		current = map.get(nextHeading);
		path.push(current);
		searchOrder.push(current);
	}

	return buildSolveResult({
		searchOrder,
		path,
		deadEndOrder,
		steps: searchOrder.length,
	});
};

export const strategy = {
	id: "wall-follower-right",
	name: "Wall follower / right-hand rule",
	category: "local",
	solve(grid) {
		return solveWallFollower(grid, "right");
	},
};
