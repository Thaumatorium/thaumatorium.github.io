let input = document.getElementById("mstg_in");
let output = document.getElementById("mstg_out");

input.addEventListener('input', () => {
	let result = "";
	let spaces = 0;
	for (let i = 0; i < input.value.length; i++) {
		const letter = input.value[i];

		if (letter === " ") {
			result += letter;
			spaces++;
			continue;
		}

		if ((i - spaces) % 2 === 0) {
			result += letter.toUpperCase();
		} else {
			result += letter.toLowerCase();
		}
	}
	output.value = result;
});

output.addEventListener('click', () => {
	output.select();
	document.execCommand('copy');
});
