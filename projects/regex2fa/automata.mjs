import { Automaton, State, createIdFactory } from "./model.mjs";
import { CONCAT_OPERATOR } from "./parser.mjs";

function cloneInto(target, source, offset) {
	source.states.forEach((state, oldId) => {
		const cloned = new State(oldId + offset, state.isAccepting);
		state.transitions.forEach((nextIds, symbol) => {
			nextIds.forEach((nextId) => cloned.addTransition(symbol, nextId + offset));
		});
		target.states.set(cloned.id, cloned);
	});
}

export function buildNfa(postfixTokens, epsilonSymbol) {
	const ids = createIdFactory();
	const epsilon = () => epsilonSymbol;
	const nfaStack = [];
	const makeAutomaton = () => new Automaton(() => ids.next(), epsilon);

	for (const token of postfixTokens) {
		if (token === CONCAT_OPERATOR) {
			if (nfaStack.length < 2) throw new Error("Invalid postfix for concatenation");
			const right = nfaStack.pop();
			const left = nfaStack.pop();
			const offset = ids.peek();
			cloneInto(left, right, offset);
			const rightStart = right.startStateId + offset;
			const rightAccepts = new Set([...right.acceptStateIds].map((id) => id + offset));
			left.acceptStateIds.forEach((acceptId) => {
				left.addTransition(acceptId, rightStart, epsilon());
				left.setAcceptState(acceptId, false);
			});
			left.acceptStateIds = rightAccepts;
			left.alphabet = new Set([...left.alphabet, ...right.alphabet]);
			nfaStack.push(left);
			continue;
		}

		if (token === "|") {
			if (nfaStack.length < 2) throw new Error("Invalid postfix for alternation");
			const right = nfaStack.pop();
			const left = nfaStack.pop();
			const nfa = makeAutomaton();
			const start = nfa.addState();
			nfa.setStartState(start);
			left.states.forEach((state, id) => nfa.states.set(id, state));
			right.states.forEach((state, id) => nfa.states.set(id, state));
			nfa.addTransition(start, left.startStateId, epsilon());
			nfa.addTransition(start, right.startStateId, epsilon());
			const accept = nfa.addState(true);
			left.acceptStateIds.forEach((acceptId) => {
				nfa.setAcceptState(acceptId, false);
				nfa.addTransition(acceptId, accept, epsilon());
			});
			right.acceptStateIds.forEach((acceptId) => {
				nfa.setAcceptState(acceptId, false);
				nfa.addTransition(acceptId, accept, epsilon());
			});
			nfa.alphabet = new Set([...left.alphabet, ...right.alphabet]);
			nfaStack.push(nfa);
			continue;
		}

		if (token === "*") {
			if (nfaStack.length < 1) throw new Error("Invalid postfix for Kleene star");
			const inner = nfaStack.pop();
			const nfa = makeAutomaton();
			const start = nfa.addState();
			const accept = nfa.addState(true);
			nfa.setStartState(start);
			inner.states.forEach((state, id) => nfa.states.set(id, state));
			nfa.addTransition(start, inner.startStateId, epsilon());
			nfa.addTransition(start, accept, epsilon());
			inner.acceptStateIds.forEach((acceptId) => {
				nfa.setAcceptState(acceptId, false);
				nfa.addTransition(acceptId, inner.startStateId, epsilon());
				nfa.addTransition(acceptId, accept, epsilon());
			});
			nfa.alphabet = new Set(inner.alphabet);
			nfaStack.push(nfa);
			continue;
		}

		if (token === "+") {
			if (nfaStack.length < 1) throw new Error("Invalid postfix for Kleene plus");
			const inner = nfaStack.pop();
			const nfa = makeAutomaton();
			inner.states.forEach((state, id) => nfa.states.set(id, state));
			nfa.setStartState(inner.startStateId);
			const accept = nfa.addState(true);
			inner.acceptStateIds.forEach((acceptId) => {
				nfa.setAcceptState(acceptId, false);
				nfa.addTransition(acceptId, inner.startStateId, epsilon());
				nfa.addTransition(acceptId, accept, epsilon());
			});
			nfa.alphabet = new Set(inner.alphabet);
			nfaStack.push(nfa);
			continue;
		}

		if (token === "?") {
			if (nfaStack.length < 1) throw new Error("Invalid postfix for optional");
			const inner = nfaStack.pop();
			const nfa = makeAutomaton();
			const start = nfa.addState();
			const accept = nfa.addState(true);
			nfa.setStartState(start);
			inner.states.forEach((state, id) => nfa.states.set(id, state));
			nfa.addTransition(start, inner.startStateId, epsilon());
			nfa.addTransition(start, accept, epsilon());
			inner.acceptStateIds.forEach((acceptId) => {
				nfa.setAcceptState(acceptId, false);
				nfa.addTransition(acceptId, accept, epsilon());
			});
			nfa.alphabet = new Set(inner.alphabet);
			nfaStack.push(nfa);
			continue;
		}

		const nfa = makeAutomaton();
		const start = nfa.addState();
		const accept = nfa.addState(true);
		nfa.setStartState(start);
		if (token.startsWith("[") && token.endsWith("]")) {
			const content = token.slice(1, -1);
			if (!content) throw new Error("Empty character class not allowed.");
			for (let index = 0; index < content.length; index++) {
				let symbol = content[index];
				if (symbol === "\\" && index + 1 < content.length) {
					symbol = content[index + 1];
					index++;
				}
				nfa.addTransition(start, accept, symbol);
			}
		} else if (token.length === 2 && token[0] === "\\") {
			nfa.addTransition(start, accept, token[1]);
		} else {
			nfa.addTransition(start, accept, token);
		}
		nfaStack.push(nfa);
	}

	if (nfaStack.length !== 1) {
		throw new Error(`Invalid postfix expression. Stack size: ${nfaStack.length}`);
	}
	return nfaStack[0];
}

