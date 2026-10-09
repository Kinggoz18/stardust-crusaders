/** Small accessible note for metrics that are limited under Apple privacy rules. */
export function IosLimitedLabel({ detail }: { detail?: string }) {
  return (
    <span className="ios-limited" title={detail ?? "Uses first-party ids only on iOS; no advertising id."}>
      Limited on iOS
      <span className="sr-only">
        {detail
          ? ` ${detail}`
          : " Uses first-party anonymous ids only. No advertising identifier or fingerprinting."}
      </span>
    </span>
  );
}
