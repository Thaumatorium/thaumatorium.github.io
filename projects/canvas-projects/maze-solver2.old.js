"use strict";

const getRelativeScale = (mazeHeight) => {
	const screenHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
	const bufferSpace = 50;
	return (1 / (mazeHeight / (screenHeight - bufferSpace))) * 2;
};

const getScaledCanvas = (mazeWidth, mazeHeight) => {
	const scale = getRelativeScale(mazeHeight);
	const cnvs = document.getElementById("cnvs");
	cnvs.width *= scale;
	cnvs.height *= scale;

	return cnvs;
};
const getScaledContext = (canvas, mazeWidth, mazeHeight) => {
	const screenHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
	const bufferSpace = 50;
	const heightScale = 1 / (mazeHeight / (screenHeight - bufferSpace));

	const ctx = canvas.getContext("2d");
	ctx.scale(heightScale, heightScale);
	ctx.imageSmoothingEnabled = false;
	return ctx;
};

let g_canvas;
let g_ctx;

// change this name to any image filename you want
// I assume no alpha is used in the png.
const THE_MAZE_TO_SOLVE = "maze.png";
let g_maze = new Image();
g_maze.src = THE_MAZE_TO_SOLVE;
g_maze.onload = () => {
	g_canvas = getScaledCanvas(g_maze.width, g_maze.height);
	g_ctx = getScaledContext(g_canvas, g_maze.width, g_maze.height);
	const maze = get_maze_data(THE_MAZE_TO_SOLVE);
	draw_maze(maze);
};

const get_maze_data = (imgName) => {
	const mazeImage = new Image();
	mazeImage.src = imgName;
	const mazeCanvas = document.createElement("canvas");
	mazeCanvas.width = mazeImage.width;
	mazeCanvas.height = mazeImage.height;
	const mazeContext = mazeCanvas.getContext("2d");
	mazeContext.drawImage(mazeImage, 0, 0, mazeImage.width, mazeImage.height);
	const imgdata = mazeContext.getImageData(0, 0, mazeImage.width, mazeImage.height).data;
	const convertRGBAlphaArrayToObjectArray = (RGBAlphaArray, width, height) => {
		let result = [];
		result.width = width;
		result.height = height;
		for (let y = 0; y < height; y++) {
			let row = [];
			for (let x = 0; x < width * 4; x += 4) {
				const pixel = {
					red: RGBAlphaArray[x + 0 + y * width * 4],
					green: RGBAlphaArray[x + 1 + y * width * 4],
					blue: RGBAlphaArray[x + 2 + y * width * 4],
					alpha: RGBAlphaArray[x + 3 + y * width * 4],
				};
				row.push(pixel);
			}
			result.push(row);
		}
		return result;
	};
	return convertRGBAlphaArrayToObjectArray(imgdata, mazeImage.width, mazeImage.height);
};

const draw_maze = (maze) => {
	const drawPixel = (x, y, pixel) => {
		g_ctx.fillStyle = "rgba(" + pixel.red + "," + pixel.green + "," + pixel.blue + "," + pixel.alpha / 255 + ")";
		g_ctx.fillRect(x, y, 1, 1);
	};

	for (let y = 0; y < maze.height; y++) {
		for (let x = 0; x < maze.width; x++) {
			const pixel = maze[y][x];
			drawPixel(x, y, pixel);
		}
	}
};
