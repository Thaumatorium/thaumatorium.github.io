import { strategy as aStar } from "./a-star.js";
import { strategy as bfs } from "./bfs.js";
import { strategy as bidirectionalSearch } from "./bidirectional-search.js";
import { strategy as deadEndFilling } from "./dead-end-filling.js";
import { strategy as dfs } from "./dfs.js";
import { strategy as dijkstra } from "./dijkstra.js";
import { strategy as floodFill } from "./flood-fill.js";
import { strategy as leeAlgorithm } from "./lee-algorithm.js";
import { strategy as pledge } from "./pledge.js";
import { strategy as tremaux } from "./tremaux.js";
import { strategy as wallFollowerLeft } from "./wall-follower-left.js";
import { strategy as wallFollowerRight } from "./wall-follower-right.js";

export const strategies = [dfs, bfs, dijkstra, aStar, bidirectionalSearch, deadEndFilling, floodFill, leeAlgorithm, wallFollowerLeft, wallFollowerRight, tremaux, pledge];

export const strategyMap = new Map(strategies.map((entry) => [entry.id, entry]));
