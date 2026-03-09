function createRng(seed) {
	let state = Math.trunc(seed) >>> 0 || 1;
	return () => {
		state = (1664525 * state + 1013904223) >>> 0;
		return state / 4294967296;
	};
}

function randomExponential(rate, rng = Math.random) {
	return -Math.log(1 - rng()) / rate;
}

function createNormalRandom(rng = Math.random) {
	let spareNormal = null;
	return function normalRandom() {
		if (spareNormal !== null) {
			const value = spareNormal;
			spareNormal = null;
			return value;
		}
		let u;
		let v;
		let s;
		do {
			u = rng() * 2 - 1;
			v = rng() * 2 - 1;
			s = u * u + v * v;
		} while (s === 0 || s >= 1);
		const mul = Math.sqrt((-2 * Math.log(s)) / s);
		spareNormal = v * mul;
		return u * mul;
	};
}

function randomGamma(shape, scale, rng = Math.random, normalRandom = createNormalRandom(rng)) {
	if (shape === 1) return randomExponential(1 / scale, rng);
	if (shape < 1) {
		const u = rng();
		return randomGamma(shape + 1, scale, rng, normalRandom) * Math.pow(u, 1 / shape);
	}
	const d = shape - 1 / 3;
	const c = 1 / Math.sqrt(9 * d);
	while (true) {
		let x;
		let v;
		do {
			x = normalRandom();
			v = 1 + c * x;
		} while (v <= 0);
		v = v * v * v;
		const u = rng();
		if (u < 1 - 0.0331 * x * x * x * x) return scale * d * v;
		if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return scale * d * v;
	}
}

function formatNumber(value, digits = 2) {
	return Number.isFinite(value) ? value.toFixed(digits) : "0.00";
}

function clampNumber(value, min, max, fallback) {
	const num = Number(value);
	if (!Number.isFinite(num)) return fallback;
	return Math.min(Math.max(num, min), max);
}

