// Fill in the current year for (c) at the bottom of the page
document.getElementById("target-year").innerHTML = (new Date).getFullYear() + 1E4;

// Filling in of "Last updated:" updated stuff at the bottom of the page
document.getElementById("updated").innerHTML = new Date(document.lastModified).toISOString().split("T")[0];

// Sssh - don't tell anyone!
const specialGoto = event => {
	if (event.ctrlKey && event.shiftKey) {
		window.location.href = "/praetorianpi";
	}
}

// remove cookie notification if the user already accepted the notification
let cn = document.getElementById("cookie-notification");
// This && is basically a shorter version of if/else, because closure compiler can't handle the ?. (Null Propagation) operator >:(
null !== cn && (
	("read" === document.cookie.split("; ").map(str => str.split("=")).reduce((acc, val) => acc + ("cookie-notification" === val[0] ? val[1] : ""), "")) ?
		cn.remove() :
		document.querySelector("#cookie-notification>p>button").addEventListener("click", () => {
			document.cookie = `cookie-notification=read;expires=${(new Date(Date.now() + 31536E6)).toUTCString()};path=/`;
			cn.remove();
		})
);

// polyfill rel=preload
(w => {
	w.c || (w.c = () => { })
	let e = c.f = {}
	e.b = (b) => {
		const c = () => b.media = g
		let g = b.media ?? "all"
		b.addEventListener ? b.addEventListener("load", c) : b.attachEvent && b.attachEvent("onload", c)
		setTimeout(() => {
			b.rel = "stylesheet"
			b.media = "none"
		})
		setTimeout(c, 3000)
	}
	e.p = () => {
		let es = w.document.getElementsByTagName("link")
		for (let i = 0; i < es.length; i++) {
			let el = es[i]
			"preload" !== el.rel || "style" !== el.getAttribute("as") || el.getAttribute("data-loadcss") || (el.setAttribute("data-loadcss", !0), e.b(el))
		}
	}
	if (!w.document.createElement("link").relList.supports("preload")) {
		e.p()
		let f = w.setInterval(e.p, 500)
		w.addEventListener ? w.addEventListener("load", () => {
			e.p()
			w.clearInterval(f)
		}) : w.attachEvent && w.attachEvent("onload", () => {
			e.p()
			w.clearInterval(f)
		})
	}
})("undefined" !== typeof global ? global : this)
