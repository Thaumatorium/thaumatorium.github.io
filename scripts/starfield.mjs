window.starfield.style = "background:black;"
const context = window.starfield.getContext("2d");
let height = document.documentElement.clientHeight;
let width = document.documentElement.clientWidth;
const depth = 1000 * (height / width);
const stars = [];
let max_depth = width;
const star_count = 50;
const star_max_size = 2
const star_max_halo = 15
const star_color_range = [
	{ r: 21, g: 117, b: 254 },
	{ r: 183, g: 231, b: 253 },
	{ r: 255, g: 255, b: 255 },
	{ r: 255, g: 255, b: 195 },
	{ r: 248, g: 254, b: 10 },
	{ r: 247, g: 157, b: 1 },
	{ r: 227, g: 13, b: 21 },
];
// speed slider
const speed = 0.3;

// generate a random double between min and max
const rand = (min, max) => Math.random() * (+max - +min) + +min;

// Create stars
for (let i = 0; i < star_count; i++) {
	const size = Math.random() * star_max_size;
	const brightness = rand((1 / 3), 1);
	const temp = Math.floor(rand(0, star_color_range.length));
	const rand_color = star_color_range[temp];
	stars[i] = {
		x: Math.random() * width,
		y: Math.random() * height,
		z: Math.random() * depth,
		size: size,
		r: Math.floor(rand_color.r * brightness),
		g: Math.floor(rand_color.g * brightness),
		b: Math.floor(rand_color.b * brightness),
		halo: rand(5, star_max_halo),
		// TODO make the stars pulse?
		pulse: 5,
		intensity: 1.0,
	};
}

// Animation loop
const step = (timestamp) => {
	// Not sure what to do with `timestamp`
	height = document.documentElement.clientHeight;
	width = document.documentElement.clientWidth;
	max_depth = width;
	// Resize canvas when the window is resized
	context.canvas.height = height;
	context.canvas.width = width;

	// create the black background
	// context.fillRect(0, 0, width, height);

	for (let i = stars.length - 1; i > -1; i--) {
		let star = stars[i];

		// move the stars to the left, depending on their size and general speed control
		star.x -= (star.size * speed);

		// move the star back to the right once it reaches the screen
		if (star.x < 0) {
			stars.push(stars.splice(i, 1)[0]);
			star.x = max_depth;
			star.y = Math.random() * height;
			continue;
		}

		const scale = 2;
		// context.fillStyle = "rgb(" + color + "," + color + "," + color + ")";
		// context.fillRect(star.x, star.y, star.size * scale, star.size * scale);
		context.beginPath();
		context.fillStyle = "rgb(" + star.r + "," + star.g + "," + star.b + ")";
		context.arc(star.x, star.y, star.size * scale, 0, 2 * Math.PI);
		// context.shadowBlur = star.halo;
		context.shadowColor = "rgb(" + star.r + "," + star.g + "," + star.b + ")";
		context.fill();
	}

	window.requestAnimationFrame(step);
};

window.requestAnimationFrame(step);