function mean(values) {
	if (!values.length) return 0;
	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleStdDev(values, avg = mean(values)) {
	if (values.length < 2) return 0;
	const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
	return Math.sqrt(variance);
}

function confidenceInterval95(values) {
	const avg = mean(values);
	const sd = sampleStdDev(values, avg);
	const halfWidth = values.length > 1 ? (1.96 * sd) / Math.sqrt(values.length) : 0;
	return { mean: avg, low: avg - halfWidth, high: avg + halfWidth };
}

function theoreticalMMCk(config) {
	if (config.serviceDistribution !== "exponential") return null;
	const lambda = config.arrivalRate;
	const mu = 1 / config.meanService;
	const c = config.servers;
	const K = config.capacity;
	const weights = [1];
	for (let n = 1; n <= K; n += 1) {
		weights[n] = weights[n - 1] * (lambda / (Math.min(n, c) * mu));
	}
	const normalizer = weights.reduce((sum, value) => sum + value, 0);
	const probs = weights.map((value) => value / normalizer);
	const blocking = probs[K];
	const system = probs.reduce((sum, prob, n) => sum + n * prob, 0);
	const queue = probs.reduce((sum, prob, n) => sum + Math.max(n - c, 0) * prob, 0);
	const lambdaEff = lambda * (1 - blocking);
	const systemTime = lambdaEff > 0 ? system / lambdaEff : 0;
	return { blocking, system, queue, lambdaEff, systemTime };
}

function simulateQueueScenario(config, seed) {
	const rng = createRng(seed);
	const normalRandom = createNormalRandom(rng);
	const servers = Array.from({ length: config.servers }, () => ({
		busy: false,
		customer: null,
		nextDeparture: Infinity,
		busyTimeMeasured: 0,
	}));
	const queue = [];
	let systemCount = 0;
	let simTime = 0;
	let customerId = 1;
	let nextArrival = randomExponential(config.arrivalRate, rng);
	const metrics = {
		measuredDuration: 0,
		arrivals: 0,
		served: 0,
		dropped: 0,
		waitTimeSum: 0,
		systemTimeSum: 0,
		queueArea: 0,
		systemArea: 0,
	};

	function busyServerCount() {
		return servers.filter((server) => server.busy).length;
	}

	function generateServiceTime() {
		if (config.serviceDistribution === "deterministic") return config.meanService;
		if (config.serviceDistribution === "exponential") return Math.max(1e-4, randomExponential(1 / config.meanService, rng));
		const cv = config.serviceCv;
		if (cv === 0) return config.meanService;
		const shape = 1 / (cv * cv);
		const scale = config.meanService / shape;
		return Math.max(1e-4, randomGamma(shape, scale, rng, normalRandom));
	}

	function nextEventTime() {
		let minTime = nextArrival;
		for (const server of servers) {
			if (server.nextDeparture < minTime) minTime = server.nextDeparture;
		}
		return minTime;
	}

	function advanceClock(newTime) {
		const measurementStart = config.warmupTime;
		const measurementEnd = measurementStart + config.measurementTime;
		const measuredFrom = Math.max(simTime, measurementStart);
		const measuredTo = Math.min(newTime, measurementEnd);
		const measuredDt = Math.max(measuredTo - measuredFrom, 0);
		if (measuredDt > 0) {
			const queueLen = Math.max(systemCount - busyServerCount(), 0);
			metrics.measuredDuration += measuredDt;
			metrics.queueArea += queueLen * measuredDt;
			metrics.systemArea += systemCount * measuredDt;
			for (const server of servers) {
				if (server.busy) server.busyTimeMeasured += measuredDt;
			}
		}
		simTime = newTime;
	}

	function inMeasurementWindow() {
		return simTime >= config.warmupTime && simTime <= config.warmupTime + config.measurementTime;
	}

	function startService(serverIndex, customer) {
		const server = servers[serverIndex];
		server.busy = true;
		server.customer = customer;
		customer.serviceStart = simTime;
		server.nextDeparture = simTime + generateServiceTime();
	}

	function handleArrival() {
		const customer = {
			id: customerId++,
			arrivalTime: simTime,
			measuredArrival: inMeasurementWindow(),
			serviceStart: null,
			departureTime: null,
		};
		if (customer.measuredArrival) metrics.arrivals += 1;
		if (systemCount >= config.capacity) {
			if (customer.measuredArrival) metrics.dropped += 1;
		} else {
			systemCount += 1;
			const freeServerIndex = servers.findIndex((server) => !server.busy);
			if (freeServerIndex >= 0 && queue.length === 0) {
				startService(freeServerIndex, customer);
			} else {
				queue.push(customer);
				if (freeServerIndex >= 0) {
					const nextCustomer = queue.shift();
					startService(freeServerIndex, nextCustomer);
				}
			}
		}
		nextArrival = simTime + randomExponential(config.arrivalRate, rng);
	}

	function handleDeparture(serverIndex) {
		const server = servers[serverIndex];
		const customer = server.customer;
		if (!customer) return;
		customer.departureTime = simTime;
		if (customer.measuredArrival && simTime >= config.warmupTime) {
			metrics.served += 1;
			metrics.waitTimeSum += customer.serviceStart - customer.arrivalTime;
			metrics.systemTimeSum += customer.departureTime - customer.arrivalTime;
		}
		systemCount -= 1;
		if (queue.length > 0) {
			const nextCustomer = queue.shift();
			startService(serverIndex, nextCustomer);
		} else {
			server.busy = false;
			server.customer = null;
			server.nextDeparture = Infinity;
		}
	}

	const endTime = config.warmupTime + config.measurementTime;
	while (simTime < endTime) {
		const nextEvent = nextEventTime();
		advanceClock(Math.min(nextEvent, endTime));
		if (simTime >= endTime) break;
		if (nextEvent === nextArrival) handleArrival();
		else {
			const serverIndex = servers.findIndex((server) => server.nextDeparture === nextEvent);
			if (serverIndex >= 0) handleDeparture(serverIndex);
			else break;
		}
	}

	const measuredSeconds = Math.max(metrics.measuredDuration, 1e-9);
	const throughput = metrics.served / measuredSeconds;
	const avgWait = metrics.served > 0 ? metrics.waitTimeSum / metrics.served : 0;
	const avgSystem = metrics.served > 0 ? metrics.systemTimeSum / metrics.served : 0;
	const avgQueueLen = metrics.queueArea / measuredSeconds;
	const avgSystemLen = metrics.systemArea / measuredSeconds;
	const dropRate = metrics.arrivals > 0 ? metrics.dropped / metrics.arrivals : 0;
	const lambdaEff = measuredSeconds > 0 ? (metrics.arrivals - metrics.dropped) / measuredSeconds : 0;
	const littlesGap = avgSystemLen - lambdaEff * avgSystem;
	const meanUtil = mean(servers.map((server) => server.busyTimeMeasured / measuredSeconds));
	return {
		throughput,
		avgWait,
		avgSystem,
		avgQueueLen,
		avgSystemLen,
		dropRate,
		littlesGap,
		meanUtil,
	};
}

class QueueSimulation {
	constructor() {
		this.config = {
			servers: 2,
			capacity: 10,
			arrivalRate: 1.2,
			meanService: 0.7,
			serviceCv: 0.8,
			serviceDistribution: "gamma",
			speed: 10,
			warmupTime: 60,
			measurementTime: 300,
		};

		this.elements = {
			serverBank: document.getElementById("serverBank"),
			queue: document.getElementById("queueArea"),
			serverSlots: [],
			serverPanels: [],
			simTime: document.getElementById("simTime"),
			simPhase: document.getElementById("simPhase"),
			measuredTime: document.getElementById("measuredTime"),
			inSystem: document.getElementById("inSystem"),
			inQueue: document.getElementById("inQueue"),
			busyServers: document.getElementById("busyServers"),
			arrivals: document.getElementById("arrivals"),
			served: document.getElementById("served"),
			dropped: document.getElementById("dropped"),
			throughput: document.getElementById("throughput"),
			avgWait: document.getElementById("avgWait"),
			avgSystem: document.getElementById("avgSystem"),
			meanUtil: document.getElementById("meanUtil"),
			utilBreakdown: document.getElementById("utilBreakdown"),
			rho: document.getElementById("rho"),
			avgQueueLen: document.getElementById("avgQueueLen"),
			avgSystemLen: document.getElementById("avgSystemLen"),
			dropRate: document.getElementById("dropRate"),
			distributionLabel: document.getElementById("distributionLabel"),
			historyChart: document.getElementById("historyChart"),
			batchRuns: document.getElementById("batchRuns"),
			batchSeedRange: document.getElementById("batchSeedRange"),
			batchThroughput: document.getElementById("batchThroughput"),
			batchThroughputCi: document.getElementById("batchThroughputCi"),
			batchAvgWait: document.getElementById("batchAvgWait"),
			batchAvgWaitCi: document.getElementById("batchAvgWaitCi"),
			batchDropRate: document.getElementById("batchDropRate"),
			batchDropRateCi: document.getElementById("batchDropRateCi"),
			batchAvgQueueLen: document.getElementById("batchAvgQueueLen"),
			batchAvgQueueLenCi: document.getElementById("batchAvgQueueLenCi"),
			batchLittlesGap: document.getElementById("batchLittlesGap"),
			batchMeanUtil: document.getElementById("batchMeanUtil"),
			theoryModel: document.getElementById("theoryModel"),
			theoryBlocking: document.getElementById("theoryBlocking"),
			theorySystem: document.getElementById("theorySystem"),
			theoryQueue: document.getElementById("theoryQueue"),
			theoryLambdaEff: document.getElementById("theoryLambdaEff"),
			theorySystemTime: document.getElementById("theorySystemTime"),
		};

		this.canvas = document.querySelector(".queue-sim-canvas");
		this.layer = document.getElementById("customerLayer");
		this.entryAnchor = document.querySelector(".queue-sim-cloud .queue-sim-arrow");
		this.exitAnchor = document.querySelector(".queue-sim-exit .queue-sim-arrow");
		this.customerElements = new Map();
		this.customerSize = 36;
		this.queueSpacing = 44;
		this.queueRowHeight = 44;
		this.history = [];
		this.running = false;

		this.handleResize = this.handleResize.bind(this);
		window.addEventListener("resize", this.handleResize);
		this.rebuildServerBank();
		this.refreshLayout();
		this.reset();
	}

	rebuildServerBank() {
		this.elements.serverBank.innerHTML = "";
		for (let index = 0; index < this.config.servers; index += 1) {
			const panel = document.createElement("div");
			panel.className = "queue-sim-server";
			panel.dataset.server = String(index);
			panel.innerHTML = `
        <span class="queue-sim-label">Server ${index + 1}</span>
        <div class="slot" data-slot="${index}"></div>
      `;
			this.elements.serverBank.appendChild(panel);
		}
		this.elements.serverSlots = Array.from(this.elements.serverBank.querySelectorAll(".slot"));
		this.elements.serverPanels = Array.from(this.elements.serverBank.querySelectorAll(".queue-sim-server"));
	}

	refreshLayout() {
		this.canvasRect = this.canvas.getBoundingClientRect();
		this.queueRect = this.elements.queue.getBoundingClientRect();
		this.serverRects = this.elements.serverSlots.map((slot) => slot.getBoundingClientRect());
		this.entryRect = this.entryAnchor.getBoundingClientRect();
		this.exitRect = this.exitAnchor.getBoundingClientRect();
	}

	handleResize() {
		clearTimeout(this._resizeTimer);
		this._resizeTimer = setTimeout(() => {
			this.refreshLayout();
			this.updateAllPositions(true);
			this.renderHistory();
		}, 100);
	}

	reset() {
		this.simTime = 0;
		this.lastRealTime = null;
		this.measurementStarted = false;
		this.measurementCompleted = false;
		this.queue = [];
		this.systemCount = 0;
		this.customerId = 1;
		this.customerElements.forEach((element) => element.remove());
		this.customerElements.clear();
		this.layer.innerHTML = "";

		this.nextArrival = { time: randomExponential(this.config.arrivalRate) };
		this.servers = Array.from({ length: this.config.servers }, () => ({
			busy: false,
			customer: null,
			nextDeparture: Infinity,
			busyTimeTotal: 0,
			busyTimeMeasured: 0,
		}));

		this.metrics = {
			measuredDuration: 0,
			arrivals: 0,
			served: 0,
			dropped: 0,
			waitTimeSum: 0,
			systemTimeSum: 0,
			queueArea: 0,
			systemArea: 0,
		};

		this.history = [];
		this.updateAllPositions(true);
		this.render();
	}

	updateConfig(newConfig) {
		const previousServers = this.config.servers;
		Object.assign(this.config, newConfig);
		if (previousServers !== this.config.servers) {
			this.rebuildServerBank();
			this.refreshLayout();
		}
		this.reset();
	}

	start() {
		if (this.running) return;
		this.running = true;
		this.lastRealTime = performance.now();
		this.animationFrame = requestAnimationFrame(() => this.tick());
	}

	pause() {
		if (!this.running) return;
		this.running = false;
		cancelAnimationFrame(this.animationFrame);
		this.animationFrame = null;
	}

	tick() {
		if (!this.running) return;
		const now = performance.now();
		const realDelta = (now - this.lastRealTime) / 1000;
		this.lastRealTime = now;
		const targetSimTime = this.simTime + realDelta * this.config.speed;
		this.advanceTo(targetSimTime);
		this.render();
		if (this.measurementCompleted) {
			this.pause();
			return;
		}
		this.animationFrame = requestAnimationFrame(() => this.tick());
	}

	advanceTo(targetTime) {
		while (true) {
			const nextEvent = this.nextEventTime();
			if (nextEvent > targetTime) break;
			this.advanceClock(nextEvent);
			if (nextEvent === this.nextArrival.time) {
				this.handleArrival();
			} else {
				const serverIndex = this.servers.findIndex((server) => server.nextDeparture === nextEvent);
				if (serverIndex >= 0) this.handleDeparture(serverIndex);
				else break;
			}
			if (this.measurementCompleted) break;
		}
		this.advanceClock(Math.min(targetTime, this.config.warmupTime + this.config.measurementTime));
	}

	nextEventTime() {
		let minTime = this.nextArrival.time;
		for (const server of this.servers) {
			if (server.nextDeparture < minTime) minTime = server.nextDeparture;
		}
		return minTime;
	}

	advanceClock(newTime) {
		const dt = newTime - this.simTime;
		if (dt <= 0) {
			this.simTime = newTime;
			return;
		}

		const measurementStart = this.config.warmupTime;
		const measurementEnd = measurementStart + this.config.measurementTime;
		const measuredFrom = Math.max(this.simTime, measurementStart);
		const measuredTo = Math.min(newTime, measurementEnd);
		const measuredDt = Math.max(measuredTo - measuredFrom, 0);

		if (measuredDt > 0) {
			this.measurementStarted = true;
			const queueLen = Math.max(this.systemCount - this.busyServerCount(), 0);
			this.metrics.measuredDuration += measuredDt;
			this.metrics.queueArea += queueLen * measuredDt;
			this.metrics.systemArea += this.systemCount * measuredDt;
			for (const server of this.servers) {
				if (server.busy) server.busyTimeMeasured += measuredDt;
			}
		}

		for (const server of this.servers) {
			if (server.busy) server.busyTimeTotal += dt;
		}

		this.simTime = newTime;
		if (this.simTime >= measurementEnd) this.measurementCompleted = true;
		this.recordHistory();
	}

	inMeasurementWindow() {
		return this.simTime >= this.config.warmupTime && this.simTime <= this.config.warmupTime + this.config.measurementTime;
	}

	handleArrival() {
		const customer = {
			id: this.customerId++,
			arrivalTime: this.simTime,
			measuredArrival: this.inMeasurementWindow(),
			serviceStart: null,
			departureTime: null,
		};

		this.createCustomerElement(customer);
		if (customer.measuredArrival) this.metrics.arrivals += 1;

		if (this.systemCount >= this.config.capacity) {
			if (customer.measuredArrival) this.metrics.dropped += 1;
			this.rejectCustomer(customer);
		} else {
			this.systemCount += 1;
			const freeServerIndex = this.servers.findIndex((server) => !server.busy);
			if (freeServerIndex >= 0 && this.queue.length === 0) {
				this.startService(freeServerIndex, customer, true);
			} else {
				this.queue.push(customer);
				this.updateQueuePositions();
				if (freeServerIndex >= 0) {
					const nextCustomer = this.queue.shift();
					this.startService(freeServerIndex, nextCustomer);
					this.updateQueuePositions();
				}
			}
		}

		this.nextArrival.time = this.simTime + randomExponential(this.config.arrivalRate);
	}

	startService(serverIndex, customer, directFromArrival = false) {
		const server = this.servers[serverIndex];
		server.busy = true;
		server.customer = customer;
		customer.serviceStart = this.simTime;
		server.nextDeparture = this.simTime + this.generateServiceTime();
		if (directFromArrival) this.animateDirectService(customer, serverIndex);
		else this.moveCustomerToServer(customer, serverIndex);
		this.renderServers();
	}

	handleDeparture(serverIndex) {
		const server = this.servers[serverIndex];
		const customer = server.customer;
		if (!customer) return;
		customer.departureTime = this.simTime;
		if (customer.measuredArrival && this.simTime >= this.config.warmupTime) {
			this.metrics.served += 1;
			this.metrics.waitTimeSum += customer.serviceStart - customer.arrivalTime;
			this.metrics.systemTimeSum += customer.departureTime - customer.arrivalTime;
		}

		this.systemCount -= 1;
		this.sendCustomerToExit(customer.id);
		if (this.queue.length > 0) {
			const nextCustomer = this.queue.shift();
			this.startService(serverIndex, nextCustomer);
			this.updateQueuePositions();
		} else {
			server.busy = false;
			server.customer = null;
			server.nextDeparture = Infinity;
		}
		this.renderServers();
	}

	busyServerCount() {
		return this.servers.filter((server) => server.busy).length;
	}

	generateServiceTime() {
		const mean = this.config.meanService;
		if (this.config.serviceDistribution === "deterministic") return mean;
		if (this.config.serviceDistribution === "exponential") return Math.max(1e-4, randomExponential(1 / mean));
		const cv = this.config.serviceCv;
		if (cv === 0) return mean;
		const shape = 1 / (cv * cv);
		const scale = mean / shape;
		return Math.max(1e-4, randomGamma(shape, scale));
	}

	createCustomerElement(customer) {
		let element = this.customerElements.get(customer.id);
		if (element) return element;
		this.refreshLayout();
		element = document.createElement("div");
		element.className = "customer";
		element.textContent = customer.id;
		const spawn = this.getEntryPosition();
		const jitterX = Math.random() * 12 - 6;
		const jitterY = Math.random() * 10 - 5;
		this.setElementPosition(element, { x: spawn.x + jitterX, y: spawn.y + jitterY }, true);
		this.layer.appendChild(element);
		requestAnimationFrame(() => element.classList.add("visible"));
		this.customerElements.set(customer.id, element);
		return element;
	}

	animateDirectService(customer, serverIndex) {
		const element = this.createCustomerElement(customer);
		const queueFront = this.getQueuePosition(0);
		this.setElementPosition(element, queueFront);
		setTimeout(() => {
			if (this.customerElements.has(customer.id)) this.moveCustomerToServer(customer, serverIndex);
		}, 220);
	}

	moveCustomerToQueue(customer, index, immediate = false) {
		const element = this.createCustomerElement(customer);
		this.setElementPosition(element, this.getQueuePosition(index), immediate);
	}

	moveCustomerToServer(customer, serverIndex, immediate = false) {
		const server = this.servers[serverIndex];
		if (!server || server.customer !== customer) return;
		const element = this.createCustomerElement(customer);
		this.setElementPosition(element, this.getServerPosition(serverIndex), immediate);
	}

	sendCustomerToExit(customerId) {
		const element = this.customerElements.get(customerId);
		if (!element) return;
		this.setElementPosition(element, this.getExitPosition());
		requestAnimationFrame(() => {
			element.style.opacity = "0";
		});
		setTimeout(() => this.removeCustomerElement(customerId), 700);
	}

	rejectCustomer(customer) {
		const element = this.createCustomerElement(customer);
		element.classList.add("rejected");
		const entry = this.getEntryPosition();
		this.setElementPosition(element, { x: entry.x + 28, y: entry.y - 52 });
		requestAnimationFrame(() => {
			element.style.opacity = "0";
		});
		setTimeout(() => this.removeCustomerElement(customer.id), 520);
	}

	removeCustomerElement(customerId) {
		const element = this.customerElements.get(customerId);
		if (!element) return;
		element.remove();
		this.customerElements.delete(customerId);
	}

	updateQueuePositions(immediate = false) {
		this.refreshLayout();
		this.queue.forEach((customer, index) => this.moveCustomerToQueue(customer, index, immediate));
	}

	updateAllPositions(immediate = false) {
		this.refreshLayout();
		this.queue.forEach((customer, index) => this.moveCustomerToQueue(customer, index, immediate));
		this.servers.forEach((server, index) => {
			if (server.busy && server.customer) this.moveCustomerToServer(server.customer, index, immediate);
		});
	}

	getEntryPosition() {
		return {
			x: this.entryRect.left - this.canvasRect.left - this.customerSize * 1.4,
			y: this.entryRect.top - this.canvasRect.top + this.entryRect.height / 2 - this.customerSize / 2,
		};
	}

	getQueuePosition(index) {
		const padding = 12;
		const availableWidth = Math.max(this.queueRect.width - padding * 2, this.queueSpacing);
		const perRow = Math.max(Math.floor(availableWidth / this.queueSpacing), 1);
		const col = index % perRow;
		const row = Math.floor(index / perRow);
		const startX = this.queueRect.left - this.canvasRect.left + this.queueRect.width - padding - this.customerSize;
		const minX = this.queueRect.left - this.canvasRect.left + padding;
		return {
			x: Math.max(minX, startX - col * this.queueSpacing),
			y: this.queueRect.top - this.canvasRect.top + padding + row * this.queueRowHeight,
		};
	}

	getServerPosition(index) {
		const rect = this.serverRects[index];
		return {
			x: rect.left - this.canvasRect.left + rect.width / 2 - this.customerSize / 2,
			y: rect.top - this.canvasRect.top + rect.height / 2 - this.customerSize / 2,
		};
	}

	getExitPosition() {
		return {
			x: this.exitRect.left - this.canvasRect.left + this.exitRect.width + 36,
			y: this.exitRect.top - this.canvasRect.top + this.exitRect.height / 2 - this.customerSize / 2,
		};
	}

	setElementPosition(element, position, immediate = false) {
		if (immediate) {
			element.style.transition = "none";
			element.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`;
			element.offsetHeight;
			element.style.transition = "";
			return;
		}
		element.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`;
	}

	recordHistory() {
		this.history.push({
			t: this.simTime,
			queue: this.queue.length,
			system: this.systemCount,
			drop: this.systemCount >= this.config.capacity ? 1 : 0,
		});
		if (this.history.length > 240) this.history.shift();
	}

	renderHistory() {
		const svg = this.elements.historyChart;
		if (!svg) return;
		const width = 800;
		const height = 220;
		const padding = 16;
		const data = this.history;
		if (!data.length) {
			svg.innerHTML = "";
			return;
		}
		const maxY = Math.max(this.config.capacity, ...data.map((point) => point.system), 1);
		const x = (index) => padding + (index / Math.max(data.length - 1, 1)) * (width - padding * 2);
		const y = (value) => height - padding - (value / maxY) * (height - padding * 2);
		const line = (key) => data.map((point, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(point[key])}`).join(" ");
		const dropSegments = data
			.filter((point) => point.drop)
			.map((point, index) => `<circle cx="${x(data.indexOf(point))}" cy="${y(0.3)}" r="3.5" fill="#dc2626"></circle>`)
			.join("");
		svg.innerHTML = `
      <path d="${line("system")}" fill="none" stroke="#2563eb" stroke-width="2.5"></path>
      <path d="${line("queue")}" fill="none" stroke="#0f766e" stroke-width="2.5"></path>
      ${dropSegments}
    `;
	}

	renderServers() {
		this.servers.forEach((server, index) => {
			this.elements.serverPanels[index].classList.toggle("busy", server.busy);
		});
	}

	renderStats() {
		const measuredSeconds = Math.max(this.metrics.measuredDuration, 1e-9);
		const throughput = this.metrics.served / measuredSeconds;
		const avgWait = this.metrics.served > 0 ? this.metrics.waitTimeSum / this.metrics.served : 0;
		const avgSystem = this.metrics.served > 0 ? this.metrics.systemTimeSum / this.metrics.served : 0;
		const utilPercents = this.servers.map((server) => (server.busyTimeMeasured / measuredSeconds) * 100);
		const meanUtil = mean(utilPercents);
		const avgQueueLen = this.metrics.queueArea / measuredSeconds;
		const avgSystemLen = this.metrics.systemArea / measuredSeconds;
		const dropRate = this.metrics.arrivals > 0 ? (this.metrics.dropped / this.metrics.arrivals) * 100 : 0;
		const rho = (this.config.arrivalRate * this.config.meanService) / this.config.servers;
		const distributionLabels = {
			gamma: `Gamma (CV ${formatNumber(this.config.serviceCv, 1)})`,
			exponential: "Exponential",
			deterministic: "Deterministic",
		};

		this.elements.simTime.textContent = `${formatNumber(this.simTime, 1)}s`;
		this.elements.simPhase.textContent = this.measurementCompleted ? "Done" : this.measurementStarted ? "Measurement" : "Warm-up";
		this.elements.measuredTime.textContent = `${formatNumber(this.metrics.measuredDuration, 1)}s`;
		this.elements.inSystem.textContent = String(this.systemCount);
		this.elements.inQueue.textContent = String(this.queue.length);
		this.elements.busyServers.textContent = String(this.busyServerCount());
		this.elements.arrivals.textContent = String(this.metrics.arrivals);
		this.elements.served.textContent = String(this.metrics.served);
		this.elements.dropped.textContent = String(this.metrics.dropped);
		this.elements.throughput.textContent = `${formatNumber(throughput, 2)}/s`;
		this.elements.avgWait.textContent = `${formatNumber(avgWait, 2)}s`;
		this.elements.avgSystem.textContent = `${formatNumber(avgSystem, 2)}s`;
		this.elements.meanUtil.textContent = `${formatNumber(meanUtil, 1)}%`;
		this.elements.utilBreakdown.textContent = utilPercents.map((value, index) => `S${index + 1} ${formatNumber(value, 1)}%`).join(" · ");
		this.elements.avgQueueLen.textContent = formatNumber(avgQueueLen);
		this.elements.avgSystemLen.textContent = formatNumber(avgSystemLen);
		this.elements.dropRate.textContent = `${formatNumber(dropRate, 1)}%`;
		this.elements.rho.textContent = formatNumber(rho);
		this.elements.distributionLabel.textContent = distributionLabels[this.config.serviceDistribution];
		const theory = theoreticalMMCk(this.config);
		if (theory) {
			this.elements.theoryModel.textContent = `M/M/${this.config.servers}/${this.config.capacity}`;
			this.elements.theoryBlocking.textContent = formatNumber(theory.blocking, 4);
			this.elements.theorySystem.textContent = formatNumber(theory.system, 3);
			this.elements.theoryQueue.textContent = formatNumber(theory.queue, 3);
			this.elements.theoryLambdaEff.textContent = `${formatNumber(theory.lambdaEff, 3)}/s`;
			this.elements.theorySystemTime.textContent = `${formatNumber(theory.systemTime, 3)}s`;
		} else {
			this.elements.theoryModel.textContent = "n/a";
			this.elements.theoryBlocking.textContent = "-";
			this.elements.theorySystem.textContent = "-";
			this.elements.theoryQueue.textContent = "-";
			this.elements.theoryLambdaEff.textContent = "-";
			this.elements.theorySystemTime.textContent = "-";
		}
		this.renderHistory();
	}

	render() {
		this.renderServers();
		this.renderStats();
	}
}

const simulation = new QueueSimulation();

const arrivalRateInput = document.getElementById("arrivalRate");
const meanServiceInput = document.getElementById("meanService");
const serviceDistributionInput = document.getElementById("serviceDistribution");
const serviceCvInput = document.getElementById("serviceCv");
const capacityInput = document.getElementById("capacity");
const serversInput = document.getElementById("servers");
const warmupTimeInput = document.getElementById("warmupTime");
const measurementTimeInput = document.getElementById("measurementTime");
const speedInput = document.getElementById("speed");
const baseSeedInput = document.getElementById("baseSeed");
const replicationsInput = document.getElementById("replications");
const cvValue = document.getElementById("cvValue");
const speedValue = document.getElementById("speedValue");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const runReplicationsBtn = document.getElementById("runReplicationsBtn");

function syncDistributionUi() {
	const isGamma = serviceDistributionInput.value === "gamma";
	serviceCvInput.disabled = !isGamma;
	cvValue.textContent = isGamma ? Number(serviceCvInput.value).toFixed(1) : "n/a";
}

function applyFormConfig() {
	const arrivalRate = clampNumber(arrivalRateInput.value, 0.05, 8, 1.2);
	const meanService = clampNumber(meanServiceInput.value, 0.05, 5, 0.7);
	const servers = Math.round(clampNumber(serversInput.value, 1, 8, 2));
	const capacity = Math.round(clampNumber(capacityInput.value, servers, 60, 10));
	const serviceCv = clampNumber(serviceCvInput.value, 0, 2, 0.8);
	const warmupTime = clampNumber(warmupTimeInput.value, 0, 10000, 60);
	const measurementTime = clampNumber(measurementTimeInput.value, 10, 10000, 300);
	const speed = Math.round(clampNumber(speedInput.value, 1, 80, 10));
	arrivalRateInput.value = arrivalRate;
	meanServiceInput.value = meanService;
	serversInput.value = servers;
	capacityInput.min = String(servers);
	capacityInput.value = capacity;
	warmupTimeInput.value = warmupTime;
	measurementTimeInput.value = measurementTime;
	serviceCvInput.value = serviceCv;
	speedInput.value = speed;
	speedValue.textContent = `${speed}×`;
	syncDistributionUi();
	simulation.updateConfig({
		servers,
		arrivalRate,
		meanService,
		capacity,
		serviceCv,
		serviceDistribution: serviceDistributionInput.value,
		warmupTime,
		measurementTime,
		speed,
	});
}

function formatCi(ci, suffix = "") {
	return `[${formatNumber(ci.low, 2)}, ${formatNumber(ci.high, 2)}]${suffix}`;
}

function updateBatchSummary(summary) {
	simulation.elements.batchRuns.textContent = String(summary.runs);
	simulation.elements.batchSeedRange.textContent = `${summary.baseSeed}..${summary.baseSeed + summary.runs - 1}`;
	simulation.elements.batchThroughput.textContent = `${formatNumber(summary.throughput.mean, 2)}/s`;
	simulation.elements.batchThroughputCi.textContent = formatCi(summary.throughput, "/s");
	simulation.elements.batchAvgWait.textContent = `${formatNumber(summary.avgWait.mean, 2)}s`;
	simulation.elements.batchAvgWaitCi.textContent = formatCi(summary.avgWait, "s");
	simulation.elements.batchDropRate.textContent = `${formatNumber(summary.dropRate.mean * 100, 1)}%`;
	simulation.elements.batchDropRateCi.textContent = `[${formatNumber(summary.dropRate.low * 100, 1)}, ${formatNumber(summary.dropRate.high * 100, 1)}]%`;
	simulation.elements.batchAvgQueueLen.textContent = formatNumber(summary.avgQueueLen.mean, 2);
	simulation.elements.batchAvgQueueLenCi.textContent = formatCi(summary.avgQueueLen);
	simulation.elements.batchLittlesGap.textContent = formatNumber(summary.littlesGap.mean, 3);
	simulation.elements.batchMeanUtil.textContent = `${formatNumber(summary.meanUtil.mean * 100, 1)}%`;
}

function runBatchReplications() {
	const baseSeed = Math.round(clampNumber(baseSeedInput.value, 1, 2147483647, 12345));
	const runs = Math.round(clampNumber(replicationsInput.value, 2, 500, 50));
	baseSeedInput.value = baseSeed;
	replicationsInput.value = runs;
	const config = { ...simulation.config };
	const results = [];
	for (let index = 0; index < runs; index += 1) {
		results.push(simulateQueueScenario(config, baseSeed + index));
	}
	updateBatchSummary({
		baseSeed,
		runs,
		throughput: confidenceInterval95(results.map((result) => result.throughput)),
		avgWait: confidenceInterval95(results.map((result) => result.avgWait)),
		dropRate: confidenceInterval95(results.map((result) => result.dropRate)),
		avgQueueLen: confidenceInterval95(results.map((result) => result.avgQueueLen)),
		littlesGap: confidenceInterval95(results.map((result) => result.littlesGap)),
		meanUtil: confidenceInterval95(results.map((result) => result.meanUtil)),
	});
}

arrivalRateInput.addEventListener("change", applyFormConfig);
meanServiceInput.addEventListener("change", applyFormConfig);
serviceDistributionInput.addEventListener("change", applyFormConfig);
serversInput.addEventListener("change", applyFormConfig);
capacityInput.addEventListener("change", applyFormConfig);
warmupTimeInput.addEventListener("change", applyFormConfig);
measurementTimeInput.addEventListener("change", applyFormConfig);
serviceCvInput.addEventListener("input", syncDistributionUi);
serviceCvInput.addEventListener("change", applyFormConfig);
speedInput.addEventListener("input", () => {
	speedValue.textContent = `${speedInput.value}×`;
	simulation.config.speed = Number(speedInput.value);
});

startBtn.addEventListener("click", () => simulation.start());
pauseBtn.addEventListener("click", () => {
	if (simulation.running) {
		simulation.pause();
		pauseBtn.textContent = "Resume";
	} else {
		simulation.start();
		pauseBtn.textContent = "Pause";
	}
});
resetBtn.addEventListener("click", () => {
	simulation.pause();
	simulation.reset();
	pauseBtn.textContent = "Pause";
});
runReplicationsBtn.addEventListener("click", runBatchReplications);

document.addEventListener("visibilitychange", () => {
	if (document.hidden && simulation.running) {
		simulation.pause();
		pauseBtn.textContent = "Resume";
		simulation._pausedByVisibility = true;
	} else if (!document.hidden && simulation._pausedByVisibility) {
		simulation._pausedByVisibility = false;
		simulation.start();
		pauseBtn.textContent = "Pause";
	}
});

document.addEventListener("keydown", (event) => {
	const tagName = event.target?.tagName;
	if (tagName === "INPUT" || tagName === "SELECT") return;
	if (event.code !== "Space") return;
	event.preventDefault();
	if (simulation.running) {
		simulation.pause();
		pauseBtn.textContent = "Resume";
	} else {
		simulation.start();
		pauseBtn.textContent = "Pause";
	}
});

applyFormConfig();
runBatchReplications();
