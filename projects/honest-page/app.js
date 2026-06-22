const sectionsElement = document.getElementById("sections");
const statusText = document.getElementById("statusText");
const refreshButton = document.getElementById("refreshButton");
const copyButton = document.getElementById("copyButton");
const locationButton = document.getElementById("locationButton");

let latestReport = {};

const unavailable = "Unavailable";

function read(fn, fallback = unavailable) {
	try {
		const value = fn();
		return value === undefined || value === null || value === "" ? fallback : value;
	} catch (error) {
		return `Error: ${error.message}`;
	}
}

function yesNo(value) {
	return value ? "Yes" : "No";
}

function formatValue(value) {
	if (Array.isArray(value)) {
		return value.length ? value.join(", ") : "[]";
	}

	if (typeof value === "boolean") {
		return yesNo(value);
	}

	if (typeof value === "object" && value !== null) {
		return JSON.stringify(value, null, 2);
	}

	return String(value);
}

function classify(value) {
	if (value === "Yes" || value === true || value === "granted") {
		return "honest-yes";
	}

	if (value === "No" || value === false || value === "denied" || String(value).startsWith("Error:")) {
		return String(value).startsWith("Error:") ? "honest-error" : "honest-no";
	}

	return "";
}

async function permissionState(name) {
	if (!navigator.permissions?.query) {
		return unavailable;
	}

	try {
		const result = await navigator.permissions.query({ name });
		return result.state;
	} catch (error) {
		return `Unsupported (${error.message})`;
	}
}

async function storageEstimate() {
	if (!navigator.storage?.estimate) {
		return unavailable;
	}

	const estimate = await navigator.storage.estimate();
	return {
		usage: estimate.usage,
		quota: estimate.quota,
		usageMB: estimate.usage ? Math.round(estimate.usage / 1024 / 1024) : 0,
		quotaMB: estimate.quota ? Math.round(estimate.quota / 1024 / 1024) : unavailable,
	};
}

async function mediaDevices() {
	if (!navigator.mediaDevices?.enumerateDevices) {
		return unavailable;
	}

	try {
		const devices = await navigator.mediaDevices.enumerateDevices();
		return devices.map((device) => ({
			kind: device.kind,
			label: device.label || "(label hidden without permission)",
			deviceId: device.deviceId ? "(present)" : unavailable,
			groupId: device.groupId ? "(present)" : unavailable,
		}));
	} catch (error) {
		return `Error: ${error.message}`;
	}
}

async function batteryInfo() {
	if (!navigator.getBattery) {
		return unavailable;
	}

	const battery = await navigator.getBattery();
	return {
		charging: battery.charging,
		level: `${Math.round(battery.level * 100)}%`,
		chargingTime: battery.chargingTime,
		dischargingTime: battery.dischargingTime,
	};
}

