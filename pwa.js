// Fill in the current year for (c) at the bottom of the page
document.getElementById("target-year").innerHTML = (new Date).getFullYear() + 1E4;

// Filling in of "Last updated:" updated stuff at the bottom of the page
document.getElementById("updated").innerHTML = new Date(document.lastModified).toISOString().split("T")[0];

// Sssh - don't tell anyone!
const specialGoto = event => {
	if (event.ctrlKey && event.shiftKey) {
		window.location.href = "/praetorianpi.html";
	}
}

// remove cookie notification if the user already accepted the notification
let cn = document.getElementById("cookie-notification");
// This && is basically a shorter version of if/else, because closure compiler can't handle the ?. (Null Propagation) operator >:(
null !== cn && (
	("read" === document.cookie.split("; ").map(str => str.split("=")).reduce((acc, val) => acc +("cookie-notification" === val[0] ? val[1] : ""), "")) ?
		cn.remove() :
		cn.addEventListener("click", () => {
			document.cookie = `cookie-notification=read;expires=${(new Date(Date.now() + 31536E6)).toUTCString()};path=/`;
			cn.remove();
		})
)