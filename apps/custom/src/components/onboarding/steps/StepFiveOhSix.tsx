"use client";

import { useState } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  FileDown,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
} from "lucide-react";
import { Button, Input, Label, Card, CardHeader, Badge } from "@/components/ui";

type ImporterNumberType = "EIN" | "SSN" | "CBP_ASSIGNED";
type EntityType = "US_CORPORATION" | "LLC" | "PARTNERSHIP" | "SOLE_PROPRIETORSHIP" | "FOREIGN";
type DeliveryMethod = "ACE_PORTAL" | "PAPER";

interface FiveOhSixOfficer {
  name: string;
  title: string;
  ssnLast4: string;
  dobLast4: string;
}

interface FiveOhSixAddress {
  line1: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
}

interface FiveOhSixPayload {
  action: "CREATE" | "UPDATE";
  importerNumberType: ImporterNumberType;
  importerNumber: string | null;
  legalName: string;
  tradeName: string | null;
  entityType: EntityType;
  programIndicator: "IR";
  naicsCode: string | null;
  relatedBusiness: boolean;
  officers: FiveOhSixOfficer[];
  physicalAddress: FiveOhSixAddress;
  mailingAddress: FiveOhSixAddress | null;
  contact: { name: string; phone: string; email: string };
  residentAgent: { name: string; address: string; phone: string } | null;
}

interface FiveOhSixRecord {
  id: string;
  status: string;
  deliveryMethod: string | null;
  transmissionRef: string | null;
  submittedAt: string | null;
  payload: FiveOhSixPayload;
}

interface Entity {
  id: string;
  importerNumberType: string;
  importerNumber: string | null;
  legalEntity: {
    legalName: string;
    entityType: string;
    taxIdentifier?: string | null;
  } | null;
}

interface Props {
  caseId: string;
  path: string;
  entities: Entity[];
  initialRecords: FiveOhSixRecord[];
  onSaved: () => void;
}

const STATUS_INFO: Record<string, { label: string; variant: "neutral" | "info" | "warning" | "success" | "danger" }> = {
  draft: { label: "Draft", variant: "neutral" },
  generated: { label: "PDF generated", variant: "info" },
  submitted: { label: "Submitted to CBP", variant: "warning" },
  accepted: { label: "Accepted by CBP", variant: "success" },
  rejected: { label: "Rejected by CBP", variant: "danger" },
  superseded: { label: "Superseded", variant: "neutral" },
};

function emptyAddress(): FiveOhSixAddress {
  return { line1: "", city: "", stateProvince: "", postalCode: "", country: "US" };
}

function emptyOfficer(): FiveOhSixOfficer {
  return { name: "", title: "", ssnLast4: "", dobLast4: "" };
}

function buildInitialPayload(entity: Entity): FiveOhSixPayload {
  return {
    action: "CREATE",
    importerNumberType: (entity.importerNumberType as ImporterNumberType) ?? "EIN",
    importerNumber: entity.importerNumber ?? null,
    legalName: entity.legalEntity?.legalName ?? "",
    tradeName: null,
    entityType: (entity.legalEntity?.entityType as EntityType) ?? "US_CORPORATION",
    programIndicator: "IR",
    naicsCode: null,
    relatedBusiness: false,
    officers: [emptyOfficer()],
    physicalAddress: emptyAddress(),
    mailingAddress: null,
    contact: { name: "", phone: "", email: "" },
    residentAgent: null,
  };
}