function collectSynchronousReport() {
	const nav = navigator;
	const screenInfo = window.screen;
	const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
	const date = new Date();

	return {
		"Browser and system": {
			"User agent": nav.userAgent,
			Platform: read(() => nav.platform),
			Vendor: read(() => nav.vendor),
			"Browser language": read(() => nav.language),
			"All languages": read(() => nav.languages),
			"Cookies enabled": read(() => nav.cookieEnabled),
			"Do Not Track": read(() => nav.doNotTrack || window.doNotTrack || nav.msDoNotTrack),
			Online: read(() => nav.onLine),
			"PDF viewer available": read(() => nav.pdfViewerEnabled),
			"Hardware threads": read(() => nav.hardwareConcurrency),
			"Memory class": read(() => (nav.deviceMemory ? `${nav.deviceMemory} GB` : unavailable)),
			"Max touch points": read(() => nav.maxTouchPoints),
		},
		"Screen and window": {
			"Screen resolution": `${screenInfo.width} x ${screenInfo.height}`,
			"Available screen space": `${screenInfo.availWidth} x ${screenInfo.availHeight}`,
			"Colour depth": `${screenInfo.colorDepth} bit`,
			"Pixel depth": `${screenInfo.pixelDepth} bit`,
			Viewport: `${window.innerWidth} x ${window.innerHeight}`,
			"Outer window": `${window.outerWidth} x ${window.outerHeight}`,
			"Device pixel ratio": window.devicePixelRatio,
			"Screen orientation": read(() => screenInfo.orientation.type),
			"Media: dark mode": read(() => matchMedia("(prefers-color-scheme: dark)").matches),
			"Media: reduced motion": read(() => matchMedia("(prefers-reduced-motion: reduce)").matches),
			"Media: precise pointer": read(() => matchMedia("(pointer: fine)").matches),
		},
		"Time and locale": {
			"Current browser time": date.toString(),
			"ISO time": date.toISOString(),
			"Time zone": read(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
			"UTC offset in minutes": date.getTimezoneOffset(),
			Locale: read(() => Intl.DateTimeFormat().resolvedOptions().locale),
			Calendar: read(() => Intl.DateTimeFormat().resolvedOptions().calendar),
			"Number format": read(() => new Intl.NumberFormat().format(1234567.89)),
			"Currency example": read(() => new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR" }).format(1234.56)),
		},
		"Page and network": {
			URL: location.href,
			Origin: location.origin,
			Referrer: document.referrer || unavailable,
			Protocol: location.protocol,
			Host: location.host,
			Path: location.pathname,
			"Connection type": read(() => connection?.effectiveType),
			Downlink: read(() => (connection?.downlink ? `${connection.downlink} Mbps` : unavailable)),
			"Round-trip time": read(() => (connection?.rtt ? `${connection.rtt} ms` : unavailable)),
			"Data saver": read(() => connection?.saveData),
		},
		"Browser capabilities": {
			localStorage: read(() => Boolean(window.localStorage)),
			sessionStorage: read(() => Boolean(window.sessionStorage)),
			IndexedDB: read(() => Boolean(window.indexedDB)),
			"Service workers": read(() => "serviceWorker" in navigator),
			WebGL: read(() => {
				const canvas = document.createElement("canvas");
				return Boolean(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
			}),
			"WebRTC media devices": read(() => Boolean(nav.mediaDevices?.enumerateDevices)),
			"Clipboard API": read(() => Boolean(nav.clipboard)),
			"Share API": read(() => Boolean(nav.share)),
			"Vibration API": read(() => Boolean(nav.vibrate)),
			"Geolocation API": read(() => Boolean(nav.geolocation)),
			"Credentials API": read(() => Boolean(nav.credentials)),
			"Payment Request API": read(() => "PaymentRequest" in window),
		},
	};
}

async function collectReport() {
	const report = collectSynchronousReport();

	report["Permissions"] = {
		Geolocation: await permissionState("geolocation"),
		Camera: await permissionState("camera"),
		Microphone: await permissionState("microphone"),
		Notifications: await permissionState("notifications"),
		"Read clipboard": await permissionState("clipboard-read"),
		"Write clipboard": await permissionState("clipboard-write"),
	};

	report["Storage, media, and energy"] = {
		"Storage estimate": await storageEstimate(),
		"Media devices": await mediaDevices(),
		Battery: await batteryInfo(),
	};

	return report;
}

function renderReport(report) {
	sectionsElement.textContent = "";

	for (const [title, entries] of Object.entries(report)) {
		const section = document.createElement("section");
		section.className = "honest-section";

		const header = document.createElement("header");
		const heading = document.createElement("h2");
		const meta = document.createElement("span");
		heading.textContent = title;
		meta.className = "honest-section-meta";
		meta.textContent = `${Object.keys(entries).length} fields`;
		header.append(heading, meta);

		const list = document.createElement("dl");
		list.className = "honest-grid";

		for (const [key, value] of Object.entries(entries)) {
			const item = document.createElement("div");
			const term = document.createElement("dt");
			const description = document.createElement("dd");
			const formatted = formatValue(value);

			item.className = "honest-item";
			term.textContent = key;
			description.textContent = formatted;
			description.className = classify(value);
			item.append(term, description);
			list.append(item);
		}

		section.append(header, list);
		sectionsElement.append(section);
	}
}

function updateSummary(report) {
	document.getElementById("summaryBrowser").textContent = report["Browser and system"]["Vendor"] || "Browser";
	document.getElementById("summaryScreen").textContent = report["Screen and window"]["Screen resolution"];
	document.getElementById("summaryLanguage").textContent = report["Browser and system"]["Browser language"];
	document.getElementById("summaryTimezone").textContent = report["Time and locale"]["Time zone"];
}

async function refresh() {
	statusText.textContent = "Loading measurements...";
	latestReport = await collectReport();
	renderReport(latestReport);
	updateSummary(latestReport);
	statusText.textContent = `Last measured at ${new Date().toLocaleTimeString()}.`;
}

async function copyReport() {
	const json = JSON.stringify(latestReport, null, 2);
	await navigator.clipboard.writeText(json);
	statusText.textContent = "JSON copied to the clipboard.";
}

function requestLocation() {
	if (!navigator.geolocation) {
		statusText.textContent = "Geolocation is not supported.";
		return;
	}

	statusText.textContent = "Waiting for location permission...";
	navigator.geolocation.getCurrentPosition(
		(position) => {
			latestReport["Explicitly requested location"] = {
				Latitude: position.coords.latitude,
				Longitude: position.coords.longitude,
				Accuracy: `${position.coords.accuracy} metres`,
				Altitude: position.coords.altitude ?? unavailable,
				Speed: position.coords.speed ?? unavailable,
				Timestamp: new Date(position.timestamp).toString(),
			};
			renderReport(latestReport);
			statusText.textContent = "Location added to the report.";
		},
		(error) => {
			latestReport["Explicitly requested location"] = {
				Status: `Error: ${error.message}`,
			};
			renderReport(latestReport);
			statusText.textContent = "The location could not be retrieved.";
		},
		{ enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
	);
}

refreshButton.addEventListener("click", refresh);
copyButton.addEventListener("click", () => {
	copyReport().catch((error) => {
		statusText.textContent = `Copy failed: ${error.message}`;
	});
});
locationButton.addEventListener("click", requestLocation);
window.addEventListener("resize", refresh);

refresh();
