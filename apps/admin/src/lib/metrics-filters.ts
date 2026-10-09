export type MetricsFilters = {
  gameId: string;
  platform: string;
  from: string;
  to: string;
};

export function defaultMetricsFilters(): MetricsFilters {
  const to = new Date();
  const from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  from.setUTCDate(from.getUTCDate() - 13);
  return {
    gameId: "",
    platform: "",
    from: from.toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
  };
}

export function filtersToQuery(f: MetricsFilters): string {
  const params = new URLSearchParams();
  params.set("from", f.from);
  params.set("to", f.to);
  if (f.gameId) params.set("gameId", f.gameId);
  if (f.platform) params.set("platform", f.platform);
  return params.toString();
}

export function pct(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${Math.round(value * 100)}%`;
}

export function num(value: number | null | undefined): string {
  if (value == null) return "—";
  return String(Math.round(value * 100) / 100);
}
