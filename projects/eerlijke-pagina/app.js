const sectionsElement = document.getElementById("sections");
const statusText = document.getElementById("statusText");
const refreshButton = document.getElementById("refreshButton");
const copyButton = document.getElementById("copyButton");
const locationButton = document.getElementById("locationButton");

let latestReport = {};

const unavailable = "Niet beschikbaar";

function read(fn, fallback = unavailable) {
	try {
		const value = fn();
		return value === undefined || value === null || value === "" ? fallback : value;
	} catch (error) {
		return `Fout: ${error.message}`;
	}
}

function yesNo(value) {
	return value ? "Ja" : "Nee";
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
	if (value === "Ja" || value === true || value === "granted") {
		return "honest-yes";
	}

	if (value === "Nee" || value === false || value === "denied" || String(value).startsWith("Fout:")) {
		return String(value).startsWith("Fout:") ? "honest-error" : "honest-no";
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
		return `Niet ondersteund (${error.message})`;
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
			label: device.label || "(label verborgen zonder toestemming)",
			deviceId: device.deviceId ? "(aanwezig)" : unavailable,
			groupId: device.groupId ? "(aanwezig)" : unavailable,
		}));
	} catch (error) {
		return `Fout: ${error.message}`;
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
		"Browser en systeem": {
			"User agent": nav.userAgent,
			Platform: read(() => nav.platform),
			Vendor: read(() => nav.vendor),
			Browsertaal: read(() => nav.language),
			"Alle talen": read(() => nav.languages),
			"Cookies ingeschakeld": read(() => nav.cookieEnabled),
			"Do Not Track": read(() => nav.doNotTrack || window.doNotTrack || nav.msDoNotTrack),
			Online: read(() => nav.onLine),
			"PDF viewer beschikbaar": read(() => nav.pdfViewerEnabled),
			"Hardware threads": read(() => nav.hardwareConcurrency),
			Geheugenklasse: read(() => (nav.deviceMemory ? `${nav.deviceMemory} GB` : unavailable)),
			"Max touch points": read(() => nav.maxTouchPoints),
		},
		"Scherm en venster": {
			Schermresolutie: `${screenInfo.width} x ${screenInfo.height}`,
			"Beschikbare schermruimte": `${screenInfo.availWidth} x ${screenInfo.availHeight}`,
			Kleurdiepte: `${screenInfo.colorDepth} bit`,
			Pixeldiepte: `${screenInfo.pixelDepth} bit`,
			Viewport: `${window.innerWidth} x ${window.innerHeight}`,
			"Outer window": `${window.outerWidth} x ${window.outerHeight}`,
			"Device pixel ratio": window.devicePixelRatio,
			Schermorientatie: read(() => screenInfo.orientation.type),
			"Media: dark mode": read(() => matchMedia("(prefers-color-scheme: dark)").matches),
			"Media: reduced motion": read(() => matchMedia("(prefers-reduced-motion: reduce)").matches),
			"Media: pointer precies": read(() => matchMedia("(pointer: fine)").matches),
		},
		"Tijd en locale": {
			"Huidige browsertijd": date.toString(),
			"ISO tijd": date.toISOString(),
			Tijdzone: read(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
			"UTC offset minuten": date.getTimezoneOffset(),
			Locale: read(() => Intl.DateTimeFormat().resolvedOptions().locale),
			Kalender: read(() => Intl.DateTimeFormat().resolvedOptions().calendar),
			Getalsnotatie: read(() => new Intl.NumberFormat().format(1234567.89)),
			"Valuta voorbeeld": read(() => new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR" }).format(1234.56)),
		},
		"Pagina en netwerk": {
			URL: location.href,
			Origin: location.origin,
			Referrer: document.referrer || unavailable,
			Protocol: location.protocol,
			Host: location.host,
			Pad: location.pathname,
			Verbindingstype: read(() => connection?.effectiveType),
			Downlink: read(() => (connection?.downlink ? `${connection.downlink} Mbps` : unavailable)),
			"Round-trip time": read(() => (connection?.rtt ? `${connection.rtt} ms` : unavailable)),
			"Data saver": read(() => connection?.saveData),
		},
		Browsermogelijkheden: {
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

	report["Permissies"] = {
		Geolocatie: await permissionState("geolocation"),
		Camera: await permissionState("camera"),
		Microfoon: await permissionState("microphone"),
		Notificaties: await permissionState("notifications"),
		"Klembord lezen": await permissionState("clipboard-read"),
		"Klembord schrijven": await permissionState("clipboard-write"),
	};

	report["Opslag, media en energie"] = {
		"Storage estimate": await storageEstimate(),
		"Media-apparaten": await mediaDevices(),
		Batterij: await batteryInfo(),
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
		meta.textContent = `${Object.keys(entries).length} velden`;
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
	document.getElementById("summaryBrowser").textContent = report["Browser en systeem"]["Vendor"] || "Browser";
	document.getElementById("summaryScreen").textContent = report["Scherm en venster"]["Schermresolutie"];
	document.getElementById("summaryLanguage").textContent = report["Browser en systeem"]["Browsertaal"];
	document.getElementById("summaryTimezone").textContent = report["Tijd en locale"]["Tijdzone"];
}

async function refresh() {
	statusText.textContent = "Metingen worden geladen...";
	latestReport = await collectReport();
	renderReport(latestReport);
	updateSummary(latestReport);
	statusText.textContent = `Laatst gemeten om ${new Date().toLocaleTimeString()}.`;
}

async function copyReport() {
	const json = JSON.stringify(latestReport, null, 2);
	await navigator.clipboard.writeText(json);
	statusText.textContent = "JSON gekopieerd naar het klembord.";
}

function requestLocation() {
	if (!navigator.geolocation) {
		statusText.textContent = "Geolocatie wordt niet ondersteund.";
		return;
	}

	statusText.textContent = "Wachten op locatietoestemming...";
	navigator.geolocation.getCurrentPosition(
		(position) => {
			latestReport["Expliciet opgevraagde locatie"] = {
				Breedtegraad: position.coords.latitude,
				Lengtegraad: position.coords.longitude,
				Nauwkeurigheid: `${position.coords.accuracy} meter`,
				Hoogte: position.coords.altitude ?? unavailable,
				Snelheid: position.coords.speed ?? unavailable,
				Tijdstip: new Date(position.timestamp).toString(),
			};
			renderReport(latestReport);
			statusText.textContent = "Locatie toegevoegd aan het overzicht.";
		},
		(error) => {
			latestReport["Expliciet opgevraagde locatie"] = {
				Status: `Fout: ${error.message}`,
			};
			renderReport(latestReport);
			statusText.textContent = "Locatie kon niet worden opgehaald.";
		},
		{ enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
	);
}

refreshButton.addEventListener("click", refresh);
copyButton.addEventListener("click", () => {
	copyReport().catch((error) => {
		statusText.textContent = `Kopieren mislukt: ${error.message}`;
	});
});
locationButton.addEventListener("click", requestLocation);
window.addEventListener("resize", refresh);

refresh();