export function buildDfa(nfa, epsilonSymbol) {
	const ids = createIdFactory();
	const epsilon = () => epsilonSymbol;
	const dfa = new Automaton(() => ids.next(), epsilon);
	const alphabet = [...nfa.alphabet];

	const epsilonClosure = (nfaStateIds) => {
		const closure = new Set(nfaStateIds);
		const stack = [...nfaStateIds];
		while (stack.length) {
			const stateId = stack.pop();
			const state = nfa.states.get(stateId);
			const epsilonTargets = state?.transitions.get(epsilon());
			if (!epsilonTargets) continue;
			epsilonTargets.forEach((nextId) => {
				if (closure.has(nextId)) return;
				closure.add(nextId);
				stack.push(nextId);
			});
		}
		return closure;
	};

	const move = (nfaStateIds, symbol) => {
		const out = new Set();
		nfaStateIds.forEach((stateId) => {
			const state = nfa.states.get(stateId);
			const targets = state?.transitions.get(symbol);
			targets?.forEach((nextId) => out.add(nextId));
		});
		return out;
	};

	if (nfa.startStateId === null || !nfa.states.has(nfa.startStateId)) {
		throw new Error("NFA has no valid start state.");
	}

	const startClosure = epsilonClosure(new Set([nfa.startStateId]));
	const subsets = new Map();
	const queue = [];

	const startDfaId = dfa.addState();
	dfa.setStartState(startDfaId);
	const startKey = [...startClosure].sort((a, b) => a - b).join(",");
	subsets.set(startKey, { dfaId: startDfaId, nfaStates: startClosure });
	queue.push(startKey);
	if ([...startClosure].some((id) => nfa.acceptStateIds.has(id))) {
		dfa.setAcceptState(startDfaId, true);
	}
	dfa.alphabet = new Set(nfa.alphabet);

	while (queue.length) {
		const subsetKey = queue.shift();
		const subset = subsets.get(subsetKey);
		for (const symbol of alphabet) {
			const moved = move(subset.nfaStates, symbol);
			if (moved.size === 0) continue;
			const targetClosure = epsilonClosure(moved);
			const targetKey = [...targetClosure].sort((a, b) => a - b).join(",");
			let targetDfaId;
			if (subsets.has(targetKey)) {
				targetDfaId = subsets.get(targetKey).dfaId;
			} else {
				targetDfaId = dfa.addState();
				subsets.set(targetKey, { dfaId: targetDfaId, nfaStates: targetClosure });
				queue.push(targetKey);
				if ([...targetClosure].some((id) => nfa.acceptStateIds.has(id))) {
					dfa.setAcceptState(targetDfaId, true);
				}
			}
			dfa.addTransition(subset.dfaId, targetDfaId, symbol);
		}
	}

	return dfa;
}

