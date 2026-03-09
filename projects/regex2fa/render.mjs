const STATE_RADIUS = 22;
const ARROW_SIZE = 8;
const LAYER_GAP = 110;
const ROW_GAP = 72;

function resizeCanvas(canvas) {
	const rect = canvas.getBoundingClientRect();
	const width = Math.max(760, Math.round(rect.width));
	const height = Math.max(544, Math.round(rect.height));
	if (canvas.width !== width) canvas.width = width;
	if (canvas.height !== height) canvas.height = height;
}

function buildLevels(automaton) {
	const levels = new Map();
	if (automaton.startStateId === null) return levels;
	const queue = [automaton.startStateId];
	levels.set(automaton.startStateId, 0);
	while (queue.length) {
		const current = queue.shift();
		const state = automaton.states.get(current);
		const currentLevel = levels.get(current);
		state?.transitions.forEach((targets) => {
			targets.forEach((target) => {
				if (levels.has(target)) return;
				levels.set(target, currentLevel + 1);
				queue.push(target);
			});
		});
	}
	[...automaton.states.keys()].forEach((stateId) => {
		if (!levels.has(stateId)) levels.set(stateId, 0);
	});
	return levels;
}

function layoutStates(automaton, canvas) {
	const levels = buildLevels(automaton);
	const buckets = new Map();
	[...automaton.states.keys()]
		.sort((a, b) => a - b)
		.forEach((stateId) => {
			const level = levels.get(stateId) ?? 0;
			if (!buckets.has(level)) buckets.set(level, []);
			buckets.get(level).push(stateId);
		});
	const maxLevel = Math.max(...buckets.keys(), 0);
	const usableWidth = canvas.width - 120;
	const usableHeight = canvas.height - 100;
	const xStep = maxLevel > 0 ? usableWidth / maxLevel : 0;
	const coords = new Map();
	[...buckets.entries()].forEach(([level, ids]) => {
		const totalHeight = (ids.length - 1) * ROW_GAP;
		ids.forEach((stateId, index) => {
			const x = 60 + level * Math.max(xStep, LAYER_GAP);
			const y = canvas.height / 2 - totalHeight / 2 + index * ROW_GAP;
			coords.set(stateId, { x, y });
		});
	});
	return coords;
}

function drawArrowhead(ctx, x, y, angle) {
	ctx.beginPath();
	ctx.moveTo(x, y);
	ctx.lineTo(x - ARROW_SIZE * Math.cos(angle - Math.PI / 6), y - ARROW_SIZE * Math.sin(angle - Math.PI / 6));
	ctx.lineTo(x - ARROW_SIZE * Math.cos(angle + Math.PI / 6), y - ARROW_SIZE * Math.sin(angle + Math.PI / 6));
	ctx.closePath();
	ctx.fill();
}

function drawState(ctx, x, y, label, isAccepting, isStart) {
	ctx.beginPath();
	ctx.arc(x, y, STATE_RADIUS, 0, 2 * Math.PI);
	ctx.fillStyle = isAccepting ? "#dcf5d7" : "#d9ecff";
	ctx.fill();
	ctx.strokeStyle = "#222";
	ctx.lineWidth = 1.5;
	ctx.stroke();

	if (isAccepting) {
		ctx.beginPath();
		ctx.arc(x, y, STATE_RADIUS - 5, 0, 2 * Math.PI);
		ctx.stroke();
	}

	ctx.fillStyle = "#111";
	ctx.font = "12px Tahoma, sans-serif";
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText(label, x, y);

	if (isStart) {
		const arrowX = x - STATE_RADIUS - 10;
		ctx.beginPath();
		ctx.moveTo(arrowX - 28, y);
		ctx.lineTo(arrowX, y);
		ctx.stroke();
		drawArrowhead(ctx, arrowX, y, 0);
	}
}

