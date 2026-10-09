import type { ProgressAdminSummary } from "@stardust/schema";

export function ProgressSummary({ summary }: { summary: ProgressAdminSummary }) {
  return (
    <div className="progress-summary">
      <div className="progress-summary-meta">
        <p>
          Save {summary.revision}
          {summary.draft ? (
            <>
              {" "}
              · <span className="badge draft">Draft schema</span>
            </>
          ) : (
            <>
              {" "}
              · <span className="badge live">Live</span>
            </>
          )}
        </p>
      </div>
      <dl className="facts wide">
        {summary.rows.map((row) => (
          <div key={row.path}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
