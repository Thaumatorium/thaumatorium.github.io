("running base64.mjs")
let in_encode = document.getElementById("base64_in_encode");
let out_encode = document.getElementById("base64_out_encode");
let in_decode = document.getElementById("base64_in_decode");
let out_decode = document.getElementById("base64_out_decode");

in_encode.addEventListener('input', () => {
	// Ascii to Base64
	out_encode.value = window.btoa(in_encode.value);
});

out_encode.addEventListener('click', () => {
	out_encode.select();
	document.execCommand('copy');
});

in_decode.addEventListener('input', () => {
	// Base64 to Ascii
	out_decode.value = window.atob(in_decode.value);
});

out_decode.addEventListener('click', () => {
	out_decode.select();
	document.execCommand('copy');
});
