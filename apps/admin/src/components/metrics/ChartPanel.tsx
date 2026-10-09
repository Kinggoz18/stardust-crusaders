import { useId, useState } from "react";

export type ChartRow = { label: string; value: number; hint?: string };

export function ChartPanel({
  title,
  caption,
  rows,
  emptyTitle = "Nothing here yet",
  emptyBody = "Numbers appear after players send events.",
}: {
  title: string;
  caption?: string;
  rows: ChartRow[];
  emptyTitle?: string;
  emptyBody?: string;
}) {
  const [mode, setMode] = useState<"chart" | "table">("chart");
  const tableId = useId();
  const max = Math.max(1, ...rows.map((r) => r.value));

  if (rows.length === 0) {
    return (
      <div className="metrics-panel">
        <h2 className="section-title">{title}</h2>
        <p className="empty-inline">
          <strong>{emptyTitle}</strong> {emptyBody}
        </p>
      </div>
    );
  }

  return (
    <div className="metrics-panel">
      <div className="metrics-panel-head">
        <h2 className="section-title">{title}</h2>
        <div className="view-toggle" role="group" aria-label={`Show ${title} as`}>
          <button
            type="button"
            className={mode === "chart" ? "active" : undefined}
            aria-pressed={mode === "chart"}
            onClick={() => setMode("chart")}
          >
            Chart
          </button>
          <button
            type="button"
            className={mode === "table" ? "active" : undefined}
            aria-pressed={mode === "table"}
            onClick={() => setMode("table")}
          >
            Table
          </button>
        </div>
      </div>
      {caption ? <p className="metrics-caption">{caption}</p> : null}

      {mode === "chart" ? (
        <ul className="chart-list" aria-label={title}>
          {rows.map((r) => {
            const width = Math.max(4, Math.round((r.value / max) * 100));
            return (
              <li key={r.label} className="chart-row">
                <div className="chart-label">
                  <span>{r.label}</span>
                  <strong>
                    {r.value}
                    {r.hint ? <span className="chart-hint"> {r.hint}</span> : null}
                  </strong>
                </div>
                <div className="chart-track" aria-hidden="true">
                  <div className="chart-fill" style={{ width: `${width}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="table-wrap" tabIndex={0}>
          <table id={tableId} className="data-table">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr>
                <th scope="col">Label</th>
                <th scope="col">Value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  <td>
                    {r.value}
                    {r.hint ? ` ${r.hint}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
