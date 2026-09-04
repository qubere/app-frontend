"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Check,
  ChevronRight,
  CirclePlus,
  Copy,
  KeyRound,
  Link2,
  Loader2,
  Plug,
  Radio,
  ShieldCheck,
  X,
} from "lucide-react";
import { TmsSidebar } from "@/components/TmsSidebar";
import { TmsHeader } from "@/components/TmsHeader";
import { Card, Button } from "@/components/ui";

interface ProviderDefinition {
  id: string;
  key: string;
  displayName: string;
  adapterKey: string;
  status: "ACTIVE" | "PREVIEW";
  authType: string;
  supportedModes: string[];
  capabilities: string[];
  documentationUrl?: string | null;
  operationalNotes?: string | null;
}

interface TrackingConnection {
  id: string;
  name: string;
  provider: string;
  status: "ACTIVE" | "INACTIVE" | "ERROR";
  clientId: string | null;
  clientName: string | null;
  environment: string;
  isDefault: boolean;
  callbackPath: string | null;
  hasCredentialRef: boolean;
  hasWebhookSecretRef: boolean;
  lastSyncAt: string | null;
  lastEventAt: string | null;
  lastHealthCheckAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  providerDefinition: ProviderDefinition | null;
}

interface ConnectionsResponse {
  accountName: string;
  providers: ProviderDefinition[];
  connections: TrackingConnection[];
  clients: Array<{ id: string; name: string }>;
}