function reachableStates(automaton) {
	if (automaton.startStateId === null) return new Set();
	const seen = new Set([automaton.startStateId]);
	const queue = [automaton.startStateId];
	while (queue.length) {
		const stateId = queue.shift();
		const state = automaton.states.get(stateId);
		state?.transitions.forEach((targets) => {
			targets.forEach((targetId) => {
				if (seen.has(targetId)) return;
				seen.add(targetId);
				queue.push(targetId);
			});
		});
	}
	return seen;
}

export function minimizeDfa(dfa, epsilonSymbol) {
	const epsilon = () => epsilonSymbol;
	const reachable = reachableStates(dfa);
	const states = [...reachable].sort((a, b) => a - b);
	if (states.length === 0) {
		return new Automaton(() => 0, epsilon);
	}

	const alphabet = [...dfa.alphabet].sort();
	let partitions = [];
	const accepting = states.filter((stateId) => dfa.acceptStateIds.has(stateId));
	const nonAccepting = states.filter((stateId) => !dfa.acceptStateIds.has(stateId));
	if (accepting.length) partitions.push(accepting);
	if (nonAccepting.length) partitions.push(nonAccepting);

	let changed = true;
	while (changed) {
		changed = false;
		const nextPartitions = [];
		for (const partition of partitions) {
			const buckets = new Map();
			for (const stateId of partition) {
				const signature = alphabet
					.map((symbol) => {
						const target = [...(dfa.states.get(stateId)?.transitions.get(symbol) ?? [])][0];
						const targetPartition = partitions.findIndex((group) => group.includes(target));
						return `${symbol}:${targetPartition}`;
					})
					.join("|");
				if (!buckets.has(signature)) buckets.set(signature, []);
				buckets.get(signature).push(stateId);
			}
			if (buckets.size > 1) {
				changed = true;
			}
			nextPartitions.push(...buckets.values());
		}
		partitions = nextPartitions;
	}

	const ids = createIdFactory();
	const minimized = new Automaton(() => ids.next(), epsilon);
	const partitionToState = new Map();
	partitions.forEach((partition, index) => {
		const representative = partition[0];
		const newStateId = minimized.addState(partition.some((stateId) => dfa.acceptStateIds.has(stateId)));
		partitionToState.set(index, { newStateId, representative, members: partition });
		if (partition.includes(dfa.startStateId)) {
			minimized.setStartState(newStateId);
		}
	});

	partitions.forEach((partition, index) => {
		const { newStateId, representative } = partitionToState.get(index);
		const source = dfa.states.get(representative);
		alphabet.forEach((symbol) => {
			const target = [...(source?.transitions.get(symbol) ?? [])][0];
			if (target === undefined) return;
			const targetPartitionIndex = partitions.findIndex((group) => group.includes(target));
			const targetStateId = partitionToState.get(targetPartitionIndex).newStateId;
			minimized.addTransition(newStateId, targetStateId, symbol);
		});
	});

	minimized.alphabet = new Set(dfa.alphabet);
	return minimized;
}