function drawTransition(ctx, p1, p2, label, isSelfLoop, bendDirection = 1) {
	ctx.strokeStyle = "#333";
	ctx.fillStyle = "#111";
	ctx.lineWidth = 1.1;
	ctx.font = "11px Tahoma, sans-serif";

	if (isSelfLoop) {
		const loopRadius = STATE_RADIUS * 0.92;
		const centerX = p1.x;
		const centerY = p1.y - STATE_RADIUS - loopRadius - 6;
		const startAngle = Math.PI * 0.15;
		const endAngle = Math.PI * 1.85;
		ctx.beginPath();
		ctx.arc(centerX, centerY, loopRadius, startAngle, endAngle);
		ctx.stroke();
		const arrowAngle = Math.PI * 0.28;
		drawArrowhead(ctx, centerX + loopRadius * Math.cos(arrowAngle), centerY + loopRadius * Math.sin(arrowAngle), arrowAngle + Math.PI / 2);
		ctx.textAlign = "center";
		ctx.textBaseline = "bottom";
		ctx.fillText(label, centerX, centerY - loopRadius - 6);
		return;
	}

	const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
	const startX = p1.x + Math.cos(angle) * STATE_RADIUS;
	const startY = p1.y + Math.sin(angle) * STATE_RADIUS;
	const endX = p2.x - Math.cos(angle) * STATE_RADIUS;
	const endY = p2.y - Math.sin(angle) * STATE_RADIUS;
	const distance = Math.hypot(endX - startX, endY - startY);
	const curve = Math.min(36, distance * 0.16) * bendDirection;
	const normalX = -Math.sin(angle);
	const normalY = Math.cos(angle);
	const controlX = (startX + endX) / 2 + normalX * curve;
	const controlY = (startY + endY) / 2 + normalY * curve;

	ctx.beginPath();
	ctx.moveTo(startX, startY);
	ctx.quadraticCurveTo(controlX, controlY, endX, endY);
	ctx.stroke();

	const t = 0.92;
	const arrowX = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * controlX + t * t * endX;
	const arrowY = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * controlY + t * t * endY;
	const tangentX = 2 * (1 - t) * (controlX - startX) + 2 * t * (endX - controlX);
	const tangentY = 2 * (1 - t) * (controlY - startY) + 2 * t * (endY - controlY);
	drawArrowhead(ctx, arrowX, arrowY, Math.atan2(tangentY, tangentX));

	ctx.textAlign = "center";
	ctx.textBaseline = "bottom";
	ctx.fillText(label, controlX, controlY - 4);
}

export function createRenderer(canvas) {
	const ctx = canvas.getContext("2d");
	let lastAutomaton = null;

	function draw(automaton) {
		lastAutomaton = automaton;
		resizeCanvas(canvas);
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		if (!automaton || automaton.states.size === 0) {
			return;
		}

		const coords = layoutStates(automaton, canvas);
		automaton.states.forEach((state, fromId) => {
			const from = coords.get(fromId);
			const grouped = new Map();
			state.transitions.forEach((targets, symbol) => {
				targets.forEach((targetId) => {
					if (!grouped.has(targetId)) grouped.set(targetId, []);
					grouped.get(targetId).push(symbol);
				});
			});
			grouped.forEach((symbols, targetId) => {
				const to = coords.get(targetId);
				const reverse = automaton.states.get(targetId)?.transitions;
				let bend = 1;
				if (targetId !== fromId) {
					const hasReverse = [...(reverse?.values() ?? [])].some((targetSet) => targetSet.has(fromId));
					if (hasReverse && fromId > targetId) bend = -1;
				}
				drawTransition(ctx, from, to, symbols.join(", "), fromId === targetId, bend);
			});
		});

		[...automaton.states.keys()]
			.sort((a, b) => a - b)
			.forEach((stateId) => {
				const state = automaton.states.get(stateId);
				const point = coords.get(stateId);
				drawState(ctx, point.x, point.y, String(stateId), state.isAccepting, stateId === automaton.startStateId);
			});
	}

	function redraw() {
		if (lastAutomaton) draw(lastAutomaton);
	}

	return { draw, redraw };
}
