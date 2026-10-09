export type DailyWallet = {
  lastPlayed: string | null;
  lastRewarded: string | null;
  streak: number;
  lastStreakDate: string | null;
};

export type SaveData = {
  stars: Record<string, boolean[]>;
  album: Record<string, "normal" | "gold">;
  tutorialDone?: boolean;
  coins?: number;
  firstClear?: Record<string, boolean>;
  daily?: DailyWallet;
  travelSeen?: Record<string, boolean>;
  /** The hint sheet (coins or ad) has been shown once; later hints pay with coins straight away. */
  hintIntroSeen?: boolean;
};

export function emptyDaily(): DailyWallet {
  return { lastPlayed: null, lastRewarded: null, streak: 0, lastStreakDate: null };
}

const EMPTY: SaveData = {
  stars: {},
  album: {},
  tutorialDone: false,
  coins: 0,
  firstClear: {},
  daily: emptyDaily(),
  travelSeen: {},
};

export type SavePort = {
  load(key: string): Promise<SaveData>;
  write(key: string, data: SaveData): Promise<void>;
  /** Free-form JSON slots (the mid-level resume save). null removes the slot. */
  loadRaw(key: string): Promise<string | null>;
  writeRaw(key: string, value: string | null): Promise<void>;
};

function parse(raw: string | null): SaveData {
  if (!raw) return { ...EMPTY, stars: {}, album: {}, firstClear: {}, daily: emptyDaily(), travelSeen: {} };
  try {
    const v = JSON.parse(raw) as SaveData;
    return {
      stars: v.stars ?? {},
      album: v.album ?? {},
      tutorialDone: !!v.tutorialDone,
      coins: typeof v.coins === "number" && v.coins >= 0 ? Math.floor(v.coins) : 0,
      firstClear: v.firstClear ?? {},
      daily: { ...emptyDaily(), ...(v.daily ?? {}) },
      travelSeen: v.travelSeen ?? {},
    };
  } catch {
    return { ...EMPTY, stars: {}, album: {}, firstClear: {}, daily: emptyDaily(), travelSeen: {} };
  }
}

export const webSave: SavePort = {
  async load(key) {
    try {
      return parse(localStorage.getItem(key));
    } catch {
      return { ...EMPTY, stars: {}, album: {} };
    }
  },
  async write(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
      /* quota or private mode */
    }
  },
  async loadRaw(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async writeRaw(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      /* quota or private mode */
    }
  },
};

export async function nativeSave(): Promise<SavePort> {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    return {
      async load(key) {
        const { value } = await Preferences.get({ key });
        return parse(value);
      },
      async write(key, data) {
        await Preferences.set({ key, value: JSON.stringify(data) });
      },
      async loadRaw(key) {
        return (await Preferences.get({ key })).value;
      },
      async writeRaw(key, value) {
        if (value === null) await Preferences.remove({ key });
        else await Preferences.set({ key, value });
      },
    };
  } catch {
    return webSave;
  }
}

export function mergeStars(old: boolean[] | undefined, next: boolean[]): boolean[] {
  const prev = old ?? [false, false, false];
  return next.map((v, i) => v || !!prev[i]);
}

export function mergeAlbum(old: "normal" | "gold" | undefined, gold: boolean): "normal" | "gold" {
  return old === "gold" || gold ? "gold" : "normal";
}
