import { z } from "zod";
import { oneSparkProgressSchema } from "./one-spark.js";
import { loomRushProgressSchema } from "./loom-rush.js";
import { borrowedTimeProgressSchema } from "./borrowed-time.js";
import { gameIdSchema, type GameId } from "./registry.js";

/**
 * Admin display mapping for a progress schema field.
 * Every schema path must appear here (or be marked hidden) so the dashboard stays in sync.
 */
export type AdminFieldMapping = {
  /** Dot path into the progress document, e.g. `coins` or `island.tier`. */
  path: string;
  /** Short plain label for staff (not developers). */
  label: string;
  /** When true, field is intentionally omitted from the desk UI. */
  hidden?: boolean;
};

export type GameAdminMeta = {
  gameId: GameId;
  displayName: string;
  /** True when the progress schema is still a draft. */
  draft: boolean;
  fields: AdminFieldMapping[];
};

export type AdminSummaryRow = {
  path: string;
  label: string;
  value: string;
};

export type ProgressAdminSummary = {
  gameId: GameId;
  displayName: string;
  draft: boolean;
  revision: number;
  rows: AdminSummaryRow[];
};

const oneSparkFields: AdminFieldMapping[] = [
  { path: "schemaVersion", label: "Save version", hidden: true },
  { path: "stars", label: "Levels with stars" },
  { path: "album", label: "Album pieces" },
  { path: "tutorialDone", label: "Tutorial done" },
  { path: "coins", label: "Coins (on device)" },
  { path: "firstClear", label: "First clears" },
  { path: "daily", label: "Daily streak", hidden: true },
  { path: "daily.lastPlayed", label: "Last daily play" },
  { path: "daily.lastRewarded", label: "Last daily reward" },
  { path: "daily.streak", label: "Daily streak days" },
  { path: "daily.lastStreakDate", label: "Streak date" },
  { path: "travelSeen", label: "Travel seen" },
  { path: "hintIntroSeen", label: "Hint intro seen" },
];

const loomRushFields: AdminFieldMapping[] = [
  { path: "schemaVersion", label: "Save version", hidden: true },
  { path: "_draft", label: "Draft schema", hidden: true },
  { path: "levelReached", label: "Level reached" },
  { path: "stars", label: "Level stars" },
  { path: "wardrobe", label: "Wardrobe pieces" },
  { path: "coins", label: "Coins (on device)" },
  { path: "boosters", label: "Boosters", hidden: true },
  { path: "boosters.unpick", label: "Unpick boosters" },
  { path: "boosters.snip", label: "Snip boosters" },
  { path: "boosters.shuffle", label: "Shuffle boosters" },
  { path: "boosters.peek", label: "Peek boosters" },
  { path: "tutorialDone", label: "Tutorial done" },
];

const borrowedTimeFields: AdminFieldMapping[] = [
  { path: "schemaVersion", label: "Save version", hidden: true },
  { path: "_draft", label: "Draft schema", hidden: true },
  { path: "island", label: "Island", hidden: true },
  { path: "island.schemaVersion", label: "Island version", hidden: true },
  { path: "island._draft", label: "Island draft", hidden: true },
  { path: "island.islandId", label: "Island", hidden: true },
  { path: "island.tier", label: "Era" },
  { path: "island.lots", label: "Lots" },
  { path: "island.buildings", label: "Buildings" },
  { path: "island.palisade", label: "Palisade" },
  { path: "island.roads", label: "Roads" },
  { path: "island.debt", label: "Debt (Hours)" },
  { path: "island.greySet", label: "Grey lots" },
  { path: "island.tech", label: "Tech" },
  { path: "island.defence", label: "Defence" },
  { path: "eventLog", label: "Chronicle events" },
  { path: "commandLog", label: "Command log" },
  { path: "coins", label: "Coins (on device)" },
];

export const GAME_ADMIN_META: Record<GameId, GameAdminMeta> = {
  "one-spark": {
    gameId: "one-spark",
    displayName: "One Spark",
    draft: false,
    fields: oneSparkFields,
  },
  "loom-rush": {
    gameId: "loom-rush",
    displayName: "Loom Rush",
    draft: true,
    fields: loomRushFields,
  },
  "borrowed-time": {
    gameId: "borrowed-time",
    displayName: "Borrowed Time",
    draft: true,
    fields: borrowedTimeFields,
  },
};

export function gameAdminMeta(gameId: GameId): GameAdminMeta {
  return GAME_ADMIN_META[gameId];
}

export function gameDisplayName(gameId: string): string {
  const parsed = gameIdSchema.safeParse(gameId);
  if (!parsed.success) return gameId;
  return GAME_ADMIN_META[parsed.data].displayName;
}

/** Collect leaf and object paths from a zod object schema (one level of nesting for objects). */
export function schemaFieldPaths(schema: z.ZodTypeAny, prefix = ""): string[] {
  const unwrapped = unwrapZod(schema);
  if (!(unwrapped instanceof z.ZodObject)) return prefix ? [prefix] : [];
  const shape = unwrapped.shape as Record<string, z.ZodTypeAny>;
  const paths: string[] = [];
  for (const [key, child] of Object.entries(shape)) {
    const path = prefix ? `${prefix}.${key}` : key;
    paths.push(path);
    const inner = unwrapZod(child);
    if (inner instanceof z.ZodObject) {
      paths.push(...schemaFieldPaths(inner, path));
    }
  }
  return paths;
}

function unwrapZod(schema: z.ZodTypeAny): z.ZodTypeAny {
  let current: z.ZodTypeAny = schema;
  for (;;) {
    if (current instanceof z.ZodOptional || current instanceof z.ZodNullable || current instanceof z.ZodDefault) {
      current = current._def.innerType as z.ZodTypeAny;
      continue;
    }
    if (current instanceof z.ZodEffects) {
      current = current._def.schema as z.ZodTypeAny;
      continue;
    }
    return current;
  }
}

export function progressSchemaPaths(gameId: GameId): string[] {
  switch (gameId) {
    case "one-spark":
      return schemaFieldPaths(oneSparkProgressSchema);
    case "loom-rush":
      return schemaFieldPaths(loomRushProgressSchema);
    case "borrowed-time":
      return schemaFieldPaths(borrowedTimeProgressSchema);
  }
}

function getAtPath(doc: unknown, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = doc;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value === "" ? "—" : value;
  if (Array.isArray(value)) return String(value.length);
  if (typeof value === "object") return String(Object.keys(value as object).length);
  return String(value);
}

/**
 * Build staff-facing rows from a progress document using the game's admin mapping.
 * Hidden fields are omitted. Draft status is exposed via `draft` on the summary.
 */
export function summarizeProgress(
  gameId: GameId,
  document: unknown,
  revision = 0,
): ProgressAdminSummary {
  const meta = GAME_ADMIN_META[gameId];
  const schema =
    gameId === "one-spark"
      ? oneSparkProgressSchema
      : gameId === "loom-rush"
        ? loomRushProgressSchema
        : borrowedTimeProgressSchema;
  const parsed = schema.safeParse(document);
  const doc = parsed.success ? parsed.data : document;

  const rows: AdminSummaryRow[] = meta.fields
    .filter((f) => !f.hidden)
    .map((f) => ({
      path: f.path,
      label: f.label,
      value: formatValue(getAtPath(doc, f.path)),
    }));

  return {
    gameId,
    displayName: meta.displayName,
    draft: meta.draft,
    revision,
    rows,
  };
}
