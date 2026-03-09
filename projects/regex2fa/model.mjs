export class State {
	constructor(id, isAccepting = false) {
		this.id = id;
		this.isAccepting = isAccepting;
		this.transitions = new Map();
	}

	addTransition(symbol, nextStateId) {
		if (!this.transitions.has(symbol)) {
			this.transitions.set(symbol, new Set());
		}
		this.transitions.get(symbol).add(nextStateId);
	}
}

export class Automaton {
	constructor(stateFactory, epsilon) {
		this._stateFactory = stateFactory;
		this._epsilon = epsilon;
		this.states = new Map();
		this.startStateId = null;
		this.acceptStateIds = new Set();
		this.alphabet = new Set();
	}

	addState(isAccepting = false) {
		const id = this._stateFactory();
		const state = new State(id, isAccepting);
		this.states.set(id, state);
		if (isAccepting) {
			this.acceptStateIds.add(id);
		}
		return id;
	}

	setStartState(id) {
		this.startStateId = id;
	}

	setAcceptState(id, isAccepting = true) {
		const state = this.states.get(id);
		if (!state) return;
		state.isAccepting = isAccepting;
		if (isAccepting) {
			this.acceptStateIds.add(id);
		} else {
			this.acceptStateIds.delete(id);
		}
	}

	addTransition(fromId, toId, symbol) {
		const fromState = this.states.get(fromId);
		if (!fromState) return;
		fromState.addTransition(symbol, toId);
		if (symbol !== this._epsilon()) {
			this.alphabet.add(symbol);
		}
	}
}

export function createIdFactory() {
	let counter = 0;
	return {
		next() {
			return counter++;
		},
		peek() {
			return counter;
		},
		reset() {
			counter = 0;
		},
	};
}
