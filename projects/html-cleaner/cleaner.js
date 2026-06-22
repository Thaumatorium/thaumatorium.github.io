const ALWAYS_REMOVE = ["script", "style", "noscript", "template", "iframe", "object", "embed", "canvas", "svg", "link", "meta", "base"];
const BOILERPLATE = ["nav", "aside", "footer", "form", "dialog", "[role='navigation']", "[role='complementary']", "[role='contentinfo']", "[role='banner']"];
const FORM_CONTROLS = ["input", "button", "select", "option", "textarea"];
const TABLE_ELEMENTS = new Set(["table", "caption", "colgroup", "col", "thead", "tbody", "tfoot", "tr", "th", "td"]);
const EMPTY_OK = new Set(["br", "hr"]);

export const PROFILES = Object.freeze({
	conservative: Object.freeze({
		stripAttributes: false,
		preserveLinks: true,
		preserveImageAlt: true,
		preserveTables: true,
		removeBoilerplate: false,
		removeEmpty: true,
		removeComments: true,
		collapseWhitespace: false,
		unwrapContainers: false,
	}),
	balanced: Object.freeze({
		stripAttributes: true,
		preserveLinks: true,
		preserveImageAlt: true,
		preserveTables: true,
		removeBoilerplate: true,
		removeEmpty: true,
		removeComments: true,
		collapseWhitespace: true,
		unwrapContainers: true,
	}),
	compact: Object.freeze({
		stripAttributes: true,
		preserveLinks: false,
		preserveImageAlt: false,
		preserveTables: false,
		removeBoilerplate: true,
		removeEmpty: true,
		removeComments: true,
		collapseWhitespace: true,
		unwrapContainers: true,
	}),
});

function isFullDocument(input) {
	return /<!doctype\s+html|<html(?:\s|>)/i.test(input) || (/<head(?:\s|>)/i.test(input) && /<body(?:\s|>)/i.test(input));
}

function selectContent(document, fullDocument) {
	if (!fullDocument) return document.body;
	const main = document.querySelector("main");
	if (main) return main;
	const article = [...document.querySelectorAll("article")].find((candidate) => (candidate.textContent || "").trim().length >= 200);
	return article || document.body;
}

function removeComments(root) {
	const document = root.ownerDocument;
	const walker = document.createTreeWalker(root, 128);
	const comments = [];
	while (walker.nextNode()) comments.push(walker.currentNode);
	comments.forEach((comment) => comment.remove());
}

function unwrap(element) {
	element.replaceWith(...element.childNodes);
}

function safeHref(value, baseUrl) {
	const trimmed = value.trim();
	if (!trimmed || trimmed.startsWith("#") || /^(mailto:|tel:)/i.test(trimmed)) return trimmed;
	if (/^(javascript:|data:|vbscript:|file:)/i.test(trimmed)) return null;
	if (!baseUrl) return trimmed;
	try {
		const resolved = new URL(trimmed, baseUrl);
		return resolved.protocol === "http:" || resolved.protocol === "https:" ? resolved.href : null;
	} catch {
		return null;
	}
}

function cleanAttributes(element, options, baseUrl) {
	const tag = element.localName;
	for (const attribute of [...element.attributes]) {
		const name = attribute.name.toLowerCase();
		const alwaysUnsafe = name.startsWith("on") || ["style", "class", "id", "srcdoc", "nonce", "integrity"].includes(name);
		const tableStructure = options.preserveTables && ["rowspan", "colspan"].includes(name) && (tag === "td" || tag === "th");
		const listStructure = (tag === "ol" && name === "start") || (tag === "li" && name === "value");
		const languageHint = tag === "code" && name === "data-language";
		if (name === "href" && tag === "a" && options.preserveLinks) {
			const href = safeHref(attribute.value, baseUrl);
			if (href === null) element.removeAttribute(name);
			else element.setAttribute("href", href);
			continue;
		}
		if (alwaysUnsafe || (options.stripAttributes && !tableStructure && !listStructure && !languageHint)) element.removeAttribute(name);
	}
}

function replaceImages(root, preserveAlt) {
	for (const image of [...root.querySelectorAll("img")]) {
		const alt = (image.getAttribute("alt") || "").replace(/\s+/g, " ").trim();
		if (preserveAlt && alt) image.replaceWith(image.ownerDocument.createTextNode(`[Image: ${alt}]`));
		else image.remove();
	}
}

