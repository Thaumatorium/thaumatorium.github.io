"use strict";
/**
 * Use VSCode with the next extensions:
 * CodeMetrics
 * Live Server
 *
 * Then click "Go Live" on the bottom row.
 * Your browser should start up with a local server running.
 *
 * g_* variables are globally used (which should only be the canvas and context variables)
 */

/* GENERAL CODE */
// Canvas and Context should have the same scale :)
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

/**
 * @param {HTMLElement} canvas
 * @return RenderingContext
 */
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
const COLOR = {
	BLACK: {
		red: 0,
		green: 0,
		blue: 0,
		alpha: 255,
	},
	WHITE: {
		red: 255,
		green: 255,
		blue: 255,
		alpha: 255,
	},
	RED: {
		red: 255,
		green: 0,
		blue: 0,
		alpha: 255,
	},
	GREEN: {
		red: 0,
		green: 255,
		blue: 0,
		alpha: 255,
	},
};

/* SPECIFICER CODE */
// change this name to any image filename you want
// I assume no alpha is used in the png.
const THE_MAZE_TO_SOLVE = "3232maze_original.png";
let g_maze = new Image();
g_maze.src = THE_MAZE_TO_SOLVE;
g_maze.onload = () => {
	g_canvas = getScaledCanvas(g_maze.width, g_maze.height);
	g_ctx = getScaledContext(g_canvas, g_maze.width, g_maze.height);
	// main
	// Hey look, this is (basically) the starting point of this code!
	const mazedata = get_maze_data(THE_MAZE_TO_SOLVE);
	solve(mazedata);
};

/**
 * OK. So. The way you get the pixelvalues of an image in Javascript goes a little something like this...
 * @param {string} imgName Usualy a filename, perhaps a path at the front.
 */
const get_maze_data = (imgName) => {
	// First, you create new image
	const mazeImage = new Image();
	// which you'll give the image name,
	// so JS loads the image into the variable
	mazeImage.src = imgName;

	// Now we create a new (empty) canvas
	const mazeCanvas = document.createElement("canvas");
	// and make it the size of the image
	mazeCanvas.width = mazeImage.width;
	mazeCanvas.height = mazeImage.height;

	// Next up get the canvas' context
	const mazeContext = mazeCanvas.getContext("2d");
	// so we can draw the image onto the canvas.
	// Well, context really, but who's counting...
	mazeContext.drawImage(mazeImage, 0, 0, mazeImage.width, mazeImage.height);

	// Finally, we'll extract the pixel data from the context!
	// Tadaa! Pixel data!
	// But, oh no! The pixel data is all weird, as it's an array with each R,G,B and Alpha values one after another like:
	// [R,G,B,A,R,G,B,A,R,G,B,A...]
	const imgdata = mazeContext.getImageData(0, 0, mazeImage.width, mazeImage.height).data;

	/**
	 * A function in a function - WHAAAAAT?
	 * @param {[number]} RGBAlphaArray
	 * @param {number} width
	 * @param {number} height
	 */
	const convertRGBAlphaArrayToObjectArray = (RGBAlphaArray, width, height) => {
		let result = [];

		// making sure the resulting data also has its parents width and height properties.
		result.width = width;
		result.height = height;

		// converting the data!
		for (let y = 0; y < height; y++) {
			let row = [];
			for (let x = 0; x < width * 4; x += 4) {
				// convert a pixel!
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

/**
 * @param {*} maze
 */
const draw_maze = (maze) => {
	/**
	 * @param {number} x
	 * @param {number} y
	 * @param {{red:number,green:number,blue:number,alpha:number}} pixel
	 */
	const drawPixel = (x, y, pixel) => {
		g_ctx.fillStyle = "rgba(" + pixel.red + "," + pixel.green + "," + pixel.blue + "," + pixel.alpha / 255 + ")";
		g_ctx.fillRect(x, y, 1, 1);
	};

	for (let y = 0; y < maze.height; y++) {
		for (let x = 0; x < maze.width; x++) {
			// get pixel
			const pixel = maze[y][x];
			// draw pixel
			drawPixel(x, y, pixel);
		}
	}
};

/**
 * @param {[[{red:number,green:number,blue:number,alpha:number}]]} maze
 */
const solve = (maze) => {
	const startingPoint = [
		{
			x: maze[0].findIndex((e) => JSON.stringify(e) == JSON.stringify(COLOR.WHITE)),
			y: 0,
		},
	];
	const endPoint = {
		x: maze[maze.length - 1].findIndex((e) => JSON.stringify(e) == JSON.stringify(COLOR.WHITE)),
		y: maze.length,
	};
	try {
		// give the initial solve the startingpoint, as this will evolve into the full path.
		recurse_solve(maze, endPoint, startingPoint);
	} catch (e) {
		console.log(e);
		console.log("Crashed out of the loop!");
	}
};

/**
 * @param {array} maze
 * @param {{x,y}} endPoint
 * @param {[{x,y}]} path
 */
const recurse_solve = (maze, endPoint, path) => {
	const endReached = () => {
		const filtEnd = path.filter((element) => element.x === endPoint.x && element.y === endPoint.y);
		if (filtEnd.length > 0) {
			console.log("SOLVED!!!");
			return true;
		}
	};

	if (endReached()) {
		// return nothing to crash out of the loop.
		return;
	}

	const currentNode = path[path.length - 1];

	/**
	 * Check if the same node exists multiple times in the path.
	 * If this is the case, yeet out.
	 */
	const repeatNodeFound = () => {
		// init is a Haskell thing: http://s3.amazonaws.com/lyah/listmonster.png, from http://learnyouahaskell.com/starting-out
		const init = path.slice(0, path.length - 1);
		// dups holds all 'nodes' that are the same as the last node of `path`
		const dups = init.filter((element) => element.x === currentNode.x && element.y === currentNode.y);
		return dups.length > 0;
	};

	if (repeatNodeFound()) {
		return [];
	}

	const wallFound = () => JSON.stringify(maze[currentNode.y][currentNode.x]) === JSON.stringify(COLOR.BLACK);

	if (wallFound()) {
		return [];
	}

	// set current node to green
	maze[currentNode.y][currentNode.x] = COLOR.GREEN;
	draw_maze(maze);

	/**
	 * This function can access data from the outer func.
	 * @param {number} lastX
	 * @param {number} lastY
	 */
	const recurse = (lastX, lastY) => {
		// copy path
		const downPath = [...path];
		// add the new node
		downPath.push({
			x: lastX,
			y: lastY,
		});
		return recurse_solve(maze, endPoint, downPath);
	};

	// recurse with a new direction added (using the current position as base)
	let down = recurse(currentNode.x, currentNode.y + 1);
	recurse(currentNode.x + 1, currentNode.y);
	recurse(currentNode.x, currentNode.y - 1);
	recurse(currentNode.x - 1, currentNode.y);

	// once this point is reached, all possible directions have been exhausted
	// and the pixel is made red
	maze[currentNode.y][currentNode.x] = COLOR.RED;

	// once the end of the maze is reached, this will be undefined (because repeatNodeFound() returns nothing/undefined)
	// once this undefined variable is used, it'll literally crash out of the loop
	// and be caught in the try/catch statement. Only needed for down, as the exit is currently defined as
	// "the only/first white pixel in the lowest row", which can only be gotten to by going down.
	// Until that happens, down is just an empty list (with a lenght of 0, which still needs to be returned).
	down.length;
	return down;
};
