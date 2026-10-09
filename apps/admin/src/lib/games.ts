import type { StaffRole } from "@stardust/schema";

export const GAME_IDS = ["one-spark", "loom-rush", "borrowed-time"] as const;
export type AdminGameId = (typeof GAME_IDS)[number];

export const GAME_LABELS: Record<AdminGameId, string> = {
  "one-spark": "One Spark",
  "loom-rush": "Loom Rush",
  "borrowed-time": "Borrowed Time",
};

export type GameSection = {
  slug: string;
  label: string;
  /** Minimum role that can see this section in the game nav. */
  minRole: StaffRole;
  /** Only show for these games; omit = all. */
  games?: AdminGameId[];
};

/** Per-game sub-dashboard sections (deep-linked under /games/:game/…). */
export const GAME_SECTIONS: GameSection[] = [
  { slug: "", label: "Overview", minRole: "viewer" },
  { slug: "players", label: "Players", minRole: "viewer" },
  { slug: "levels", label: "Levels", minRole: "viewer" },
  { slug: "economy", label: "Coins", minRole: "viewer" },
  { slug: "ads", label: "Ads", minRole: "support" },
  { slug: "events", label: "Events", minRole: "viewer" },
  { slug: "curve", label: "Level curve", minRole: "viewer", games: ["one-spark"] },
  { slug: "hints", label: "Hints", minRole: "viewer", games: ["one-spark"] },
  { slug: "island", label: "Eras & debt", minRole: "viewer", games: ["borrowed-time"] },
];

const ROLE_RANK: Record<StaffRole, number> = {
  viewer: 1,
  support: 2,
  owner: 3,
};

export function parseGameId(raw: string | undefined): AdminGameId | null {
  if (!raw) return null;
  return (GAME_IDS as readonly string[]).includes(raw) ? (raw as AdminGameId) : null;
}

export function roleAtLeast(role: string | null, min: StaffRole): boolean {
  if (!role || !(role in ROLE_RANK)) return false;
  return ROLE_RANK[role as StaffRole] >= ROLE_RANK[min];
}

export function sectionsForGame(gameId: AdminGameId, role: string | null): GameSection[] {
  return GAME_SECTIONS.filter((s) => {
    if (s.games && !s.games.includes(gameId)) return false;
    return roleAtLeast(role, s.minRole);
  });
}

export function gamePath(gameId: AdminGameId, slug = ""): string {
  return slug ? `/games/${gameId}/${slug}` : `/games/${gameId}`;
}
