let input = document.getElementById("slugify_in");
let output = document.getElementById("slugify_out");

input.addEventListener('input', () => {
	output.value = input.value.replace(/[^a-z0-9]/gi, _ => "-").replace(/(---*)+/gi, _ => "-");
	output.value = output.value.toLowerCase();
});

output.addEventListener('click', () => {
	output.select();
	document.execCommand('copy');
});