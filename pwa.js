const CONSOLE_STYLE = "background: #66023C; color: #fff; padding: 2px";

// This script installs the service worker that turns the website into a basic PWA
// if ('serviceWorker' in navigator) {
// 	navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(reg => {
// 		if (reg.installing) {
// 			console.info('%cpwa.js: Service worker installing', CONSOLE_STYLE);
// 		} else if (reg.waiting) {
// 			console.info('%cpwa.js: Service worker installed', CONSOLE_STYLE);
// 		} else if (reg.active) {
// 			console.info('%cpwa.js: Service worker active', CONSOLE_STYLE);
// 		}
// 	}).catch(error => {
// 		console.info(`%cpwa.js: Registration failed with ${error}`, CONSOLE_STYLE);
// 	});
// }

// Unregister all serviceworkers - I want to test the site without PWA functionality
navigator.serviceWorker.getRegistrations().then(registrations => {
	for (let registration of registrations) {
		registration.unregister();
	}
});


/*************************************************************
* Fill in the current year for (c) at the bottom of the page *
*************************************************************/
let ty = document.getElementById("target-year");
ty.innerHTML = new Date().getFullYear() + 10000;

/************************************************************************
* Filling in of "Last updated:" updated stuff at the bottom of the page *
************************************************************************/
let updated = document.getElementById("updated");
let date = new Date(document.lastModified);
updated.innerHTML = date.toISOString().split("T")[0];

// Ssssh, don't tell anyone!
const specialGoto = event => {
	if (event.ctrlKey && event.shiftKey) {
		window.location.href = "/pages/praetorianpi.html";
	}
}

/***********************
* Cookie related stuff *
***********************/
const getCookie = name => {
	return document.cookie
		.split("; ")
		.map((cookie) => cookie.split("="))
		.filter((cookie) => cookie[0] == name)[0];
}

const setCookie = (name, value, exdays = 365) => {
	let d = new Date(Date.now() + exdays * 24 * 60 * 60 * 1000);
	let expires = "expires=" + d.toUTCString();
	document.cookie = name + "=" + value + ";" + expires + ";path=/";
}

const cookieExists = name => {
	return getCookie(name) !== undefined
}
const getCookieValue = name => {
	return cookieExists(name) ? getCookie(name)[1] : [];
}

// remove cookie notification if the user already accepted the notification
let notification = document.getElementById("cookie-notification");
if (notification !== undefined) {
	if (getCookieValue('cookie-notification') === "read") {
		notification.parentNode.removeChild(notification);
		console.info("cookie notification removed");
	} else {
		notification.addEventListener("click", () => {
			setCookie('cookie-notification', 'read', 365);
			notification.parentNode.removeChild(notification);
		});
	}
}