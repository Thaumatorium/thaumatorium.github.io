/*
  Highlight.js 10.1.2 (edd73d24)
  License: BSD-3-Clause
  Copyright (c) 2006-2020, Ivan Sagalaev
*/
var hljs = (function () {
	"use strict";
	function e(n) {
		Object.freeze(n);
		var t = "function" == typeof n;
		return (
			Object.getOwnPropertyNames(n).forEach(function (r) {
				!Object.hasOwnProperty.call(n, r) || null === n[r] || ("object" != typeof n[r] && "function" != typeof n[r]) || (t && ("caller" === r || "callee" === r || "arguments" === r)) || Object.isFrozen(n[r]) || e(n[r]);
			}),
			n
		);
	}
	class n {
		constructor(e) {
			void 0 === e.data && (e.data = {}), (this.data = e.data);
		}
		ignoreMatch() {
			this.ignore = !0;
		}
	}
	function t(e) {
		return e.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
	}
	function r(e, ...n) {
		var t = {};
		for (const n in e) t[n] = e[n];
		return (
			n.forEach(function (e) {
				for (const n in e) t[n] = e[n];
			}),
			t
		);
	}
	function a(e) {
		return e.nodeName.toLowerCase();
	}
	var i = Object.freeze({
		__proto__: null,
		escapeHTML: t,
		inherit: r,
		nodeStream: function (e) {
			var n = [];
			return (
				(function e(t, r) {
					for (var i = t.firstChild; i; i = i.nextSibling) 3 === i.nodeType ? (r += i.nodeValue.length) : 1 === i.nodeType && (n.push({ event: "start", offset: r, node: i }), (r = e(i, r)), a(i).match(/br|hr|img|input/) || n.push({ event: "stop", offset: r, node: i }));
					return r;
				})(e, 0),
				n
			);
		},
		mergeStreams: function (e, n, r) {
			var i = 0,
				s = "",
				o = [];
			function l() {
				return e.length && n.length ? (e[0].offset !== n[0].offset ? (e[0].offset < n[0].offset ? e : n) : "start" === n[0].event ? e : n) : e.length ? e : n;
			}
			function c(e) {
				s +=
					"<" +
					a(e) +
					[].map
						.call(e.attributes, function (e) {
							return " " + e.nodeName + '="' + t(e.value) + '"';
						})
						.join("") +
					">";
			}
			function u(e) {
				s += "</" + a(e) + ">";
			}
			function d(e) {
				("start" === e.event ? c : u)(e.node);
			}
			for (; e.length || n.length; ) {
				var g = l();
				if (((s += t(r.substring(i, g[0].offset))), (i = g[0].offset), g === e)) {
					o.reverse().forEach(u);
					do {
						d(g.splice(0, 1)[0]), (g = l());
					} while (g === e && g.length && g[0].offset === i);
					o.reverse().forEach(c);
				} else "start" === g[0].event ? o.push(g[0].node) : o.pop(), d(g.splice(0, 1)[0]);
			}
			return s + t(r.substr(i));
		},
	});
	const s = "</span>",
		o = (e) => !!e.kind;
	class l {
		constructor(e, n) {
			(this.buffer = ""), (this.classPrefix = n.classPrefix), e.walk(this);
		}
		addText(e) {
			this.buffer += t(e);
		}
		openNode(e) {
			if (!o(e)) return;
			let n = e.kind;
			e.sublanguage || (n = `${this.classPrefix}${n}`), this.span(n);
		}
		closeNode(e) {
			o(e) && (this.buffer += s);
		}
		value() {
			return this.buffer;
		}
		span(e) {
			this.buffer += `<span class="${e}">`;
		}
	}
	class c {
		constructor() {
			(this.rootNode = { children: [] }), (this.stack = [this.rootNode]);
		}
		get top() {
			return this.stack[this.stack.length - 1];
		}
		get root() {
			return this.rootNode;
		}
		add(e) {
			this.top.children.push(e);
		}
		openNode(e) {
			const n = { kind: e, children: [] };
			this.add(n), this.stack.push(n);
		}
		closeNode() {
			if (this.stack.length > 1) return this.stack.pop();
		}
		closeAllNodes() {
			for (; this.closeNode(); );
		}
		toJSON() {
			return JSON.stringify(this.rootNode, null, 4);
		}
		walk(e) {
			return this.constructor._walk(e, this.rootNode);
		}
		static _walk(e, n) {
			return "string" == typeof n ? e.addText(n) : n.children && (e.openNode(n), n.children.forEach((n) => this._walk(e, n)), e.closeNode(n)), e;
		}
		static _collapse(e) {
			"string" != typeof e &&
				e.children &&
				(e.children.every((e) => "string" == typeof e)
					? (e.children = [e.children.join("")])
					: e.children.forEach((e) => {
							c._collapse(e);
						}));
		}
	}
	class u extends c {
		constructor(e) {
			super(), (this.options = e);
		}
		addKeyword(e, n) {
			"" !== e && (this.openNode(n), this.addText(e), this.closeNode());
		}
		addText(e) {
			"" !== e && this.add(e);
		}
		addSublanguage(e, n) {
			const t = e.root;
			(t.kind = n), (t.sublanguage = !0), this.add(t);
		}
		toHTML() {
			return new l(this, this.options).value();
		}
		finalize() {
			return !0;
		}
	}
	function d(e) {
		return e ? ("string" == typeof e ? e : e.source) : null;
	}
	const g = "(-?)(\\b0[xX][a-fA-F0-9]+|(\\b\\d+(\\.\\d*)?|\\.\\d+)([eE][-+]?\\d+)?)",
		h = { begin: "\\\\[\\s\\S]", relevance: 0 },
		f = { className: "string", begin: "'", end: "'", illegal: "\\n", contains: [h] },
		p = { className: "string", begin: '"', end: '"', illegal: "\\n", contains: [h] },
		b = { begin: /\b(a|an|the|are|I'm|isn't|don't|doesn't|won't|but|just|should|pretty|simply|enough|gonna|going|wtf|so|such|will|you|your|they|like|more)\b/ },
		m = function (e, n, t = {}) {
			var a = r({ className: "comment", begin: e, end: n, contains: [] }, t);
			return a.contains.push(b), a.contains.push({ className: "doctag", begin: "(?:TODO|FIXME|NOTE|BUG|OPTIMIZE|HACK|XXX):", relevance: 0 }), a;
		},
		v = m("//", "$"),
		x = m("/\\*", "\\*/"),
		E = m("#", "$");
	var _ = Object.freeze({
			__proto__: null,
			IDENT_RE: "[a-zA-Z]\\w*",
			UNDERSCORE_IDENT_RE: "[a-zA-Z_]\\w*",
			NUMBER_RE: "\\b\\d+(\\.\\d+)?",
			C_NUMBER_RE: g,
			BINARY_NUMBER_RE: "\\b(0b[01]+)",
			RE_STARTERS_RE: "!|!=|!==|%|%=|&|&&|&=|\\*|\\*=|\\+|\\+=|,|-|-=|/=|/|:|;|<<|<<=|<=|<|===|==|=|>>>=|>>=|>=|>>>|>>|>|\\?|\\[|\\{|\\(|\\^|\\^=|\\||\\|=|\\|\\||~",
			SHEBANG: (e = {}) => {
				const n = /^#![ ]*\//;
				return (
					e.binary &&
						(e.begin = (function (...e) {
							return e.map((e) => d(e)).join("");
						})(n, /.*\b/, e.binary, /\b.*/)),
					r(
						{
							className: "meta",
							begin: n,
							end: /$/,
							relevance: 0,
							"on:begin": (e, n) => {
								0 !== e.index && n.ignoreMatch();
							},
						},
						e
					)
				);
			},
			BACKSLASH_ESCAPE: h,
			APOS_STRING_MODE: f,
			QUOTE_STRING_MODE: p,
			PHRASAL_WORDS_MODE: b,
			COMMENT: m,
			C_LINE_COMMENT_MODE: v,
			C_BLOCK_COMMENT_MODE: x,
			HASH_COMMENT_MODE: E,
			NUMBER_MODE: { className: "number", begin: "\\b\\d+(\\.\\d+)?", relevance: 0 },
			C_NUMBER_MODE: { className: "number", begin: g, relevance: 0 },
			BINARY_NUMBER_MODE: { className: "number", begin: "\\b(0b[01]+)", relevance: 0 },
			CSS_NUMBER_MODE: { className: "number", begin: "\\b\\d+(\\.\\d+)?(%|em|ex|ch|rem|vw|vh|vmin|vmax|cm|mm|in|pt|pc|px|deg|grad|rad|turn|s|ms|Hz|kHz|dpi|dpcm|dppx)?", relevance: 0 },
			REGEXP_MODE: { begin: /(?=\/[^/\n]*\/)/, contains: [{ className: "regexp", begin: /\//, end: /\/[gimuy]*/, illegal: /\n/, contains: [h, { begin: /\[/, end: /\]/, relevance: 0, contains: [h] }] }] },
			TITLE_MODE: { className: "title", begin: "[a-zA-Z]\\w*", relevance: 0 },
			UNDERSCORE_TITLE_MODE: { className: "title", begin: "[a-zA-Z_]\\w*", relevance: 0 },
			METHOD_GUARD: { begin: "\\.\\s*[a-zA-Z_]\\w*", relevance: 0 },
			END_SAME_AS_BEGIN: function (e) {
				return Object.assign(e, {
					"on:begin": (e, n) => {
						n.data._beginMatch = e[1];
					},
					"on:end": (e, n) => {
						n.data._beginMatch !== e[1] && n.ignoreMatch();
					},
				});
			},
		}),
		N = "of and for in not or if then".split(" ");
	function w(e, n) {
		return n
			? +n
			: (function (e) {
						return N.includes(e.toLowerCase());
				  })(e)
				? 0
				: 1;
	}
	const R = t,
		y = r,
		{ nodeStream: O, mergeStreams: k } = i,
		M = Symbol("nomatch");
	return (function (t) {
		var a = [],
			i = Object.create(null),
			s = Object.create(null),
			o = [],
			l = !0,
			c = /(^(<[^>]+>|\t|)+|\n)/gm,
			g = "Could not find the language '{}', did you forget to load/include a language module?";
		const h = { disableAutodetect: !0, name: "Plain text", contains: [] };
		var f = { noHighlightRe: /^(no-?highlight)$/i, languageDetectRe: /\blang(?:uage)?-([\w-]+)\b/i, classPrefix: "hljs-", tabReplace: null, useBR: !1, languages: null, __emitter: u };
		function p(e) {
			return f.noHighlightRe.test(e);
		}
		function b(e, n, t, r) {
			var a = { code: n, language: e };
			S("before:highlight", a);
			var i = a.result ? a.result : m(a.language, a.code, t, r);
			return (i.code = a.code), S("after:highlight", i), i;
		}
		function m(e, t, a, s) {
			var o = t;
			function c(e, n) {
				var t = E.case_insensitive ? n[0].toLowerCase() : n[0];
				return Object.prototype.hasOwnProperty.call(e.keywords, t) && e.keywords[t];
			}
			function u() {
				null != y.subLanguage
					? (function () {
							if ("" !== A) {
								var e = null;
								if ("string" == typeof y.subLanguage) {
									if (!i[y.subLanguage]) return void k.addText(A);
									(e = m(y.subLanguage, A, !0, O[y.subLanguage])), (O[y.subLanguage] = e.top);
								} else e = v(A, y.subLanguage.length ? y.subLanguage : null);
								y.relevance > 0 && (I += e.relevance), k.addSublanguage(e.emitter, e.language);
							}
						})()
					: (function () {
							if (!y.keywords) return void k.addText(A);
							let e = 0;
							y.keywordPatternRe.lastIndex = 0;
							let n = y.keywordPatternRe.exec(A),
								t = "";
							for (; n; ) {
								t += A.substring(e, n.index);
								const r = c(y, n);
								if (r) {
									const [e, a] = r;
									k.addText(t), (t = ""), (I += a), k.addKeyword(n[0], e);
								} else t += n[0];
								(e = y.keywordPatternRe.lastIndex), (n = y.keywordPatternRe.exec(A));
							}
							(t += A.substr(e)), k.addText(t);
						})(),
					(A = "");
			}
			function h(e) {
				return e.className && k.openNode(e.className), (y = Object.create(e, { parent: { value: y } }));
			}
			function p(e) {
				return 0 === y.matcher.regexIndex ? ((A += e[0]), 1) : ((L = !0), 0);
			}
			var b = {};
			function x(t, r) {
				var i = r && r[0];
				if (((A += t), null == i)) return u(), 0;
				if ("begin" === b.type && "end" === r.type && b.index === r.index && "" === i) {
					if (((A += o.slice(r.index, r.index + 1)), !l)) {
						const n = Error("0 width match regex");
						throw ((n.languageName = e), (n.badRule = b.rule), n);
					}
					return 1;
				}
				if (((b = r), "begin" === r.type))
					return (function (e) {
						var t = e[0],
							r = e.rule;
						const a = new n(r),
							i = [r.__beforeBegin, r["on:begin"]];
						for (const n of i) if (n && (n(e, a), a.ignore)) return p(t);
						return r && r.endSameAsBegin && (r.endRe = RegExp(t.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), "m")), r.skip ? (A += t) : (r.excludeBegin && (A += t), u(), r.returnBegin || r.excludeBegin || (A = t)), h(r), r.returnBegin ? 0 : t.length;
					})(r);
				if ("illegal" === r.type && !a) {
					const e = Error('Illegal lexeme "' + i + '" for mode "' + (y.className || "<unnamed>") + '"');
					throw ((e.mode = y), e);
				}
				if ("end" === r.type) {
					var s = (function (e) {
						var t = e[0],
							r = o.substr(e.index),
							a = (function e(t, r, a) {
								let i = (function (e, n) {
									var t = e && e.exec(n);
									return t && 0 === t.index;
								})(t.endRe, a);
								if (i) {
									if (t["on:end"]) {
										const e = new n(t);
										t["on:end"](r, e), e.ignore && (i = !1);
									}
									if (i) {
										for (; t.endsParent && t.parent; ) t = t.parent;
										return t;
									}
								}
								if (t.endsWithParent) return e(t.parent, r, a);
							})(y, e, r);
						if (!a) return M;
						var i = y;
						i.skip ? (A += t) : (i.returnEnd || i.excludeEnd || (A += t), u(), i.excludeEnd && (A = t));
						do {
							y.className && k.closeNode(), y.skip || y.subLanguage || (I += y.relevance), (y = y.parent);
						} while (y !== a.parent);
						return a.starts && (a.endSameAsBegin && (a.starts.endRe = a.endRe), h(a.starts)), i.returnEnd ? 0 : t.length;
					})(r);
					if (s !== M) return s;
				}
				if ("illegal" === r.type && "" === i) return 1;
				if (B > 1e5 && B > 3 * r.index) throw Error("potential infinite loop, way more iterations than matches");
				return (A += i), i.length;
			}
			var E = T(e);
			if (!E) throw (console.error(g.replace("{}", e)), Error('Unknown language: "' + e + '"'));
			var _ = (function (e) {
					function n(n, t) {
						return RegExp(d(n), "m" + (e.case_insensitive ? "i" : "") + (t ? "g" : ""));
					}
					class t {
						constructor() {
							(this.matchIndexes = {}), (this.regexes = []), (this.matchAt = 1), (this.position = 0);
						}
						addRule(e, n) {
							(n.position = this.position++),
								(this.matchIndexes[this.matchAt] = n),
								this.regexes.push([n, e]),
								(this.matchAt +=
									(function (e) {
										return RegExp(e.toString() + "|").exec("").length - 1;
									})(e) + 1);
						}
						compile() {
							0 === this.regexes.length && (this.exec = () => null);
							const e = this.regexes.map((e) => e[1]);
							(this.matcherRe = n(
								(function (e, n = "|") {
									for (var t = /\[(?:[^\\\]]|\\.)*\]|\(\??|\\([1-9][0-9]*)|\\./, r = 0, a = "", i = 0; i < e.length; i++) {
										var s = (r += 1),
											o = d(e[i]);
										for (i > 0 && (a += n), a += "("; o.length > 0; ) {
											var l = t.exec(o);
											if (null == l) {
												a += o;
												break;
											}
											(a += o.substring(0, l.index)), (o = o.substring(l.index + l[0].length)), "\\" === l[0][0] && l[1] ? (a += "\\" + (+l[1] + s)) : ((a += l[0]), "(" === l[0] && r++);
										}
										a += ")";
									}
									return a;
								})(e),
								!0
							)),
								(this.lastIndex = 0);
						}
						exec(e) {
							this.matcherRe.lastIndex = this.lastIndex;
							const n = this.matcherRe.exec(e);
							if (!n) return null;
							const t = n.findIndex((e, n) => n > 0 && void 0 !== e),
								r = this.matchIndexes[t];
							return n.splice(0, t), Object.assign(n, r);
						}
					}
					class a {
						constructor() {
							(this.rules = []), (this.multiRegexes = []), (this.count = 0), (this.lastIndex = 0), (this.regexIndex = 0);
						}
						getMatcher(e) {
							if (this.multiRegexes[e]) return this.multiRegexes[e];
							const n = new t();
							return this.rules.slice(e).forEach(([e, t]) => n.addRule(e, t)), n.compile(), (this.multiRegexes[e] = n), n;
						}
						considerAll() {
							this.regexIndex = 0;
						}
						addRule(e, n) {
							this.rules.push([e, n]), "begin" === n.type && this.count++;
						}
						exec(e) {
							const n = this.getMatcher(this.regexIndex);
							n.lastIndex = this.lastIndex;
							const t = n.exec(e);
							return t && ((this.regexIndex += t.position + 1), this.regexIndex === this.count && (this.regexIndex = 0)), t;
						}
					}
					function i(e, n) {
						const t = e.input[e.index - 1],
							r = e.input[e.index + e[0].length];
						("." !== t && "." !== r) || n.ignoreMatch();
					}
					if (e.contains && e.contains.includes("self")) throw Error("ERR: contains `self` is not supported at the top-level of a language.  See documentation.");
					return (function t(s, o) {
						const l = s;
						if (s.compiled) return l;
						(s.compiled = !0), (s.__beforeBegin = null), (s.keywords = s.keywords || s.beginKeywords);
						let c = null;
						if (
							("object" == typeof s.keywords && ((c = s.keywords.$pattern), delete s.keywords.$pattern),
							s.keywords &&
								(s.keywords = (function (e, n) {
									var t = {};
									return (
										"string" == typeof e
											? r("keyword", e)
											: Object.keys(e).forEach(function (n) {
													r(n, e[n]);
												}),
										t
									);
									function r(e, r) {
										n && (r = r.toLowerCase()),
											r.split(" ").forEach(function (n) {
												var r = n.split("|");
												t[r[0]] = [e, w(r[0], r[1])];
											});
									}
								})(s.keywords, e.case_insensitive)),
							s.lexemes && c)
						)
							throw Error("ERR: Prefer `keywords.$pattern` to `mode.lexemes`, BOTH are not allowed. (see mode reference) ");
						return (
							(l.keywordPatternRe = n(s.lexemes || c || /\w+/, !0)),
							o && (s.beginKeywords && ((s.begin = "\\b(" + s.beginKeywords.split(" ").join("|") + ")(?=\\b|\\s)"), (s.__beforeBegin = i)), s.begin || (s.begin = /\B|\b/), (l.beginRe = n(s.begin)), s.endSameAsBegin && (s.end = s.begin), s.end || s.endsWithParent || (s.end = /\B|\b/), s.end && (l.endRe = n(s.end)), (l.terminator_end = d(s.end) || ""), s.endsWithParent && o.terminator_end && (l.terminator_end += (s.end ? "|" : "") + o.terminator_end)),
							s.illegal && (l.illegalRe = n(s.illegal)),
							void 0 === s.relevance && (s.relevance = 1),
							s.contains || (s.contains = []),
							(s.contains = [].concat(
								...s.contains.map(function (e) {
									return (function (e) {
										return (
											e.variants &&
												!e.cached_variants &&
												(e.cached_variants = e.variants.map(function (n) {
													return r(e, { variants: null }, n);
												})),
											e.cached_variants
												? e.cached_variants
												: (function e(n) {
															return !!n && (n.endsWithParent || e(n.starts));
													  })(e)
													? r(e, { starts: e.starts ? r(e.starts) : null })
													: Object.isFrozen(e)
														? r(e)
														: e
										);
									})("self" === e ? s : e);
								})
							)),
							s.contains.forEach(function (e) {
								t(e, l);
							}),
							s.starts && t(s.starts, o),
							(l.matcher = (function (e) {
								const n = new a();
								return e.contains.forEach((e) => n.addRule(e.begin, { rule: e, type: "begin" })), e.terminator_end && n.addRule(e.terminator_end, { type: "end" }), e.illegal && n.addRule(e.illegal, { type: "illegal" }), n;
							})(l)),
							l
						);
					})(e);
				})(E),
				N = "",
				y = s || _,
				O = {},
				k = new f.__emitter(f);
			!(function () {
				for (var e = [], n = y; n !== E; n = n.parent) n.className && e.unshift(n.className);
				e.forEach((e) => k.openNode(e));
			})();
			var A = "",
				I = 0,
				S = 0,
				B = 0,
				L = !1;
			try {
				for (y.matcher.considerAll(); ; ) {
					B++, L ? (L = !1) : ((y.matcher.lastIndex = S), y.matcher.considerAll());
					const e = y.matcher.exec(o);
					if (!e) break;
					const n = x(o.substring(S, e.index), e);
					S = e.index + n;
				}
				return x(o.substr(S)), k.closeAllNodes(), k.finalize(), (N = k.toHTML()), { relevance: I, value: N, language: e, illegal: !1, emitter: k, top: y };
			} catch (n) {
				if (n.message && n.message.includes("Illegal")) return { illegal: !0, illegalBy: { msg: n.message, context: o.slice(S - 100, S + 100), mode: n.mode }, sofar: N, relevance: 0, value: R(o), emitter: k };
				if (l) return { illegal: !1, relevance: 0, value: R(o), emitter: k, language: e, top: y, errorRaised: n };
				throw n;
			}
		}
		function v(e, n) {
			n = n || f.languages || Object.keys(i);
			var t = (function (e) {
					const n = { relevance: 0, emitter: new f.__emitter(f), value: R(e), illegal: !1, top: h };
					return n.emitter.addText(e), n;
				})(e),
				r = t;
			return (
				n
					.filter(T)
					.filter(I)
					.forEach(function (n) {
						var a = m(n, e, !1);
						(a.language = n), a.relevance > r.relevance && (r = a), a.relevance > t.relevance && ((r = t), (t = a));
					}),
				r.language && (t.second_best = r),
				t
			);
		}
		function x(e) {
			return f.tabReplace || f.useBR ? e.replace(c, (e) => ("\n" === e ? (f.useBR ? "<br>" : e) : f.tabReplace ? e.replace(/\t/g, f.tabReplace) : e)) : e;
		}
		function E(e) {
			let n = null;
			const t = (function (e) {
				var n = e.className + " ";
				n += e.parentNode ? e.parentNode.className : "";
				const t = f.languageDetectRe.exec(n);
				if (t) {
					var r = T(t[1]);
					return r || (console.warn(g.replace("{}", t[1])), console.warn("Falling back to no-highlight mode for this block.", e)), r ? t[1] : "no-highlight";
				}
				return n.split(/\s+/).find((e) => p(e) || T(e));
			})(e);
			if (p(t)) return;
			S("before:highlightBlock", { block: e, language: t }), f.useBR ? ((n = document.createElement("div")).innerHTML = e.innerHTML.replace(/\n/g, "").replace(/<br[ /]*>/g, "\n")) : (n = e);
			const r = n.textContent,
				a = t ? b(t, r, !0) : v(r),
				i = O(n);
			if (i.length) {
				const e = document.createElement("div");
				(e.innerHTML = a.value), (a.value = k(i, O(e), r));
			}
			(a.value = x(a.value)),
				S("after:highlightBlock", { block: e, result: a }),
				(e.innerHTML = a.value),
				(e.className = (function (e, n, t) {
					var r = n ? s[n] : t,
						a = [e.trim()];
					return e.match(/\bhljs\b/) || a.push("hljs"), e.includes(r) || a.push(r), a.join(" ").trim();
				})(e.className, t, a.language)),
				(e.result = { language: a.language, re: a.relevance, relavance: a.relevance }),
				a.second_best && (e.second_best = { language: a.second_best.language, re: a.second_best.relevance, relavance: a.second_best.relevance });
		}
		const N = () => {
			if (!N.called) {
				N.called = !0;
				var e = document.querySelectorAll("pre code");
				a.forEach.call(e, E);
			}
		};
		function T(e) {
			return (e = (e || "").toLowerCase()), i[e] || i[s[e]];
		}
		function A(e, { languageName: n }) {
			"string" == typeof e && (e = [e]),
				e.forEach((e) => {
					s[e] = n;
				});
		}
		function I(e) {
			var n = T(e);
			return n && !n.disableAutodetect;
		}
		function S(e, n) {
			var t = e;
			o.forEach(function (e) {
				e[t] && e[t](n);
			});
		}
		Object.assign(t, {
			highlight: b,
			highlightAuto: v,
			fixMarkup: x,
			highlightBlock: E,
			configure: function (e) {
				f = y(f, e);
			},
			initHighlighting: N,
			initHighlightingOnLoad: function () {
				window.addEventListener("DOMContentLoaded", N, !1);
			},
			registerLanguage: function (e, n) {
				var r = null;
				try {
					r = n(t);
				} catch (n) {
					if ((console.error("Language definition for '{}' could not be registered.".replace("{}", e)), !l)) throw n;
					console.error(n), (r = h);
				}
				r.name || (r.name = e), (i[e] = r), (r.rawDefinition = n.bind(null, t)), r.aliases && A(r.aliases, { languageName: e });
			},
			listLanguages: function () {
				return Object.keys(i);
			},
			getLanguage: T,
			registerAliases: A,
			requireLanguage: function (e) {
				var n = T(e);
				if (n) return n;
				throw Error("The '{}' language is required, but not loaded.".replace("{}", e));
			},
			autoDetection: I,
			inherit: y,
			addPlugin: function (e) {
				o.push(e);
			},
		}),
			(t.debugMode = function () {
				l = !1;
			}),
			(t.safeMode = function () {
				l = !0;
			}),
			(t.versionString = "10.1.2");
		for (const n in _) "object" == typeof _[n] && e(_[n]);
		return Object.assign(t, _), t;
	})({});
})();
"object" == typeof exports && "undefined" != typeof module && (module.exports = hljs);
hljs.registerLanguage(
	"javascript",
	(function () {
		"use strict";
		const e = ["as", "in", "of", "if", "for", "while", "finally", "var", "new", "function", "do", "return", "void", "else", "break", "catch", "instanceof", "with", "throw", "case", "default", "try", "switch", "continue", "typeof", "delete", "let", "yield", "const", "class", "debugger", "async", "await", "static", "import", "from", "export", "extends"],
			n = ["true", "false", "null", "undefined", "NaN", "Infinity"],
			a = [].concat(["setInterval", "setTimeout", "clearInterval", "clearTimeout", "require", "exports", "eval", "isFinite", "isNaN", "parseFloat", "parseInt", "decodeURI", "decodeURIComponent", "encodeURI", "encodeURIComponent", "escape", "unescape"], ["arguments", "this", "super", "console", "window", "document", "localStorage", "module", "global"], ["Intl", "DataView", "Number", "Math", "Date", "String", "RegExp", "Object", "Function", "Boolean", "Error", "Symbol", "Set", "Map", "WeakSet", "WeakMap", "Proxy", "Reflect", "JSON", "Promise", "Float64Array", "Int16Array", "Int32Array", "Int8Array", "Uint16Array", "Uint32Array", "Float32Array", "Array", "Uint8Array", "Uint8ClampedArray", "ArrayBuffer"], ["EvalError", "InternalError", "RangeError", "ReferenceError", "SyntaxError", "TypeError", "URIError"]);
		function s(e) {
			return r("(?=", e, ")");
		}
		function r(...e) {
			return e
				.map((e) =>
					(function (e) {
						return e ? ("string" == typeof e ? e : e.source) : null;
					})(e)
				)
				.join("");
		}
		return function (t) {
			var i = "[A-Za-z$_][0-9A-Za-z$_]*",
				c = { begin: /<[A-Za-z0-9\\._:-]+/, end: /\/[A-Za-z0-9\\._:-]+>|\/>/ },
				o = { $pattern: "[A-Za-z$_][0-9A-Za-z$_]*", keyword: e.join(" "), literal: n.join(" "), built_in: a.join(" ") },
				l = { className: "number", variants: [{ begin: "\\b(0[bB][01]+)n?" }, { begin: "\\b(0[oO][0-7]+)n?" }, { begin: t.C_NUMBER_RE + "n?" }], relevance: 0 },
				E = { className: "subst", begin: "\\$\\{", end: "\\}", keywords: o, contains: [] },
				d = { begin: "html`", end: "", starts: { end: "`", returnEnd: !1, contains: [t.BACKSLASH_ESCAPE, E], subLanguage: "xml" } },
				g = { begin: "css`", end: "", starts: { end: "`", returnEnd: !1, contains: [t.BACKSLASH_ESCAPE, E], subLanguage: "css" } },
				u = { className: "string", begin: "`", end: "`", contains: [t.BACKSLASH_ESCAPE, E] };
			E.contains = [t.APOS_STRING_MODE, t.QUOTE_STRING_MODE, d, g, u, l, t.REGEXP_MODE];
			var b = E.contains.concat([{ begin: /\(/, end: /\)/, contains: ["self"].concat(E.contains, [t.C_BLOCK_COMMENT_MODE, t.C_LINE_COMMENT_MODE]) }, t.C_BLOCK_COMMENT_MODE, t.C_LINE_COMMENT_MODE]),
				_ = { className: "params", begin: /\(/, end: /\)/, excludeBegin: !0, excludeEnd: !0, contains: b };
			return {
				name: "JavaScript",
				aliases: ["js", "jsx", "mjs", "cjs"],
				keywords: o,
				contains: [
					t.SHEBANG({ binary: "node", relevance: 5 }),
					{ className: "meta", relevance: 10, begin: /^\s*['"]use (strict|asm)['"]/ },
					t.APOS_STRING_MODE,
					t.QUOTE_STRING_MODE,
					d,
					g,
					u,
					t.C_LINE_COMMENT_MODE,
					t.COMMENT("/\\*\\*", "\\*/", {
						relevance: 0,
						contains: [
							{
								className: "doctag",
								begin: "@[A-Za-z]+",
								contains: [
									{ className: "type", begin: "\\{", end: "\\}", relevance: 0 },
									{ className: "variable", begin: i + "(?=\\s*(-)|$)", endsParent: !0, relevance: 0 },
									{ begin: /(?=[^\n])\s/, relevance: 0 },
								],
							},
						],
					}),
					t.C_BLOCK_COMMENT_MODE,
					l,
					{ begin: r(/[{,\n]\s*/, s(r(/(((\/\/.*)|(\/\*(.|\n)*\*\/))\s*)*/, i + "\\s*:"))), relevance: 0, contains: [{ className: "attr", begin: i + s("\\s*:"), relevance: 0 }] },
					{
						begin: "(" + t.RE_STARTERS_RE + "|\\b(case|return|throw)\\b)\\s*",
						keywords: "return throw case",
						contains: [
							t.C_LINE_COMMENT_MODE,
							t.C_BLOCK_COMMENT_MODE,
							t.REGEXP_MODE,
							{ className: "function", begin: "(\\([^(]*(\\([^(]*(\\([^(]*\\))?\\))?\\)|" + t.UNDERSCORE_IDENT_RE + ")\\s*=>", returnBegin: !0, end: "\\s*=>", contains: [{ className: "params", variants: [{ begin: t.UNDERSCORE_IDENT_RE }, { className: null, begin: /\(\s*\)/, skip: !0 }, { begin: /\(/, end: /\)/, excludeBegin: !0, excludeEnd: !0, keywords: o, contains: b }] }] },
							{ begin: /,/, relevance: 0 },
							{ className: "", begin: /\s/, end: /\s*/, skip: !0 },
							{
								variants: [
									{ begin: "<>", end: "</>" },
									{ begin: c.begin, end: c.end },
								],
								subLanguage: "xml",
								contains: [{ begin: c.begin, end: c.end, skip: !0, contains: ["self"] }],
							},
						],
						relevance: 0,
					},
					{ className: "function", beginKeywords: "function", end: /\{/, excludeEnd: !0, contains: [t.inherit(t.TITLE_MODE, { begin: i }), _], illegal: /\[|%/ },
					{ begin: /\$[(.]/ },
					t.METHOD_GUARD,
					{ className: "class", beginKeywords: "class", end: /[{;=]/, excludeEnd: !0, illegal: /[:"\[\]]/, contains: [{ beginKeywords: "extends" }, t.UNDERSCORE_TITLE_MODE] },
					{ beginKeywords: "constructor", end: /\{/, excludeEnd: !0 },
					{ begin: "(get|set)\\s+(?=" + i + "\\()", end: /{/, keywords: "get set", contains: [t.inherit(t.TITLE_MODE, { begin: i }), { begin: /\(\)/ }, _] },
				],
				illegal: /#(?!!)/,
			};
		};
	})()
);
hljs.registerLanguage(
	"json",
	(function () {
		"use strict";
		return function (n) {
			var e = { literal: "true false null" },
				i = [n.C_LINE_COMMENT_MODE, n.C_BLOCK_COMMENT_MODE],
				t = [n.QUOTE_STRING_MODE, n.C_NUMBER_MODE],
				a = { end: ",", endsWithParent: !0, excludeEnd: !0, contains: t, keywords: e },
				l = { begin: "{", end: "}", contains: [{ className: "attr", begin: /"/, end: /"/, contains: [n.BACKSLASH_ESCAPE], illegal: "\\n" }, n.inherit(a, { begin: /:/ })].concat(i), illegal: "\\S" },
				s = { begin: "\\[", end: "\\]", contains: [n.inherit(a)], illegal: "\\S" };
			return (
				t.push(l, s),
				i.forEach(function (n) {
					t.push(n);
				}),
				{ name: "JSON", contains: t, keywords: e, illegal: "\\S" }
			);
		};
	})()
);
hljs.registerLanguage(
	"haskell",
	(function () {
		"use strict";
		return function (e) {
			var n = { variants: [e.COMMENT("--", "$"), e.COMMENT("{-", "-}", { contains: ["self"] })] },
				i = { className: "meta", begin: "{-#", end: "#-}" },
				a = { className: "meta", begin: "^#", end: "$" },
				s = { className: "type", begin: "\\b[A-Z][\\w']*", relevance: 0 },
				l = { begin: "\\(", end: "\\)", illegal: '"', contains: [i, a, { className: "type", begin: "\\b[A-Z][\\w]*(\\((\\.\\.|,|\\w+)\\))?" }, e.inherit(e.TITLE_MODE, { begin: "[_a-z][\\w']*" }), n] };
			return {
				name: "Haskell",
				aliases: ["hs"],
				keywords: "let in if then else case of where do module import hiding qualified type data newtype deriving class instance as default infix infixl infixr foreign export ccall stdcall cplusplus jvm dotnet safe unsafe family forall mdo proc rec",
				contains: [
					{ beginKeywords: "module", end: "where", keywords: "module where", contains: [l, n], illegal: "\\W\\.|;" },
					{ begin: "\\bimport\\b", end: "$", keywords: "import qualified as hiding", contains: [l, n], illegal: "\\W\\.|;" },
					{ className: "class", begin: "^(\\s*)?(class|instance)\\b", end: "where", keywords: "class family instance where", contains: [s, l, n] },
					{ className: "class", begin: "\\b(data|(new)?type)\\b", end: "$", keywords: "data family type newtype deriving", contains: [i, s, l, { begin: "{", end: "}", contains: l.contains }, n] },
					{ beginKeywords: "default", end: "$", contains: [s, l, n] },
					{ beginKeywords: "infix infixl infixr", end: "$", contains: [e.C_NUMBER_MODE, n] },
					{ begin: "\\bforeign\\b", end: "$", keywords: "foreign import export ccall stdcall cplusplus jvm dotnet safe unsafe", contains: [s, e.QUOTE_STRING_MODE, n] },
					{ className: "meta", begin: "#!\\/usr\\/bin\\/env runhaskell", end: "$" },
					i,
					a,
					e.QUOTE_STRING_MODE,
					e.C_NUMBER_MODE,
					s,
					e.inherit(e.TITLE_MODE, { begin: "^[_a-z][\\w']*" }),
					n,
					{ begin: "->|<-" },
				],
			};
		};
	})()
);
hljs.registerLanguage(
	"css",
	(function () {
		"use strict";
		return function (e) {
			var n = {
				begin: /(?:[A-Z\_\.\-]+|--[a-zA-Z0-9_-]+)\s*:/,
				returnBegin: !0,
				end: ";",
				endsWithParent: !0,
				contains: [
					{
						className: "attribute",
						begin: /\S/,
						end: ":",
						excludeEnd: !0,
						starts: {
							endsWithParent: !0,
							excludeEnd: !0,
							contains: [
								{
									begin: /[\w-]+\(/,
									returnBegin: !0,
									contains: [
										{ className: "built_in", begin: /[\w-]+/ },
										{ begin: /\(/, end: /\)/, contains: [e.APOS_STRING_MODE, e.QUOTE_STRING_MODE, e.CSS_NUMBER_MODE] },
									],
								},
								e.CSS_NUMBER_MODE,
								e.QUOTE_STRING_MODE,
								e.APOS_STRING_MODE,
								e.C_BLOCK_COMMENT_MODE,
								{ className: "number", begin: "#[0-9A-Fa-f]+" },
								{ className: "meta", begin: "!important" },
							],
						},
					},
				],
			};
			return {
				name: "CSS",
				case_insensitive: !0,
				illegal: /[=\/|'\$]/,
				contains: [
					e.C_BLOCK_COMMENT_MODE,
					{ className: "selector-id", begin: /#[A-Za-z0-9_-]+/ },
					{ className: "selector-class", begin: /\.[A-Za-z0-9_-]+/ },
					{ className: "selector-attr", begin: /\[/, end: /\]/, illegal: "$", contains: [e.APOS_STRING_MODE, e.QUOTE_STRING_MODE] },
					{ className: "selector-pseudo", begin: /:(:)?[a-zA-Z0-9\_\-\+\(\)"'.]+/ },
					{ begin: "@(page|font-face)", lexemes: "@[a-z-]+", keywords: "@page @font-face" },
					{
						begin: "@",
						end: "[{;]",
						illegal: /:/,
						returnBegin: !0,
						contains: [
							{ className: "keyword", begin: /@\-?\w[\w]*(\-\w+)*/ },
							{ begin: /\s/, endsWithParent: !0, excludeEnd: !0, relevance: 0, keywords: "and or not only", contains: [{ begin: /[a-z-]+:/, className: "attribute" }, e.APOS_STRING_MODE, e.QUOTE_STRING_MODE, e.CSS_NUMBER_MODE] },
						],
					},
					{ className: "selector-tag", begin: "[a-zA-Z-][a-zA-Z0-9_-]*", relevance: 0 },
					{ begin: "{", end: "}", illegal: /\S/, contains: [e.C_BLOCK_COMMENT_MODE, n] },
				],
			};
		};
	})()
);
hljs.registerLanguage(
	"xml",
	(function () {
		"use strict";
		return function (e) {
			var n = { className: "symbol", begin: "&[a-z]+;|&#[0-9]+;|&#x[a-f0-9]+;" },
				a = { begin: "\\s", contains: [{ className: "meta-keyword", begin: "#?[a-z_][a-z1-9_-]+", illegal: "\\n" }] },
				s = e.inherit(a, { begin: "\\(", end: "\\)" }),
				t = e.inherit(e.APOS_STRING_MODE, { className: "meta-string" }),
				i = e.inherit(e.QUOTE_STRING_MODE, { className: "meta-string" }),
				c = {
					endsWithParent: !0,
					illegal: /</,
					relevance: 0,
					contains: [
						{ className: "attr", begin: "[A-Za-z0-9\\._:-]+", relevance: 0 },
						{ begin: /=\s*/, relevance: 0, contains: [{ className: "string", endsParent: !0, variants: [{ begin: /"/, end: /"/, contains: [n] }, { begin: /'/, end: /'/, contains: [n] }, { begin: /[^\s"'=<>`]+/ }] }] },
					],
				};
			return {
				name: "HTML, XML",
				aliases: ["html", "xhtml", "rss", "atom", "xjb", "xsd", "xsl", "plist", "wsf", "svg"],
				case_insensitive: !0,
				contains: [{ className: "meta", begin: "<![a-z]", end: ">", relevance: 10, contains: [a, i, t, s, { begin: "\\[", end: "\\]", contains: [{ className: "meta", begin: "<![a-z]", end: ">", contains: [a, s, i, t] }] }] }, e.COMMENT("\x3c!--", "--\x3e", { relevance: 10 }), { begin: "<\\!\\[CDATA\\[", end: "\\]\\]>", relevance: 10 }, n, { className: "meta", begin: /<\?xml/, end: /\?>/, relevance: 10 }, { className: "tag", begin: "<style(?=\\s|>)", end: ">", keywords: { name: "style" }, contains: [c], starts: { end: "</style>", returnEnd: !0, subLanguage: ["css", "xml"] } }, { className: "tag", begin: "<script(?=\\s|>)", end: ">", keywords: { name: "script" }, contains: [c], starts: { end: "</script>", returnEnd: !0, subLanguage: ["javascript", "handlebars", "xml"] } }, { className: "tag", begin: "</?", end: "/?>", contains: [{ className: "name", begin: /[^\/><\s]+/, relevance: 0 }, c] }],
			};
		};
	})()
);
