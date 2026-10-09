import { useMemo, useState } from "react";
import { defaultMetricsFilters, filtersToQuery, type MetricsFilters } from "../lib/metrics-filters";

export function useMetricsFilters() {
  const [filters, setFilters] = useState<MetricsFilters>(() => defaultMetricsFilters());
  const query = useMemo(() => filtersToQuery(filters), [filters]);
  return { filters, setFilters, query };
}