function relativeTime(value: string | null): string {
  if (!value) return "Never";
  const milliseconds = new Date(value).getTime();
  if (!Number.isFinite(milliseconds)) return "Never";
  const minutes = Math.max(0, Math.round((Date.now() - milliseconds) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function Status({ value }: { value: TrackingConnection["status"] }) {
  const style = value === "ACTIVE"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : value === "ERROR"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : "border-slate-200 bg-slate-50 text-slate-700";
  return <span className={`rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${style}`}>{value}</span>;
}

export function IntegrationsClient() {
  const [data, setData] = useState<ConnectionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    providerDefinitionId: "",
    name: "",
    clientId: "",
    environment: "PRODUCTION" as "PRODUCTION" | "SANDBOX",
    baseUrl: "",
    webhookSecretRef: "",
    credentialRef: "",
    signatureMode: "HMAC_SHA256",
    isDefault: false,
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/tracking-connections", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? payload.error ?? "Unable to load connections.");
      setData(payload);
      setForm((current) => ({
        ...current,
        providerDefinitionId: current.providerDefinitionId || payload.providers[0]?.id || "",
      }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load connections.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const selectedProvider = useMemo(
    () => data?.providers.find((provider) => provider.id === form.providerDefinitionId) ?? null,
    [data?.providers, form.providerDefinitionId]
  );

  const createConnection = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/tracking-connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerDefinitionId: form.providerDefinitionId,
          name: form.name,
          clientId: form.clientId || null,
          environment: form.environment,
          baseUrl: form.baseUrl || null,
          webhookSecretRef: form.webhookSecretRef,
          credentialRef: form.credentialRef || null,
          isDefault: form.isDefault,
          configJson: { signatureMode: form.signatureMode },
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? payload.error ?? "Unable to create connection.");
      setShowForm(false);
      setForm((current) => ({
        ...current,
        name: "",
        clientId: "",
        baseUrl: "",
        webhookSecretRef: "",
        credentialRef: "",
        isDefault: false,
      }));
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to create connection.");
    } finally {
      setSaving(false);
    }
  };

  const copyCallback = async (connection: TrackingConnection) => {
    if (!connection.callbackPath) return;
    await navigator.clipboard.writeText(`${window.location.origin}${connection.callbackPath}`);
    setCopiedId(connection.id);
    window.setTimeout(() => setCopiedId(null), 1800);
  };

  const toggleConnection = async (connection: TrackingConnection) => {
    setUpdatingId(connection.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/tracking-connections/${connection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: connection.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? payload.error ?? "Unable to update connection.");
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update connection.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-surface-muted text-ink flex w-full">
      <TmsSidebar accountName={data?.accountName ?? "Workspace"} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TmsHeader tenantName={data?.accountName ?? "Workspace"} userName="Operations" />
        <main className="mx-auto w-full max-w-[1500px] flex-1 space-y-6 overflow-y-auto p-6 md:p-8">
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-brand/20 bg-brand/10">
                  <Plug className="h-4 w-4 text-brand" />
                </div>
                <h1 className="text-xl font-black tracking-tight text-ink">Shipment tracking connections</h1>
              </div>
              <p className="mt-1 text-xs font-medium text-ink-muted">Database-backed provider catalog, client-scoped connections, and Secret Manager references.</p>
            </div>
            <Button onClick={() => setShowForm(true)} disabled={!data?.providers.length} className="cursor-pointer bg-brand text-white">
              <CirclePlus className="h-4 w-4" />
              Add connection
            </Button>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-brand" /></div>
          ) : (
            <>
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-ink-muted">Configured connections ({data?.connections.length ?? 0})</h2>
                  <span className="text-[10px] font-semibold text-ink-muted">No credentials are stored or displayed here</span>
                </div>
                {data?.connections.length ? (
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {data.connections.map((connection) => (
                      <Card key={connection.id} className="space-y-4 rounded-2xl border border-border bg-white p-5 shadow-2xs">
                        <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-extrabold text-ink">{connection.name}</h3>
                              {connection.isDefault && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-extrabold uppercase text-brand">Default</span>}
                            </div>
                            <p className="mt-1 text-[11px] font-semibold text-ink-muted">{connection.providerDefinition?.displayName ?? connection.provider} · {connection.clientName ?? "Account-wide"}</p>
                          </div>
                          <Status value={connection.status} />
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-[9px] font-extrabold uppercase tracking-wider text-ink-muted">Last event</p>
                            <p className="mt-1 font-bold text-ink">{relativeTime(connection.lastEventAt)}</p>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-[9px] font-extrabold uppercase tracking-wider text-ink-muted">Secrets</p>
                            <p className="mt-1 font-bold text-ink">{connection.hasWebhookSecretRef ? "Referenced" : "Missing"}</p>
                          </div>
                        </div>
                        {connection.lastErrorMessage && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[11px] font-semibold text-rose-800">{connection.lastErrorMessage}</p>}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-[10px] font-semibold text-ink-muted">
                            <Radio className="h-3.5 w-3.5 text-brand" />
                            {connection.environment}
                          </div>
                          <div className="flex items-center gap-3">
                            <button type="button" disabled={updatingId === connection.id} onClick={() => void toggleConnection(connection)} className="text-xs font-bold text-ink-muted hover:text-ink disabled:opacity-50">
                              {updatingId === connection.id ? "Updating…" : connection.status === "ACTIVE" ? "Pause" : "Enable"}
                            </button>
                            <button type="button" onClick={() => void copyCallback(connection)} className="flex items-center gap-1.5 text-xs font-bold text-brand hover:underline">
                              {copiedId === connection.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                              {copiedId === connection.id ? "Copied" : "Copy webhook URL"}
                            </button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                    <Link2 className="mx-auto h-6 w-6 text-slate-500" />
                    <p className="mt-3 text-sm font-extrabold text-ink">No tracking connection configured</p>
                    <p className="mt-1 text-xs font-medium text-ink-muted">Choose a deployed provider adapter and bind it account-wide or to one client.</p>
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-ink-muted">Available provider adapters</h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {data?.providers.map((provider) => (
                    <Card key={provider.id} className="rounded-2xl border border-border bg-white p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-extrabold text-ink">{provider.displayName}</h3>
                          <p className="mt-1 font-mono text-[10px] font-semibold text-ink-muted">{provider.key}</p>
                        </div>
                        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase ${provider.status === "ACTIVE" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{provider.status}</span>
                      </div>
                      <p className="mt-3 text-[11px] font-medium leading-5 text-ink-muted">{provider.operationalNotes ?? "No operational notes provided."}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {provider.capabilities.map((capability) => <span key={capability} className="rounded-md bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-700">{capability.replaceAll("_", " ")}</span>)}
                      </div>
                      <button type="button" onClick={() => { setForm((current) => ({ ...current, providerDefinitionId: provider.id })); setShowForm(true); }} className="mt-4 flex items-center gap-1 text-xs font-bold text-brand hover:underline">
                        Configure <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </Card>
                  ))}
                </div>
              </section>
            </>
          )}
        </main>
      </div>

      {showForm && data && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <form onSubmit={createConnection} className="max-h-[92vh] w-full max-w-2xl space-y-5 overflow-y-auto rounded-2xl border border-border bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
              <div>
                <h2 className="text-base font-extrabold text-ink">Add tracking connection</h2>
                <p className="mt-1 text-xs font-medium text-ink-muted">Credentials stay in Secret Manager; this record stores references only.</p>
              </div>
              <button type="button" onClick={() => setShowForm(false)} className="text-ink-muted hover:text-ink"><X className="h-4 w-4" /></button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-xs font-bold text-ink">
                <span>Provider adapter</span>
                <select required value={form.providerDefinitionId} onChange={(event) => setForm({ ...form, providerDefinitionId: event.target.value })} className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-xs outline-none focus:border-brand">
                  {data.providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.displayName}{provider.status === "PREVIEW" ? " (Preview)" : ""}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-xs font-bold text-ink">
                <span>Connection name</span>
                <input required minLength={2} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Acme ocean visibility" className="w-full rounded-xl border border-border px-3 py-2.5 text-xs outline-none focus:border-brand" />
              </label>
              <label className="space-y-1.5 text-xs font-bold text-ink">
                <span>Client scope</span>
                <select value={form.clientId} onChange={(event) => setForm({ ...form, clientId: event.target.value })} className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-xs outline-none focus:border-brand">
                  <option value="">Account-wide</option>
                  {data.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-xs font-bold text-ink">
                <span>Environment</span>
                <select value={form.environment} onChange={(event) => setForm({ ...form, environment: event.target.value as "PRODUCTION" | "SANDBOX" })} className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-xs outline-none focus:border-brand">
                  <option value="PRODUCTION">Production</option><option value="SANDBOX">Sandbox</option>
                </select>
              </label>
              <label className="space-y-1.5 text-xs font-bold text-ink sm:col-span-2">
                <span className="flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5 text-brand" /> Webhook secret reference</span>
                <input required value={form.webhookSecretRef} onChange={(event) => setForm({ ...form, webhookSecretRef: event.target.value })} placeholder="projects/PROJECT/secrets/tracking-acme/versions/latest" className="w-full rounded-xl border border-border px-3 py-2.5 font-mono text-xs outline-none focus:border-brand" />
                <span className="block text-[10px] font-medium text-ink-muted">Full GCP Secret Manager resource or a short secret ID when GCP_PROJECT_ID is configured.</span>
              </label>
              <label className="space-y-1.5 text-xs font-bold text-ink sm:col-span-2">
                <span>Outbound credential reference (optional)</span>
                <input value={form.credentialRef} onChange={(event) => setForm({ ...form, credentialRef: event.target.value })} placeholder="projects/PROJECT/secrets/provider-api-key/versions/latest" className="w-full rounded-xl border border-border px-3 py-2.5 font-mono text-xs outline-none focus:border-brand" />
              </label>
              <label className="space-y-1.5 text-xs font-bold text-ink">
                <span>Signature mode</span>
                <select value={form.signatureMode} onChange={(event) => setForm({ ...form, signatureMode: event.target.value })} className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-xs outline-none focus:border-brand">
                  <option value="HMAC_SHA256">HMAC SHA-256</option><option value="BEARER">Bearer</option><option value="API_KEY">API key header</option>
                </select>
              </label>
              <label className="space-y-1.5 text-xs font-bold text-ink">
                <span>Provider base URL (optional)</span>
                <input type="url" value={form.baseUrl} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} placeholder="https://provider.example/api" className="w-full rounded-xl border border-border px-3 py-2.5 text-xs outline-none focus:border-brand" />
              </label>
            </div>

            {selectedProvider && (
              <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-[11px] font-medium text-blue-900">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{selectedProvider.adapterKey} · {selectedProvider.authType} · {selectedProvider.supportedModes.join(", ") || "Mode-neutral"}</span>
              </div>
            )}
            <label className="flex items-center gap-2 text-xs font-bold text-ink">
              <input type="checkbox" checked={form.isDefault} onChange={(event) => setForm({ ...form, isDefault: event.target.checked })} className="h-4 w-4 rounded border-border" />
              Use as the default tracking connection
            </label>

            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-brand text-white">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
                Create connection
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
