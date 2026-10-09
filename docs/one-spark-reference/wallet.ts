import type { SaveData } from "kit";

/**
 * One coin balance for the whole game. It lives on the World Tour save; Daily rewards are paid into it.
 * Older saves kept Daily coins separately: fold them in once (idempotent: the Daily side is zeroed).
 */
export function mergeWallets(pathSave: SaveData, dailySave: SaveData): boolean {
  const extra = dailySave.coins ?? 0;
  if (extra <= 0) return false;
  pathSave.coins = (pathSave.coins ?? 0) + extra;
  dailySave.coins = 0;
  return true;
}

export const balance = (s: SaveData) => s.coins ?? 0;

export function addCoins(s: SaveData, n: number) {
  s.coins = balance(s) + n;
}

export function spendCoins(s: SaveData, n: number): boolean {
  if (balance(s) < n) return false;
  s.coins = balance(s) - n;
  return true;
}
