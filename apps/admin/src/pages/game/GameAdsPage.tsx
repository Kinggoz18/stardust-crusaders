import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../../lib/api";
import { num, pct } from "../../lib/metrics-filters";
import { useAuth } from "../../lib/auth";
import { GAME_IDS, GAME_LABELS, gamePath, roleAtLeast, type AdminGameId } from "../../lib/games";
import { useGameId, useGameMetricsFilters } from "../../hooks/useGameDashboard";
import { GameFilters } from "../../components/game/GameFilters";
import { IosLimitedLabel } from "../../components/IosLimitedLabel";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { EmptyState, ErrorState, SkeletonList } from "../../components/States";

type Settings = Awaited<ReturnType<typeof api.gameAdsSettings>>;
type HouseList = Awaited<ReturnType<typeof api.houseAds>>;

export function GameAdsPage() {
  const gameId = useGameId();
  const auth = useAuth();
  const { filters, setFilters, query } = useGameMetricsFilters(gameId);
  const [tab, setTab] = useState<"metrics" | "controls" | "house">("controls");
  const [data, setData] = useState<Awaited<ReturnType<typeof api.metricsAds>> | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [house, setHouse] = useState<HouseList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<null | "enable-global" | "kill">(null);

  useEffect(() => {
    if (!roleAtLeast(auth.role, "support")) return;
    let cancelled = false;
    setError(null);
    void Promise.all([
      api.metricsAds(query),
      api.gameAdsSettings(gameId),
      api.houseAds(),
    ])
      .then(([m, s, h]) => {
        if (cancelled) return;
        setData(m);
        setSettings(s);
        setHouse(h);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [query, auth.role, gameId]);

  if (!roleAtLeast(auth.role, "support")) {
    return <Navigate to={gamePath(gameId)} replace />;
  }

  async function saveSettings(next: Settings) {
    setSaving(true);
    setError(null);
    try {
      const saved = await api.updateGameAdsSettings(gameId, {
        interstitial: next.interstitial,
        rewarded: next.rewarded,
        houseAdsGameEnabled: next.houseAdsGameEnabled,
      });
      setSettings(saved);
      const h = await api.houseAds();
      setHouse(h);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save ad settings.");
    } finally {
      setSaving(false);
    }
  }

  async function runGlobal(payload: { enabled?: boolean; killSwitch?: boolean }) {
    setSaving(true);
    setError(null);
    try {
      const h = await api.updateHouseAdsGlobal(payload);
      setHouse(h);
      setConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update house ads.");
    } finally {
      setSaving(false);
    }
  }

  const emptyMetrics =
    data &&
    data.rewardedOffers === 0 &&
    data.rewardedStarts === 0 &&
    data.interstitialImpressions === 0 &&
    data.iapPurchasers === 0;

  return (
    <div className="game-section">
      <h2 className="section-title">Ads</h2>
      <p className="metrics-caption">
        Network ads, frequency, unit ids, and own-game house ads for this title.{" "}
        <IosLimitedLabel />
      </p>

      <div className="view-toggle" role="group" aria-label="Ads sections">
        <button
          type="button"
          className={tab === "controls" ? "active" : undefined}
          aria-pressed={tab === "controls"}
          onClick={() => setTab("controls")}
        >
          Controls
        </button>
        <button
          type="button"
          className={tab === "house" ? "active" : undefined}
          aria-pressed={tab === "house"}
          onClick={() => setTab("house")}
        >
          House ads
        </button>
        <button
          type="button"
          className={tab === "metrics" ? "active" : undefined}
          aria-pressed={tab === "metrics"}
          onClick={() => setTab("metrics")}
        >
          Results
        </button>
      </div>

      {settings && !settings.environment.clientAdsEnabled ? (
        <p className="banner" role="status">
          {settings.environment.bannerMessage ?? "Ads are off in development."}
        </p>
      ) : null}

      {error ? <ErrorState message={error} /> : null}
      {!error && !settings ? <SkeletonList rows={4} /> : null}

      {tab === "controls" && settings ? (
        <ControlsForm
          settings={settings}
          saving={saving}
          readOnly={!settings.environment.clientAdsEnabled}
          onSave={(next) => void saveSettings(next)}
        />
      ) : null}

      {tab === "house" && house && settings ? (
        <HouseAdsPanel
          gameId={gameId}
          house={house}
          gameEnabled={settings.houseAdsGameEnabled}
          isOwner={auth.role === "owner"}
          saving={saving}
          readOnly={!settings.environment.clientAdsEnabled}
          onToggleGame={(enabled) =>
            void saveSettings({ ...settings, houseAdsGameEnabled: enabled })
          }
          onAskEnableGlobal={() => setConfirm("enable-global")}
          onAskKill={() => setConfirm("kill")}
          onClearKill={() => void runGlobal({ killSwitch: false })}
          onCreated={async () => setHouse(await api.houseAds())}
        />
      ) : null}

      {tab === "metrics" ? (
        <>
          <GameFilters filters={filters} onChange={setFilters} />
          {!error && !data ? <SkeletonList rows={3} /> : null}
          {emptyMetrics ? (
            <EmptyState
              title="No ad or purchase activity"
              body="These numbers fill in from events and store webhooks."
            />
          ) : null}
          {data && !emptyMetrics ? (
            <dl className="facts wide metrics-kpis" aria-label="Ads and revenue">
              <div>
                <dt>Rewarded offers</dt>
                <dd>{data.rewardedOffers}</dd>
              </div>
              <div>
                <dt>Completions</dt>
                <dd>{data.rewardedCompletions}</dd>
              </div>
              <div>
                <dt>Completion rate</dt>
                <dd>{pct(data.completionRate)}</dd>
              </div>
              <div>
                <dt>Interstitials / session</dt>
                <dd>{num(data.interstitialPerSession)}</dd>
              </div>
              <div>
                <dt>
                  Ad revenue / player <IosLimitedLabel />
                </dt>
                <dd>
                  {data.arpdauPending ? (
                    <span className="collecting">Waiting on ad network reports</span>
                  ) : (
                    num(data.arpdau)
                  )}
                </dd>
              </div>
            </dl>
          ) : null}
        </>
      ) : null}

      {confirm === "enable-global" ? (
        <ConfirmDialog
          title="Turn on house ads for the studio?"
          body="House ads stay off until you confirm. Each game still needs its own switch. Only our titles can be promoted."
          confirmLabel="Turn on house ads"
          pending={saving}
          onCancel={() => setConfirm(null)}
          onConfirm={() => void runGlobal({ enabled: true })}
        />
      ) : null}
      {confirm === "kill" ? (
        <ConfirmDialog
          title="Stop all house ads now?"
          body="This kill switch turns house ads off instantly for every game."
          confirmLabel="Stop house ads"
          danger
          pending={saving}
          onCancel={() => setConfirm(null)}
          onConfirm={() => void runGlobal({ killSwitch: true })}
        />
      ) : null}
    </div>
  );
}

function ControlsForm({
  settings,
  saving,
  readOnly,
  onSave,
}: {
  settings: Settings;
  saving: boolean;
  readOnly: boolean;
  onSave: (next: Settings) => void;
}) {
  const [draft, setDraft] = useState(settings);
  useEffect(() => setDraft(settings), [settings]);

  return (
    <form
      className="ad-controls-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!readOnly) onSave(draft);
      }}
    >
      <fieldset disabled={readOnly}>
        <legend>Interstitial</legend>
        <label className="check-row">
          <input
            type="checkbox"
            checked={draft.interstitial.enabled}
            disabled={readOnly}
            onChange={(e) =>
              setDraft({
                ...draft,
                interstitial: { ...draft.interstitial, enabled: e.target.checked },
              })
            }
          />
          Enabled
        </label>
        <label>
          Min level transitions
          <input
            type="number"
            min={1}
            disabled={readOnly}
            value={draft.interstitial.minTransitions}
            onChange={(e) =>
              setDraft({
                ...draft,
                interstitial: {
                  ...draft.interstitial,
                  minTransitions: Number(e.target.value),
                },
              })
            }
          />
        </label>
        <label>
          Max level transitions
          <input
            type="number"
            min={1}
            value={draft.interstitial.maxTransitions}
            onChange={(e) =>
              setDraft({
                ...draft,
                interstitial: {
                  ...draft.interstitial,
                  maxTransitions: Number(e.target.value),
                },
              })
            }
          />
        </label>
        <label>
          Max per session
          <input
            type="number"
            min={1}
            value={draft.interstitial.maxPerSession}
            onChange={(e) =>
              setDraft({
                ...draft,
                interstitial: {
                  ...draft.interstitial,
                  maxPerSession: Number(e.target.value),
                },
              })
            }
          />
        </label>
        <label>
          Ad unit id
          <input
            value={draft.interstitial.unitId}
            onChange={(e) =>
              setDraft({
                ...draft,
                interstitial: { ...draft.interstitial, unitId: e.target.value },
              })
            }
          />
        </label>
      </fieldset>

      <fieldset disabled={readOnly}>
        <legend>Rewarded</legend>
        <label className="check-row">
          <input
            type="checkbox"
            checked={draft.rewarded.enabled}
            disabled={readOnly}
            onChange={(e) =>
              setDraft({
                ...draft,
                rewarded: { ...draft.rewarded, enabled: e.target.checked },
              })
            }
          />
          Enabled
        </label>
        <label>
          Max per session
          <input
            type="number"
            min={1}
            value={draft.rewarded.maxPerSession}
            onChange={(e) =>
              setDraft({
                ...draft,
                rewarded: { ...draft.rewarded, maxPerSession: Number(e.target.value) },
              })
            }
          />
        </label>
        <label>
          Ad unit id
          <input
            value={draft.rewarded.unitId}
            onChange={(e) =>
              setDraft({
                ...draft,
                rewarded: { ...draft.rewarded, unitId: e.target.value },
              })
            }
          />
        </label>
      </fieldset>

      <button type="submit" disabled={saving || readOnly}>
        {saving ? "Saving…" : "Save ad controls"}
      </button>
    </form>
  );
}

function HouseAdsPanel({
  gameId,
  house,
  gameEnabled,
  isOwner,
  saving,
  onToggleGame,
  onAskEnableGlobal,
  onAskKill,
  onClearKill,
  onCreated,
  readOnly,
}: {
  gameId: AdminGameId;
  house: HouseList;
  gameEnabled: boolean;
  isOwner: boolean;
  saving: boolean;
  readOnly: boolean;
  onToggleGame: (enabled: boolean) => void;
  onAskEnableGlobal: () => void;
  onAskKill: () => void;
  onClearKill: () => void;
  onCreated: () => Promise<void>;
}) {
  const [promoted, setPromoted] = useState<AdminGameId>(
    GAME_IDS.find((g) => g !== gameId) ?? "one-spark",
  );
  const [creative, setCreative] = useState("bundle://demo");
  const [pending, setPending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const targets = GAME_IDS.filter((g) => g !== promoted);

  return (
    <div className="house-ads-panel">
      <dl className="facts wide metrics-kpis" aria-label="House ad switches">
        <div>
          <dt>Studio switch</dt>
          <dd>{house.global.enabled ? "On" : "Off"}</dd>
        </div>
        <div>
          <dt>Kill switch</dt>
          <dd>{house.global.killSwitch ? "Active" : "Clear"}</dd>
        </div>
        <div>
          <dt>This game</dt>
          <dd>{gameEnabled ? "On" : "Off"}</dd>
        </div>
      </dl>

      <div className="toolbar house-actions">
        <label className="check-row">
          <input
            type="checkbox"
            checked={gameEnabled}
            disabled={saving || readOnly}
            onChange={(e) => onToggleGame(e.target.checked)}
          />
          Allow house ads in {GAME_LABELS[gameId]}
        </label>
        {isOwner && !house.global.enabled ? (
          <button type="button" onClick={onAskEnableGlobal} disabled={saving || readOnly}>
            Turn on for studio
          </button>
        ) : null}
        {!house.global.killSwitch ? (
          <button type="button" className="danger" onClick={onAskKill} disabled={saving || readOnly}>
            Kill switch
          </button>
        ) : (
          <button type="button" onClick={onClearKill} disabled={saving || readOnly}>
            Clear kill switch
          </button>
        )}
      </div>

      <p className="metrics-caption">
        House ads promote only our games, never this title inside itself, only at natural breaks,
        never right after another ad, and only with analytics consent.
      </p>

      <form
        className="ad-controls-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (readOnly) return;
          setPending(true);
          setLocalError(null);
          void api
            .createHouseAd({
              promotedGame: promoted,
              creativeRef: creative,
              targetGames: targets.includes(gameId) ? [gameId] : targets.slice(0, 1),
              enabled: true,
              maxPerSession: 1,
            })
            .then(() => onCreated())
            .catch((err: Error) => setLocalError(err.message))
            .finally(() => setPending(false));
        }}
      >
        <fieldset disabled={readOnly}>
          <legend>New house ad for this game</legend>
          <label>
            Promoted game
            <select
              value={promoted}
              onChange={(e) => setPromoted(e.target.value as AdminGameId)}
            >
              {GAME_IDS.filter((g) => g !== gameId).map((g) => (
                <option key={g} value={g}>
                  {GAME_LABELS[g]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Creative / bundle reference
            <input value={creative} onChange={(e) => setCreative(e.target.value)} required />
          </label>
          <button type="submit" disabled={pending || readOnly}>
            {pending ? "Adding…" : "Add house ad"}
          </button>
        </fieldset>
      </form>
      {localError ? <ErrorState message={localError} /> : null}

      {house.items.length === 0 ? (
        <EmptyState title="No house ads yet" body="Add a playable that promotes another of our games." />
      ) : (
        <div className="table-wrap" tabIndex={0}>
          <table className="data-table">
            <caption className="sr-only">House ads</caption>
            <thead>
              <tr>
                <th scope="col">Promotes</th>
                <th scope="col">Shows in</th>
                <th scope="col">Creative</th>
                <th scope="col">On</th>
              </tr>
            </thead>
            <tbody>
              {house.items.map((item) => (
                <tr key={item.id}>
                  <th scope="row">{GAME_LABELS[item.promotedGame as AdminGameId]}</th>
                  <td>{item.targetGames.map((g) => GAME_LABELS[g as AdminGameId]).join(", ")}</td>
                  <td>{item.creativeRef}</td>
                  <td>{item.enabled ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