function collapseWhitespace(root) {
	const document = root.ownerDocument;
	const walker = document.createTreeWalker(root, 4);
	const nodes = [];
	while (walker.nextNode()) nodes.push(walker.currentNode);
	for (const node of nodes) {
		if (node.parentElement?.closest("pre, code")) continue;
		let text = node.data.replace(/\s+/g, " ");
		const previous = node.previousSibling;
		const next = node.nextSibling;
		const startsAtBoundary = !previous || (previous.nodeType === 1 && BLOCK_TAGS.has(previous.tagName));
		const endsAtBoundary = !next || (next.nodeType === 1 && BLOCK_TAGS.has(next.tagName));
		if (startsAtBoundary) text = text.trimStart();
		if (endsAtBoundary) text = text.trimEnd();
		node.data = text;
	}
}

function trimElementBoundaryWhitespace(root) {
	const document = root.ownerDocument;
	const walker = document.createTreeWalker(root, 4);
	const textNodes = [];
	while (walker.nextNode()) textNodes.push(walker.currentNode);
	for (const node of textNodes) {
		if (node.parentElement?.closest("pre, code")) continue;
		if (!node.previousSibling || (node.previousSibling.nodeType === 1 && BLOCK_TAGS.has(node.previousSibling.tagName))) node.data = node.data.trimStart();
		if (!node.nextSibling || (node.nextSibling.nodeType === 1 && BLOCK_TAGS.has(node.nextSibling.tagName))) node.data = node.data.trimEnd();
	}
	for (const element of [root, ...root.querySelectorAll("*")]) {
		if (element.closest?.("pre, code")) continue;
		while (element.firstChild?.nodeType === 3) {
			element.firstChild.data = element.firstChild.data.trimStart();
			if (element.firstChild.data) break;
			element.firstChild.remove();
		}
		while (element.lastChild?.nodeType === 3) {
			element.lastChild.data = element.lastChild.data.trimEnd();
			if (element.lastChild.data) break;
			element.lastChild.remove();
		}
	}
}

function removeEmptyElements(root) {
	let changed = true;
	while (changed) {
		changed = false;
		for (const element of [...root.querySelectorAll("*")].reverse()) {
			if (EMPTY_OK.has(element.localName)) continue;
			if (!element.textContent?.trim() && element.children.length === 0) {
				element.remove();
				changed = true;
			}
		}
	}
}

function compactMarkup(html) {
	return html.replace(/>\s+</g, "><").replace(/^\s+|\s+$/g, "");
}

/** Check whether reparsing changes the structure of an HTML fragment. */
export function validateHtmlFragment(html) {
	if (!html.trim()) return { valid: true, repaired: false };
	const parse = (value) => {
		const document = new DOMParser().parseFromString(`<template id="validation-root">${value}</template>`, "text/html");
		return document.getElementById("validation-root").innerHTML;
	};
	const serialized = parse(html);
	const stable = serialized === parse(serialized);
	const repaired = compactMarkup(html) !== compactMarkup(serialized);
	return { valid: stable && !repaired, repaired };
}

const BLOCK_TAGS = new Set([
	"ADDRESS",
	"ARTICLE",
	"ASIDE",
	"BLOCKQUOTE",
	"BR",
	"BUTTON",
	"DETAILS",
	"DIV",
	"DL",
	"FIELDSET",
	"FIGCAPTION",
	"FIGURE",
	"FOOTER",
	"H1",
	"H2",
	"H3",
	"H4",
	"H5",
	"H6",
	"HEADER",
	"HGROUP",
	"HR",
	"LI",
	"MAIN",
	"MENU",
	"NAV",
	"OL",
	"P",
	"PRE",
	"SECTION",
	"SUMMARY",
	"TABLE",
	"TBODY",
	"TD",
	"TFOOT",
	"TH",
	"THEAD",
	"TR",
	"UL",
]);
const VOID_TAGS = new Set(["AREA", "BASE", "BR", "COL", "EMBED", "HR", "IMG", "INPUT", "LINK", "META", "PARAM", "SOURCE", "TRACK", "WBR"]);

