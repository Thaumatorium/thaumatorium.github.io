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
