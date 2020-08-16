// https://developers.google.com/web/fundamentals/primers/service-workers
// https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers
// https://github.com/mdn/sw-test
// https://github.com/jakearchibald/svgomg/blob/master/src/js/sw/index.js <-- current base

const VERSION = `v2`;
const THAUM_CACHE = `thaumcache-${VERSION}`;
const CONSOLE_STYLE = "background: #66023C; color: #fff; padding: 2px";

// This is run when a user visits the website for the first time
addEventListener("install", event => {
	console.info(`%csw.js: installing ${VERSION}`, CONSOLE_STYLE);

	event.waitUntil((async () => {
		const cache = await caches.open(THAUM_CACHE);

		await cache.addAll([
			// last updated: 2020-07-07
			"/",

			// Caching 404.html may break it - will need to test
			"/404.html",
			"/index.html",
			"/manifest.json",

			// Articles
			"/articles/index.html",
			"/articles/find-every-line-that-doesn-t-start-with-a-dot-via-regex.html",
			"/articles/find-non-ascii-letters-in-vscode.html",
			"/articles/find-the-nth-comma-via-regex.html",
			"/articles/haskells-fold-functions-explained.html",
			"/articles/quick-n-dirty-big-o.html",
			"/articles/spark-files-and-taking-notes.html",
			"/articles/splitting-js-css-into-2-or-3-files.html",
			"/articles/stache-open.svg",
			"/articles/types-of-haskell-functions.html",
			"/articles/gs-programming-projects-for-n00bz.html",
			"/articles/reddit-s-t-values.html",

			// general images
			"/images/big-o.png",
			"/images/binary-trees.png",
			"/images/clever.webp",
			"/images/favicon.svg",
			"/images/icons-192.png",
			"/images/icons-512.png",
			"/images/mockbob.png",
			"/images/starfield-thumb.webp",
			"/images/starfield.webp",
			"/images/logo.svg",
			"/images/border.png",
			"/images/wc1.png",
			"/images/wc2.png",
			"/images/wc3.png",
			"/images/wc4.png",
			"/images/wc5.png",
			"/images/conduct.webp",
			"/images/ko-fi-logo.svg",
			"/images/ko-fi-support.svg",

			// website pages
			"/about.html",
			"/experimentations.html",
			"/praetorianpi.html",
			"/projects.html",
			"/code-of-conduct.html",
			"/random-video.html",

			// Projects
			"/scripts/base64.mjs",
			"/scripts/mstg.mjs",
			"/scripts/rot13.mjs",
			"/scripts/slugify.mjs",
			"/scripts/starfield.mjs",

			// CSS
			"/styles/footer.css",
			"/styles/header.css",
			"/styles/layout.css",
			"/styles/main.css",
			"/styles/nav.css",
			"/styles/projects.css",
		]);
	})());
});

addEventListener('activate', event => {
	console.info(`%csw.js: ${VERSION} ready to handle fetches!`, CONSOLE_STYLE);
});

addEventListener('fetch', event => {
	const url = new URL(event.request.url);
	console.info(`%csw.js: fetching ${url}`, CONSOLE_STYLE);

	if (url.host == 'thaumatorium.com' || url.host == "127.0.0.1:5500") {
		fetch(event.request).then(async () => {
			const cache = await caches.open(THAUM_CACHE);
			await cache.add(url).then(() => {
				console.info(`%csw.js: ${url} has been re-added to cache`, CONSOLE_STYLE);
			});
		}).catch(error => {
			console.info(`%csw.js: can't fetch local ${url} with ${error}`, CONSOLE_STYLE);
		});
	}

	event.respondWith(caches.match(event.request)
		.then(r => r || fetch(event.request)
			.catch(error => {
				console.info(`%csw.js: can't fetch external ${url} with ${error}`, CONSOLE_STYLE);
			})
		)
	);
});
