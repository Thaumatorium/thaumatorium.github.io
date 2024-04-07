const getStartPoint = (imageData) => {
	// loop over the top row until you find the first white pixel
	for (let i = 0; i < imageData.width; i++) {
		// pixel is a {r,g,b,a} structure
		let pixel = imageData[0][i];
		if (pixel.r == 255) {
			// return a 2D vector
			return { x: i, y: 0, colour: COLOUR.GREEN };
		}
	}
};

const getEndPoint = (imageData) => {
	for (let i = 0; i < imageData.width; i++) {
		// pixel is a {r,g,b,a} structure
		let pixel = imageData[imageData.height - 1][i];
		if (pixel.r == 255) {
			// return a 2D vector
			return { x: i, y: imageData.height - 1 };
		}
	}
};

const drawPixel = (x, y, colour) => {
	MAZE.ctx.fillStyle = "rgba(" + colour.r + "," + colour.g + "," + colour.b + "," + colour.a / 255 + ")";
	MAZE.ctx.fillRect(x, y, 1, 1);
};

const getBitmapData = (HTMLImageElement) => {
	const canvas = document.createElement("canvas");
	canvas.width = HTMLImageElement.width;
	canvas.height = HTMLImageElement.height;

	const context = canvas.getContext("2d");
	context.drawImage(HTMLImageElement, 0, 0, HTMLImageElement.width, HTMLImageElement.height);

	const imageData = context.getImageData(0, 0, HTMLImageElement.width, HTMLImageElement.height).data;

	const Uint8ClampedArrayToObjectArray = (RGBAlphaArray, width, height) => {
		let result = [];

		result.width = width;
		result.height = height;

		for (let y = 0; y < height; y++) {
			let row = [];
			for (let x = 0; x < width * 4; x += 4) {
				const stepSize = 4;
				const pixel = {
					r: RGBAlphaArray[x + 0 + y * width * stepSize],
					g: RGBAlphaArray[x + 1 + y * width * stepSize],
					b: RGBAlphaArray[x + 2 + y * width * stepSize],
					a: RGBAlphaArray[x + 3 + y * width * stepSize],
				};
				row.push(pixel);
			}
			result.push(row);
		}

		return result;
	};

	return Uint8ClampedArrayToObjectArray(imageData, HTMLImageElement.width, HTMLImageElement.height);
};

const MAZE = {
	canvas: document.getElementById("maze"),
	ctx: document.getElementById("maze").getContext("2d"),
	image: new Image(),
	bitmap: null,
	scale: 10,
	path: [],
	endPoint: null,
};

MAZE.image.src = `mazes/maze.png`;
MAZE.image.onload = () => {
	MAZE.bitmap = getBitmapData(MAZE.image);
	MAZE.endPoint = getEndPoint(MAZE.bitmap);
	MAZE.canvas.width = MAZE.image.width;
	MAZE.canvas.height = MAZE.image.height;
	MAZE.canvas.width *= MAZE.scale;
	MAZE.canvas.height *= MAZE.scale;
	MAZE.ctx.scale(MAZE.scale, MAZE.scale);
	MAZE.ctx.imageSmoothingEnabled = false;
};

/****************************************************************
 * set events for HTML elements
 ****************************************************************/
const selectedMaze = document.getElementById("selected-maze");
selectedMaze.onchange = () => {
	console.log(`You have chosen ${selectedMaze.value}`);
	MAZE.image.src = selectedMaze.value;
	MAZE.path = [getStartPoint(MAZE.bitmap)];
};

const mazeScale = document.getElementById("maze-scale");
mazeScale.onchange = () => {
	console.log(`You have chosen ${mazeScale.value}`);
	MAZE.path = [getStartPoint(MAZE.bitmap)];
	MAZE.scale = parseInt(mazeScale.value);
	MAZE.canvas.width = MAZE.image.width;
	MAZE.canvas.height = MAZE.image.height;
	MAZE.canvas.width *= MAZE.scale;
	MAZE.canvas.height *= MAZE.scale;
	MAZE.ctx.scale(MAZE.scale, MAZE.scale);
	MAZE.ctx.imageSmoothingEnabled = false;
};

const playAnimation = document.getElementById("play-animation");
playAnimation.onclick = () => {
	MAZE.path = [getStartPoint(MAZE.bitmap)];

	console.log(`starting animation`);
	window.requestAnimationFrame(step);
};

// not really an ENUM, but just act as if it is.
const COLOUR = {
	BLACK: { r: 0, g: 0, b: 0, a: 255 },
	WHITE: { r: 255, g: 255, b: 255, a: 255 },
	RED: { r: 255, g: 0, b: 0, a: 255 },
	GREEN: { r: 0, g: 255, b: 0, a: 255 },
};

const addNewDir = (x, y) => {
	let result = {};
	// check south, east, west, north, in that order
	if (JSON.stringify(MAZE.bitmap[y + 1][x]) === JSON.stringify(COLOUR.WHITE)) {
		result = { x: x, y: y + 1, colour: COLOUR.GREEN };
		if (!MAZE.path.includes(result)) {
			MAZE.bitmap[y + 1][x] = COLOUR.GREEN;
			MAZE.path.push(result);
			return;
		}
	}
	if (JSON.stringify(MAZE.bitmap[y][x + 1]) === JSON.stringify(COLOUR.WHITE)) {
		result = { x: x + 1, y: y, colour: COLOUR.GREEN };
		if (!MAZE.path.includes(result)) {
			MAZE.bitmap[y][x + 1] = COLOUR.GREEN;
			MAZE.path.push(result);
			return;
		}
	}
	if (JSON.stringify(MAZE.bitmap[y][x - 1]) === JSON.stringify(COLOUR.WHITE)) {
		result = { x: x - 1, y: y, colour: COLOUR.GREEN };
		if (!MAZE.path.includes(result)) {
			MAZE.bitmap[y][x - 1] = COLOUR.GREEN;
			MAZE.path.push(result);
			return;
		}
	}
	if (JSON.stringify(MAZE.bitmap[y - 1][x]) === JSON.stringify(COLOUR.WHITE)) {
		result = { x: x, y: y - 1, colour: COLOUR.GREEN };
		if (!MAZE.path.includes(result)) {
			MAZE.bitmap[y - 1][x] = COLOUR.GREEN;
			MAZE.path.push(result);
			return;
		}
	}
};

const step = (timestamp) => {
	console.log(`step: ${timestamp}`);
	MAZE.ctx.clearRect(0, 0, MAZE.canvas.width, MAZE.canvas.height);
	MAZE.ctx.drawImage(MAZE.image, 0, 0, MAZE.image.width, MAZE.image.height);

	let currentPos = MAZE.path[MAZE.path.length - 1];
	addNewDir(currentPos.x, currentPos.y);

	for (let i = 0; i < MAZE.path.length; i++) {
		const pixel = MAZE.path[i];
		drawPixel(pixel.x, pixel.y, pixel.colour);
	}

	if (currentPos.x === MAZE.endPoint.x && currentPos.y === MAZE.endPoint.y) {
		return;
	}

	window.requestAnimationFrame(step);
};