function serializeFormatted(node, depth) {
	if (node.nodeType === 3) return node.data;
	if (node.nodeType !== 1) return "";
	const indent = "\t".repeat(depth);
	const opening = node.cloneNode(false).outerHTML;
	const closingIndex = opening.lastIndexOf("</");
	const openingTag = closingIndex >= 0 ? opening.slice(0, closingIndex) : opening;
	if (VOID_TAGS.has(node.tagName)) return `${indent}${openingTag}`;
	if (node.matches("pre, code") || !BLOCK_TAGS.has(node.tagName)) return `${indent}${node.outerHTML}`;
	const children = [...node.childNodes];
	const hasBlockChild = children.some((child) => child.nodeType === 1 && BLOCK_TAGS.has(child.tagName));
	if (!hasBlockChild) return `${indent}${openingTag}${children.map((child) => serializeFormatted(child, 0)).join("")}</${node.localName}>`;
	const body = children
		.map((child) => serializeFormatted(child, depth + 1).trimEnd())
		.filter(Boolean)
		.join("\n");
	return `${indent}${openingTag}\n${body}\n${indent}</${node.localName}>`;
}

/** Format a cleaned HTML fragment without changing its semantic content. */
export function formatHtml(html) {
	if (!html.trim()) return "";
	const document = new DOMParser().parseFromString(`<template id="formatted-root">${html}</template>`, "text/html");
	const root = document.getElementById("formatted-root").content;
	return [...root.childNodes]
		.map((node) => serializeFormatted(node, 0).trim())
		.filter(Boolean)
		.join("\n");
}

/**
 * Clean a full HTML document or fragment without mutating the input.
 * @param {string} input
 * @param {Partial<(typeof PROFILES)["balanced"]>} options
 * @param {string | null} baseUrl
 * @returns {{html: string, warnings: string[], stats: {inputCharacters: number, outputCharacters: number, characterReduction: number, inputElements: number, outputElements: number, elementsRemoved: number}}}
 */
export function cleanHtml(input, options = {}, baseUrl = null) {
	if (typeof input !== "string") throw new TypeError("HTML input must be a string.");
	const settings = { ...PROFILES.balanced, ...options };
	const warnings = [];
	if (!input.trim()) return { html: "", warnings, stats: { inputCharacters: input.length, outputCharacters: 0, characterReduction: 0, inputElements: 0, outputElements: 0, elementsRemoved: 0 } };

	const parser = new DOMParser();
	const document = parser.parseFromString(input, "text/html");
	const fullDocument = isFullDocument(input);
	const inputElements = (fullDocument ? document : document.body).querySelectorAll("*").length;
	const source = selectContent(document, fullDocument);
	const root = document.createElement("div");
	root.append(...[...source.childNodes].map((node) => node.cloneNode(true)));

	root.querySelectorAll(ALWAYS_REMOVE.join(",")).forEach((element) => element.remove());
	root.querySelectorAll("[hidden], [aria-hidden='true']").forEach((element) => element.remove());
	if (settings.removeBoilerplate) root.querySelectorAll(BOILERPLATE.join(",")).forEach((element) => element.remove());
	else root.querySelectorAll(FORM_CONTROLS.join(",")).forEach((element) => element.remove());
	if (settings.removeComments) removeComments(root);

	replaceImages(root, settings.preserveImageAlt);
	if (!settings.preserveLinks) root.querySelectorAll("a").forEach(unwrap);
	if (!settings.preserveTables) root.querySelectorAll([...TABLE_ELEMENTS].join(",")).forEach(unwrap);
	if (settings.unwrapContainers) root.querySelectorAll("div, span").forEach(unwrap);
	root.normalize();

	root.querySelectorAll("*").forEach((element) => cleanAttributes(element, settings, baseUrl));
	if (settings.collapseWhitespace) collapseWhitespace(root);
	trimElementBoundaryWhitespace(root);
	if (settings.removeEmpty) removeEmptyElements(root);

	const html = settings.collapseWhitespace ? compactMarkup(root.innerHTML) : root.innerHTML.trim();
	const outputElements = root.querySelectorAll("*").length;
	const characterReduction = input.length ? Math.max(0, ((input.length - html.length) / input.length) * 100) : 0;
	if (!html && input.trim()) warnings.push("Cleaning removed all content. Try the Conservative profile.");
	return { html, warnings, stats: { inputCharacters: input.length, outputCharacters: html.length, characterReduction, inputElements, outputElements, elementsRemoved: Math.max(0, inputElements - outputElements) } };
}