function AddressFields({
  value,
  onChange,
  prefix,
}: {
  value: FiveOhSixAddress;
  onChange: (v: FiveOhSixAddress) => void;
  prefix: string;
}) {
  function set(k: keyof FiveOhSixAddress, v: string) {
    onChange({ ...value, [k]: v });
  }
  return (
    <div className="space-y-2">
      <Input
        id={`${prefix}-line1`}
        placeholder="Street address"
        value={value.line1}
        onChange={(e) => set("line1", e.target.value)}
      />
      <div className="grid grid-cols-3 gap-2">
        <Input placeholder="City" value={value.city} onChange={(e) => set("city", e.target.value)} />
        <Input placeholder="State / Province" value={value.stateProvince} onChange={(e) => set("stateProvince", e.target.value)} />
        <Input placeholder="Postal code" value={value.postalCode} onChange={(e) => set("postalCode", e.target.value)} />
      </div>
      <Input placeholder="Country" value={value.country} onChange={(e) => set("country", e.target.value)} />
    </div>
  );
}

function OfficerBlock({
  officers,
  onChange,
}: {
  officers: FiveOhSixOfficer[];
  onChange: (v: FiveOhSixOfficer[]) => void;
}) {
  function update(i: number, k: keyof FiveOhSixOfficer, v: string) {
    const next = officers.map((o, idx) => (idx === i ? { ...o, [k]: v } : o));
    onChange(next);
  }
  function add() {
    onChange([...officers, emptyOfficer()]);
  }
  function remove(i: number) {
    onChange(officers.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-3">
      {officers.map((o, i) => (
        <div key={i} className="p-3 border rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-muted">Officer / Owner {i + 1}</span>
            {officers.length > 1 && (
              <button onClick={() => remove(i)} className="text-red-500 hover:text-red-700">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor={`off-name-${i}`}>Full name *</Label>
              <Input
                id={`off-name-${i}`}
                placeholder="Jane Smith"
                value={o.name}
                onChange={(e) => update(i, "name", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`off-title-${i}`}>Title *</Label>
              <Input
                id={`off-title-${i}`}
                placeholder="President / CEO"
                value={o.title}
                onChange={(e) => update(i, "title", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`off-ssn-${i}`}>SSN last 4 *</Label>
              <Input
                id={`off-ssn-${i}`}
                placeholder="1234"
                maxLength={4}
                value={o.ssnLast4}
                onChange={(e) => update(i, "ssnLast4", e.target.value.replace(/\D/g, ""))}
                className="font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`off-dob-${i}`}>DOB (MMDD) *</Label>
              <Input
                id={`off-dob-${i}`}
                placeholder="0115"
                maxLength={4}
                value={o.dobLast4}
                onChange={(e) => update(i, "dobLast4", e.target.value.replace(/\D/g, ""))}
                className="font-mono"
              />
            </div>
          </div>
        </div>
      ))}
      {officers.length < 3 && (
        <button
          onClick={add}
          className="flex items-center gap-1.5 text-xs text-brand hover:underline"
        >
          <Plus className="h-3.5 w-3.5" /> Add another officer / owner
        </button>
      )}
    </div>
  );
}

function RecordRow({
  record,
  caseId,
  onFiled,
}: {
  record: FiveOhSixRecord;
  caseId: string;
  onFiled: (updated: FiveOhSixRecord) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showFiledModal, setShowFiledModal] = useState(false);
  const [filedMethod, setFiledMethod] = useState<DeliveryMethod>("ACE_PORTAL");
  const [confirmationNumber, setConfirmationNumber] = useState("");
  const [filing, setFiling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const info = STATUS_INFO[record.status] ?? { label: record.status, variant: "neutral" as const };
  const canMarkFiled = record.status === "draft" || record.status === "generated";

  async function handleDownloadPdf() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/onboarding/cases/${caseId}/5106/${record.id}/pdf`);
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const name = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "5106.pdf";
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  async function handleMarkFiled() {
    if (filedMethod === "ACE_PORTAL" && !confirmationNumber.trim()) {
      setError("Confirmation number is required for ACE Portal filings");
      return;
    }
    setFiling(true);
    setError(null);
    try {
      const res = await fetch(`/api/onboarding/cases/${caseId}/5106/${record.id}/mark-filed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryMethod: filedMethod,
          confirmationNumber: confirmationNumber || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Failed");
      setShowFiledModal(false);
      onFiled(data.record);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setFiling(false);
    }
  }

  return (
    <div className="border rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">
            {record.payload.legalName} — {record.payload.action === "CREATE" ? "New registration" : "Update"}
          </div>
          {record.submittedAt && (
            <div className="text-xs text-ink-muted">
              Submitted {new Date(record.submittedAt).toLocaleDateString()} via{" "}
              {record.deliveryMethod?.replace("_", " ")}
              {record.transmissionRef && ` · Ref: ${record.transmissionRef}`}
            </div>
          )}
        </div>
        <Badge variant={info.variant} className="shrink-0 text-xs">
          {info.label}
        </Badge>
        <button
          onClick={() => setExpanded((x) => !x)}
          className="text-ink-muted hover:text-ink"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3 bg-surface-muted/40">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <div>
              <span className="text-ink-muted">Importer number: </span>
              {record.payload.importerNumber ?? <em className="text-ink-muted">CBP-assigned (pending)</em>}
            </div>
            <div>
              <span className="text-ink-muted">NAICS: </span>
              {record.payload.naicsCode ?? "—"}
            </div>
            <div>
              <span className="text-ink-muted">Related business: </span>
              {record.payload.relatedBusiness ? "Yes" : "No"}
            </div>
            <div>
              <span className="text-ink-muted">Officers: </span>
              {record.payload.officers.length}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={downloading}
            >
              <FileDown className="h-3.5 w-3.5 mr-1" />
              {downloading ? "Generating…" : "Download 5106 PDF"}
            </Button>

            {canMarkFiled && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowFiledModal(true)}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Mark filed
              </Button>
            )}

            <Button variant="secondary" size="sm" disabled title="ABI transmission requires certified 5106 chapter + filer credential">
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              Transmit via ABI
              <span className="ml-1 text-xs opacity-60">(not yet certified)</span>
            </Button>
          </div>

          {showFiledModal && (
            <div className="border rounded-xl p-4 bg-white space-y-3">
              <p className="text-sm font-medium">Mark 5106 as filed</p>
              <div className="flex gap-3">
                {(["ACE_PORTAL", "PAPER"] as DeliveryMethod[]).map((m) => (
                  <label key={m} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm cursor-pointer ${filedMethod === m ? "border-brand bg-brand/5" : ""}`}>
                    <input
                      type="radio"
                      name="deliveryMethod"
                      checked={filedMethod === m}
                      onChange={() => setFiledMethod(m)}
                    />
                    {m === "ACE_PORTAL" ? "Filed via ACE Portal" : "Filed via paper / mail"}
                  </label>
                ))}
              </div>
              {filedMethod === "ACE_PORTAL" && (
                <div className="space-y-1">
                  <Label htmlFor="confirmNum">ACE submission confirmation number *</Label>
                  <Input
                    id="confirmNum"
                    placeholder="ACE-XXXXXXXXXX"
                    value={confirmationNumber}
                    onChange={(e) => setConfirmationNumber(e.target.value)}
                  />
                </div>
              )}
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2 justify-end">
                <Button variant="secondary" size="sm" onClick={() => setShowFiledModal(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleMarkFiled} disabled={filing}>
                  {filing ? "Saving…" : "Confirm filed"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function StepFiveOhSix({ caseId, path, entities, initialRecords, onSaved }: Props) {
  const [records, setRecords] = useState<FiveOhSixRecord[]>(initialRecords);
  const [showForm, setShowForm] = useState(initialRecords.length === 0);
  const [selectedEntityId, setSelectedEntityId] = useState(entities[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedEntity = entities.find((e) => e.id === selectedEntityId) ?? entities[0];
  const [payload, setPayload] = useState<FiveOhSixPayload>(
    selectedEntity ? buildInitialPayload(selectedEntity) : buildInitialPayload({ id: "", importerNumberType: "EIN", importerNumber: null, legalEntity: null })
  );

  const anySubmitted = records.some((r) => r.status === "submitted" || r.status === "accepted");

  function setField<K extends keyof FiveOhSixPayload>(key: K, value: FiveOhSixPayload[K]) {
    setPayload((p) => ({ ...p, [key]: value }));
  }

  async function handleSave() {
    if (!payload.legalName.trim()) {
      setError("Legal name is required");
      return;
    }
    if (payload.officers.some((o) => !o.name || !o.ssnLast4 || o.ssnLast4.length !== 4)) {
      setError("Each officer must have a name and 4-digit SSN last 4");
      return;
    }
    if (!payload.physicalAddress.line1 || !payload.physicalAddress.city) {
      setError("Physical address is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/onboarding/cases/${caseId}/5106`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboardingEntityId: selectedEntityId || null, payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Failed to save");
      setRecords((r) => [...r, data.record]);
      setShowForm(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">CBP Form 5106</h2>
        <p className="text-sm text-ink-muted mt-1">
          Complete the importer identity form required by CBP before any entry can be filed.
          Generate the PDF, then file via ACE Portal or submit by paper. ABI transmission is available after ABI certification.
        </p>
      </div>

      {anySubmitted && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          At least one 5106 has been submitted — this step is complete. You can proceed to Step 3.
        </div>
      )}

      {records.length > 0 && (
        <div className="space-y-2">
          {records.map((r) => (
            <RecordRow
              key={r.id}
              record={r}
              caseId={caseId}
              onFiled={(updated) =>
                setRecords((rs) => rs.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)))
              }
            />
          ))}
        </div>
      )}

      {!showForm && (
        <Button variant="secondary" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1" />
          {records.length > 0 ? "Add another 5106 (additional entity)" : "Create 5106"}
        </Button>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            {records.length > 0 ? "Additional 5106" : "Complete CBP Form 5106"}
          </CardHeader>
          <div className="px-6 pb-6 space-y-5">
            {entities.length > 1 && (
              <div className="space-y-1">
                <Label htmlFor="entitySelect">Importing entity</Label>
                <select
                  id="entitySelect"
                  value={selectedEntityId}
                  onChange={(e) => {
                    setSelectedEntityId(e.target.value);
                    const ent = entities.find((x) => x.id === e.target.value);
                    if (ent) setPayload(buildInitialPayload(ent));
                  }}
                  className="w-full h-9 rounded-xl border border-border bg-white px-3 text-sm"
                >
                  {entities.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.legalEntity?.legalName ?? e.id} ({e.importerNumberType})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="action5106">Action</Label>
                <select
                  id="action5106"
                  value={payload.action}
                  onChange={(e) => setField("action", e.target.value as "CREATE" | "UPDATE")}
                  className="w-full h-9 rounded-xl border border-border bg-white px-3 text-sm"
                >
                  <option value="CREATE">Create — new importer identity</option>
                  <option value="UPDATE">Update — change existing record</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="naics">NAICS code</Label>
                <Input
                  id="naics"
                  placeholder="423840"
                  value={payload.naicsCode ?? ""}
                  onChange={(e) => setField("naicsCode", e.target.value || null)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="legalName5106">Legal name *</Label>
                <Input
                  id="legalName5106"
                  value={payload.legalName}
                  onChange={(e) => setField("legalName", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tradeName5106">Trade / DBA name</Label>
                <Input
                  id="tradeName5106"
                  value={payload.tradeName ?? ""}
                  onChange={(e) => setField("tradeName", e.target.value || null)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="relatedBusiness"
                checked={payload.relatedBusiness}
                onChange={(e) => setField("relatedBusiness", e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="relatedBusiness" className="cursor-pointer">
                Related business (importer is related to exporter / manufacturer)
              </Label>
            </div>

            <div className="border-t pt-4 space-y-2">
              <p className="text-sm font-medium">Physical address *</p>
              <AddressFields
                value={payload.physicalAddress}
                onChange={(v) => setField("physicalAddress", v)}
                prefix="phys"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="diffMailing"
                  checked={payload.mailingAddress !== null}
                  onChange={(e) =>
                    setField("mailingAddress", e.target.checked ? emptyAddress() : null)
                  }
                  className="rounded"
                />
                <Label htmlFor="diffMailing" className="cursor-pointer">
                  Mailing address is different from physical address
                </Label>
              </div>
              {payload.mailingAddress && (
                <AddressFields
                  value={payload.mailingAddress}
                  onChange={(v) => setField("mailingAddress", v)}
                  prefix="mail"
                />
              )}
            </div>

            <div className="border-t pt-4 space-y-2">
              <p className="text-sm font-medium">Contact information</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="contactName">Name</Label>
                  <Input
                    id="contactName"
                    value={payload.contact.name}
                    onChange={(e) => setField("contact", { ...payload.contact, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="contactPhone">Phone</Label>
                  <Input
                    id="contactPhone"
                    type="tel"
                    value={payload.contact.phone}
                    onChange={(e) => setField("contact", { ...payload.contact, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="contactEmail">Email</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={payload.contact.email}
                    onChange={(e) => setField("contact", { ...payload.contact, email: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {(path === "NON_RESIDENT" || payload.importerNumberType === "CBP_ASSIGNED") && (
              <div className="border-t pt-4 space-y-2">
                <p className="text-sm font-medium text-amber-700">US resident agent (required for non-resident importers)</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1">
                    <Label htmlFor="agentName">Agent name</Label>
                    <Input
                      id="agentName"
                      value={payload.residentAgent?.name ?? ""}
                      onChange={(e) =>
                        setField("residentAgent", {
                          name: e.target.value,
                          address: payload.residentAgent?.address ?? "",
                          phone: payload.residentAgent?.phone ?? "",
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="agentPhone">Phone</Label>
                    <Input
                      id="agentPhone"
                      type="tel"
                      value={payload.residentAgent?.phone ?? ""}
                      onChange={(e) =>
                        setField("residentAgent", {
                          name: payload.residentAgent?.name ?? "",
                          address: payload.residentAgent?.address ?? "",
                          phone: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="col-span-3 space-y-1">
                    <Label htmlFor="agentAddr">US address</Label>
                    <Input
                      id="agentAddr"
                      value={payload.residentAgent?.address ?? ""}
                      onChange={(e) =>
                        setField("residentAgent", {
                          name: payload.residentAgent?.name ?? "",
                          address: e.target.value,
                          phone: payload.residentAgent?.phone ?? "",
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="border-t pt-4 space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">Principal officers / owners *</p>
                <span className="text-xs text-ink-muted">(CBP requires at least one; SSN last 4 + DOB last 4)</span>
              </div>
              <OfficerBlock officers={payload.officers} onChange={(v) => setField("officers", v)} />
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex justify-between items-center">
              <Button variant="secondary" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save 5106 draft"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {records.length > 0 && anySubmitted && (
        <div className="flex justify-end">
          <Button onClick={onSaved}>Continue to Step 3 →</Button>
        </div>
      )}

      {records.length > 0 && !anySubmitted && (
        <p className="text-xs text-ink-muted">
          Download the PDF, submit it to CBP via ACE Portal or paper, then click "Mark filed" to advance this step.
          You can waive this step from the Review step if needed (requires compliance-override authority).
        </p>
      )}

      <div className="p-3 bg-surface-muted rounded-xl text-xs text-ink-muted space-y-1">
        <div className="flex items-center gap-1.5 font-medium">
          <Clock className="h-3.5 w-3.5" /> ABI transmission (coming in Phase 3)
        </div>
        <p>
          Direct ABI transmission of the 5106 CATAIR message will be available once the 5106 codec chapter is certified with CBP.
          Until then, generate the PDF and file via ACE Portal ({" "}
          <span className="font-mono">ace.cbp.dhs.gov</span>) or paper submission.
        </p>
      </div>
    </div>
  );
}
