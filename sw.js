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
			// this list is sometimes half-assed updated for a potential 'return of the king'
			// last updated: 2020-08-16
			"/",

			// Caching 404.html may break it - will need to test
			"/404.html",
			"/index.html",
			"/manifest.json",

			// Articles
			"/articles/index.html",
			"/articles/find-every-line-that-doesn-t-start-with-a-dot-via-regex/index.html",
			"/articles/find-non-ascii-letters-in-vscode/index.html",
			"/articles/find-the-nth-comma-via-regex/index.html",
			"/articles/haskells-fold-functions-explained/index.html",
			"/articles/big-o-beginners-guide/index.html",
			"/articles/spark-files-and-keeping-track-of-your-ideas-concepts-thoughts/index.html",
			"/articles/splitting-js-css-into-2-or-3-files/index.html",
			"/articles/stache-open.svg",
			"/articles/the-different-types-of-functions-in-functional-programming/index.html",
			"/articles/4chans-programming-projects-for-noobs/index.html",
			"/articles/reddit-s-t-values/index.html",

			// general images
			"/images/big-o.png",
			"/images/binary-trees.png",
			"/images/clever.webp",
			"/images/favicon.svg",
			"/images/icons-192.png",
			"/images/icons-512.png",
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
			"/about/index.html",
			"/experimentations/index.html",
			"/praetorianpi/index.html",
			"/projects/index.html",
			"/code-of-conduct/index.html",
			"/random-video/index.html",

			// Projects
			"/scripts/slugify.mjs",
			"/scripts/starfield.mjs",
			"/scripts/t2e.mjs",

			// CSS
			"/styles/main.css",
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
