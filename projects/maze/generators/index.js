import { generator as aldousBroder } from "./aldous-broder.js";
import { generator as bfsBased } from "./bfs-based.js";
import { generator as binaryTree } from "./binary-tree.js";
import { generator as braid } from "./braid.js";
import { generator as cellularAutomata } from "./cellular-automata.js";
import { generator as dfs } from "./dfs.js";
import { generator as eller } from "./eller.js";
import { generator as fractalRecursiveSubdivision } from "./fractal-recursive-subdivision.js";
import { generator as growingTree } from "./growing-tree.js";
import { generator as hexGrid } from "./hex-grid.js";
import { generator as huntAndKill } from "./hunt-and-kill.js";
import { generator as originShift } from "./origin-shift.js";
import { generator as randomizedKruskal } from "./randomized-kruskal.js";
import { generator as randomizedPrim } from "./randomized-prim.js";
import { generator as recursiveBacktracker } from "./recursive-backtracker.js";
import { generator as recursiveDivision } from "./recursive-division.js";
import { generator as sidewinder } from "./sidewinder.js";
import { generator as unionFindSpanningTree } from "./union-find-spanning-tree.js";
import { generator as voronoiBased } from "./voronoi-based.js";
import { generator as weave } from "./weave.js";
import { generator as wilson } from "./wilson.js";

export const generators = [originShift, aldousBroder, bfsBased, binaryTree, braid, cellularAutomata, dfs, eller, fractalRecursiveSubdivision, growingTree, hexGrid, huntAndKill, randomizedKruskal, randomizedPrim, recursiveBacktracker, recursiveDivision, sidewinder, unionFindSpanningTree, voronoiBased, weave, wilson];

export const generatorMap = new Map(generators.map((entry) => [entry.id, entry]));
