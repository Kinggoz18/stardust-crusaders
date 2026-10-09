import { PC, PR, levelBoard, makeRng, type Cell, type PathLevel, type PathState, type Rng } from "./core";

/**
 * Mid-level resume save: the exact board, moves, goal progress, purchased moves and RNG position.
 * Bump RESUME_VERSION when PathState changes shape; a change to the level's data (moves, goal,
 * colours, duds...) changes levelHash, so a save made against old level data is dropped, never misread.
 */
export const RESUME_VERSION = 1;
export const RESUME_KEY = "onespark-resume";

export type ResumeSave = {
  v: number;
  levelId: number;
  levelHash: number;
  rng: number;
  nextId: number;
  grid: (Cell | null)[][];
  movesLeft: number;
  moves: number;
  lit: number;
  colourLit: number[];
  comboDone: boolean;
  secretDone: boolean;
  made: PathState["made"];
  defused: number;
  /** +5 move purchases made in this attempt (sets the next price). */
  buys: number;
  /** Hints bought in this attempt (sets the next hint price). Missing in older saves = 0. */
  hints?: number;
  savedAt: number;
};

function fnv(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Hash of everything in a level that shapes the board or the goal (not its name or hints). */
export function levelHash(lvl: PathLevel): number {
  const { id, colours, moves, goal, star2, duds, dudFuse, dudRate, maxDuds, secretRate, star3, board, rows, cols, playSeed } = lvl;
  return fnv(JSON.stringify({ id, colours, moves, goal, star2, duds, dudFuse, dudRate, maxDuds, secretRate, star3, board, rows, cols, playSeed, PR, PC }));
}

export function snapshot(st: PathState, buys: number, now = Date.now(), hints = 0): ResumeSave {
  return {
    v: RESUME_VERSION,
    levelId: st.lvl.id,
    levelHash: levelHash(st.lvl),
    rng: (st.rand as Rng).state(),
    nextId: st.nextId,
    grid: st.grid.map((row) => row.map((k) => (k ? { ...k } : null))),
    movesLeft: st.movesLeft,
    moves: st.moves,
    lit: st.lit,
    colourLit: [...st.colourLit],
    comboDone: st.comboDone,
    secretDone: st.secretDone,
    made: { ...st.made },
    defused: st.defused,
    buys,
    hints,
    savedAt: now,
  };
}

const isCell = (k: unknown): k is Cell | null =>
  k === null || (typeof k === "object" && typeof (k as Cell).id === "number" && typeof (k as Cell).kind === "string" && typeof (k as Cell).col === "number");

/** Parses and validates a stored save. Returns null for anything stale, foreign or malformed. */
export function parseResume(raw: string | null, levels: readonly PathLevel[]): { save: ResumeSave; level: PathLevel } | null {
  if (!raw) return null;
  let s: ResumeSave;
  try {
    s = JSON.parse(raw) as ResumeSave;
  } catch {
    return null;
  }
  if (!s || s.v !== RESUME_VERSION) return null;
  const level = levels.find((l) => l.id === s.levelId);
  if (!level || levelHash(level) !== s.levelHash) return null;
  const { rows, cols } = levelBoard(level);
  if (!Array.isArray(s.grid) || s.grid.length !== rows || s.grid.some((row) => !Array.isArray(row) || row.length !== cols || !row.every(isCell))) return null;
  if (!(s.movesLeft >= 0) || !(s.lit >= 0) || !(s.buys >= 0)) return null;
  return { save: s, level };
}

export function restore(level: PathLevel, s: ResumeSave): PathState {
  const { rows, cols } = levelBoard(level);
  const rand = makeRng(1);
  rand.setState(s.rng);
  return {
    lvl: level,
    rows,
    cols,
    rand,
    nextId: s.nextId,
    grid: s.grid.map((row) => row.map((k) => (k ? { ...k } : null))),
    movesLeft: s.movesLeft,
    moves: s.moves,
    lit: s.lit,
    colourLit: [...s.colourLit],
    comboDone: s.comboDone,
    secretDone: s.secretDone,
    made: { ...s.made },
    defused: s.defused,
    over: null,
  };
}
