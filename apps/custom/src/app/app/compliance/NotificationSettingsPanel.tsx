"use client";

import { useState } from "react";
import { Mail, Info, ShieldAlert } from "lucide-react";

interface NotificationSettings {
  rpsEmailAlertsEnabled: boolean;
  rpsGeneralRecipients: string[];
  rpsHitRecipients: string[];
  rpsPalRescreenRecipients: string[];
  rpsEmailFormat: "HTML" | "TEXT";
  rpsSecureEmailEnabled: boolean;
  rpsSuppressEmailAlerts: boolean;
}

interface NotificationSettingsPanelProps {
  initialSettings: NotificationSettings;
  mayManage: boolean;
}

function toLines(recipients: string[]): string {
  return recipients.join("\n");
}

function fromLines(text: string): string[] {
  return text
    .split(/[\n,;]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

export function NotificationSettingsPanel({ initialSettings, mayManage }: NotificationSettingsPanelProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [generalText, setGeneralText] = useState(toLines(initialSettings.rpsGeneralRecipients));
  const [hitText, setHitText] = useState(toLines(initialSettings.rpsHitRecipients));
  const [palText, setPalText] = useState(toLines(initialSettings.rpsPalRescreenRecipients));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async (overrides: Partial<NotificationSettings> = {}) => {
    setSaving(true);
    setError(null);
    setSaved(false);
    const payload = {
      rpsEmailAlertsEnabled: settings.rpsEmailAlertsEnabled,
      rpsGeneralRecipients: fromLines(generalText),
      rpsHitRecipients: fromLines(hitText),
      rpsPalRescreenRecipients: fromLines(palText),
      rpsEmailFormat: settings.rpsEmailFormat,
      rpsSecureEmailEnabled: settings.rpsSecureEmailEnabled,
      rpsSuppressEmailAlerts: settings.rpsSuppressEmailAlerts,
      ...overrides,
    };
    try {
      const res = await fetch("/api/compliance/restricted-party-screening/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to save notification settings");
      setSettings(body.settings);
      setGeneralText(toLines(body.settings.rpsGeneralRecipients));
      setHitText(toLines(body.settings.rpsHitRecipients));
      setPalText(toLines(body.settings.rpsPalRescreenRecipients));
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save notification settings");
    } finally {
      setSaving(false);
    }
  };

  const toggleAlertsEnabled = (next: boolean) => {
    setSettings((s) => ({ ...s, rpsEmailAlertsEnabled: next }));
    save({ rpsEmailAlertsEnabled: next });
  };

  if (!mayManage) {
    return (
      <div className="rounded-2xl border border-border bg-white p-5 shadow-2xs text-sm text-ink-muted">
        You do not have permission to manage Restricted Party Screening email notification settings.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Mail className="w-5 h-5 text-brand" />
        <h2 className="text-base font-extrabold text-ink">Email Notifications</h2>
      </div>
      <p className="text-sm text-ink-muted flex items-start gap-2">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-ink-muted" />
        Configure who is emailed when Restricted Party Screening produces a hit, review-required exception, or a
        pre-approved party fails re-screening. Delivery is asynchronous and retried on transient failures.
      </p>

      {error && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</div>}
      {saved && !error && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3">
          Notification settings saved.
        </div>
      )}

      <label className="flex items-center gap-3 cursor-pointer bg-white border border-border rounded-2xl p-4 shadow-2xs">
        <input
          type="checkbox"
          checked={settings.rpsEmailAlertsEnabled}
          onChange={(e) => toggleAlertsEnabled(e.target.checked)}
          disabled={saving}
          className="w-4 h-4 rounded border-border text-brand focus:ring-brand cursor-pointer"
        />
        <div>
          <span className="text-sm font-semibold text-ink">Enable RPS email alerts</span>
          <p className="text-[11px] text-ink-muted">
            When disabled, no Restricted Party Screening emails are sent for this account.
          </p>
        </div>
      </label>

      <div className="bg-white border border-border rounded-2xl p-5 shadow-2xs space-y-4">
        <p className="text-sm font-bold text-ink">Recipients</p>
        <p className="text-[11px] text-ink-muted">One address per line (commas and semicolons also accepted).</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="text-xs font-semibold text-ink space-y-1">
            <span>General recipients</span>
            <p className="text-[10px] font-normal text-ink-muted">Used for Party Master re-screen exceptions.</p>
            <textarea
              value={generalText}
              onChange={(e) => setGeneralText(e.target.value)}
              rows={4}
              placeholder="compliance@example.com"
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-border bg-white text-ink font-medium"
            />
          </label>
          <label className="text-xs font-semibold text-ink space-y-1">
            <span>RPS hit / review recipients</span>
            <p className="text-[10px] font-normal text-ink-muted">Used for RPS_HIT and RPS_REVIEW_REQUIRED alerts.</p>
            <textarea
              value={hitText}
              onChange={(e) => setHitText(e.target.value)}
              rows={4}
              placeholder="trade-compliance@example.com"
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-border bg-white text-ink font-medium"
            />
          </label>
          <label className="text-xs font-semibold text-ink space-y-1">
            <span>PAL re-screen recipients</span>
            <p className="text-[10px] font-normal text-ink-muted">
              Used when a previously pre-approved party fails re-screening.
            </p>
            <textarea
              value={palText}
              onChange={(e) => setPalText(e.target.value)}
              rows={4}
              placeholder="pal-review@example.com"
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-border bg-white text-ink font-medium"
            />
          </label>
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => save()}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand-hover transition-colors disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Saving…" : "Save recipients"}
          </button>
        </div>
      </div>

      <div className="bg-white border border-border rounded-2xl p-5 shadow-2xs space-y-4">
        <p className="text-sm font-bold text-ink">Delivery options</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-ink">Email format</span>
            <div className="flex items-center gap-4">
              {(["HTML", "TEXT"] as const).map((fmt) => (
                <label key={fmt} className="flex items-center gap-1.5 text-xs font-medium text-ink cursor-pointer">
                  <input
                    type="radio"
                    name="rpsEmailFormat"
                    checked={settings.rpsEmailFormat === fmt}
                    onChange={() => {
                      setSettings((s) => ({ ...s, rpsEmailFormat: fmt }));
                      save({ rpsEmailFormat: fmt });
                    }}
                    disabled={saving}
                    className="w-3.5 h-3.5 text-brand focus:ring-brand cursor-pointer"
                  />
                  {fmt}
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.rpsSecureEmailEnabled}
              onChange={(e) => {
                const next = e.target.checked;
                setSettings((s) => ({ ...s, rpsSecureEmailEnabled: next }));
                save({ rpsSecureEmailEnabled: next });
              }}
              disabled={saving}
              className="w-4 h-4 mt-0.5 rounded border-border text-brand focus:ring-brand cursor-pointer"
            />
            <div>
              <span className="text-xs font-semibold text-ink">Secure mode (PII-free emails)</span>
              <p className="text-[10px] text-ink-muted">
                Omits screened party name, address, and match details from the email body; recipients must log in
                to review the exception.
              </p>
            </div>
          </label>
        </div>

        <label className="flex items-start gap-2 cursor-pointer border-t border-border pt-4">
          <input
            type="checkbox"
            checked={settings.rpsSuppressEmailAlerts}
            onChange={(e) => {
              const next = e.target.checked;
              setSettings((s) => ({ ...s, rpsSuppressEmailAlerts: next }));
              save({ rpsSuppressEmailAlerts: next });
            }}
            disabled={saving}
            className="w-4 h-4 mt-0.5 rounded border-border text-red-600 focus:ring-red-500 cursor-pointer"
          />
          <div>
            <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
              Suppress all RPS email alerts
            </span>
            <p className="text-[10px] text-ink-muted">
              Administrative override — screening results are still recorded and auditable, but no emails are sent
              while this is enabled, regardless of the settings above.
            </p>
          </div>
        </label>
      </div>

      <p className="text-[11px] text-ink-muted">
        Email delivery provider: configured by platform administrator.
      </p>
    </div>
  );
}
