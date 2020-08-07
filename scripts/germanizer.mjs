const in_encode = document.getElementById("germanizer-in-encode");
const out_encode = document.getElementById("germanizer-out-encode");
const in_decode = document.getElementById("germanizer-in-decode");
const out_decode = document.getElementById("germanizer-out-decode");

in_encode.addEventListener('input', () => {
	out_encode.value = Array.from(in_encode.value).map((m) => encode[m] !== undefined ? encode[m] : m).join("");
});

in_encode.addEventListener('click', () => {
	in_encode.select();
});

out_encode.addEventListener('click', () => {
	out_encode.select();
	document.execCommand('copy');
});

in_decode.addEventListener('click', () => {
	in_decode.select();
});

in_decode.addEventListener('input', () => {
	out_decode.value = Array.from(in_decode.value).map((m) => decode[m] !== undefined ? decode[m] : m).join("");
});

out_decode.addEventListener('click', () => {
	out_decode.select();
	document.execCommand('copy');
});

const encode = JSON.parse(`{
	"A": "𝔄",
	"B": "𝔅",
	"C": "ℭ",
	"D": "𝔇",
	"E": "𝔈",
	"F": "𝔉",
	"G": "𝔊",
	"H": "ℌ",
	"I": "ℑ",
	"J": "𝔍",
	"K": "𝔎",
	"L": "𝔏",
	"M": "𝔐",
	"N": "𝔑",
	"O": "𝔒",
	"P": "𝔓",
	"Q": "𝔔",
	"R": "ℜ",
	"S": "𝔖",
	"T": "𝔗",
	"U": "𝔘",
	"V": "𝔙",
	"W": "𝔚",
	"X": "𝔛",
	"Y": "𝔜",
	"Z": "ℨ",
	"a": "𝔞",
	"b": "𝔟",
	"c": "𝔠",
	"d": "𝔡",
	"e": "𝔢",
	"f": "𝔣",
	"g": "𝔤",
	"h": "𝔥",
	"i": "𝔦",
	"j": "𝔧",
	"k": "𝔨",
	"l": "𝔩",
	"m": "𝔪",
	"n": "𝔫",
	"o": "𝔬",
	"p": "𝔭",
	"q": "𝔮",
	"r": "𝔯",
	"s": "𝔰",
	"t": "𝔱",
	"u": "𝔲",
	"v": "𝔳",
	"w": "𝔴",
	"x": "𝔵",
	"y": "𝔶",
	"z": "𝔷"
}`);

const decode = JSON.parse(`{
	"𝔄": "A",
	"𝔅": "B",
	"ℭ": "C",
	"𝔇": "D",
	"𝔈": "E",
	"𝔉": "F",
	"𝔊": "G",
	"ℌ": "H",
	"ℑ": "I",
	"𝔍": "J",
	"𝔎": "K",
	"𝔏": "L",
	"𝔐": "M",
	"𝔑": "N",
	"𝔒": "O",
	"𝔓": "P",
	"𝔔": "Q",
	"ℜ": "R",
	"𝔖": "S",
	"𝔗": "T",
	"𝔘": "U",
	"𝔙": "V",
	"𝔚": "W",
	"𝔛": "X",
	"𝔜": "Y",
	"ℨ": "Z",
	"𝔞": "a",
	"𝔟": "b",
	"𝔠": "c",
	"𝔡": "d",
	"𝔢": "e",
	"𝔣": "f",
	"𝔤": "g",
	"𝔥": "h",
	"𝔦": "i",
	"𝔧": "j",
	"𝔨": "k",
	"𝔩": "l",
	"𝔪": "m",
	"𝔫": "n",
	"𝔬": "o",
	"𝔭": "p",
	"𝔮": "q",
	"𝔯": "r",
	"𝔰": "s",
	"𝔱": "t",
	"𝔲": "u",
	"𝔳": "v",
	"𝔴": "w",
	"𝔵": "x",
	"𝔶": "y",
	"𝔷": "z"
}`);