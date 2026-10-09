import { useOutletContext, useParams } from "react-router-dom";
import { parseGameId, type AdminGameId } from "../lib/games";
import { useMemo, useState } from "react";
import { defaultMetricsFilters, filtersToQuery, type MetricsFilters } from "../lib/metrics-filters";

export function useGameId(): AdminGameId {
  const ctx = useOutletContext<{ gameId: AdminGameId } | undefined>();
  const { game } = useParams();
  const fromParam = parseGameId(game);
  if (ctx?.gameId) return ctx.gameId;
  if (fromParam) return fromParam;
  throw new Error("Game dashboard missing game id");
}

/** Date/platform filters locked to the current game. */
export function useGameMetricsFilters(gameId: AdminGameId) {
  const [filters, setFilters] = useState<MetricsFilters>(() => ({
    ...defaultMetricsFilters(),
    gameId,
  }));
  const locked = useMemo(() => ({ ...filters, gameId }), [filters, gameId]);
  const query = useMemo(() => filtersToQuery(locked), [locked]);
  return {
    filters: locked,
    setFilters: (next: MetricsFilters) => setFilters({ ...next, gameId }),
    query,
  };
}
