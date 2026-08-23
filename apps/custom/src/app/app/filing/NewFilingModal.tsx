"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, FileText, CheckCircle2, AlertTriangle, Loader2, Tag } from "lucide-react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select, Label, FormField } from "@/components/ui/Input";

interface Message {
  messageName: string;
  id: string;
}

interface Procedure {
  procedureCode: string;
  messages: Message[];
}

interface Country {
  country: string;
  procedures: Procedure[];
}

interface ProcedureOption {
  procedureCode: string;
  messageName: string;
  configId: string;
}

interface ReleaseResult {
  release: string;
  description: string;
  source: "customer" | "all";
}

interface NewFilingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewFilingModal({ isOpen, onClose }: NewFilingModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [availableOptions, setAvailableOptions] = useState<ProcedureOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<ProcedureOption | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Release state
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [release, setRelease] = useState<ReleaseResult | null>(null);
  const [releaseError, setReleaseError] = useState<string | null>(null);

  // Fetch available countries and procedures on open
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);

    fetch("/api/filing/procedures")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch procedures");
        return res.json();
      })
      .then((data) => setCountries(data.countries || []))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load filing procedures"))
      .finally(() => setLoading(false));
  }, [isOpen]);

  // Update available options when country changes
  useEffect(() => {
    if (!selectedCountry) {
      setAvailableOptions([]);
      setSelectedOption(null);
      return;
    }
    const country = countries.find((c) => c.country === selectedCountry);
    if (!country) { setAvailableOptions([]); setSelectedOption(null); return; }

    const options: ProcedureOption[] = [];
    country.procedures.forEach((proc) => {
      proc.messages.forEach((msg) => {
        options.push({ procedureCode: proc.procedureCode, messageName: msg.messageName, configId: msg.id });
      });
    });
    setAvailableOptions(options);
    setSelectedOption(null);
  }, [selectedCountry, countries]);

  // â”€â”€ Fetch release when selection changes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!selectedOption || !selectedCountry) {
      setRelease(null);
      setReleaseError(null);
      return;
    }

    setReleaseLoading(true);
    setRelease(null);
    setReleaseError(null);

    const params = new URLSearchParams({
      country: selectedCountry,
      procedureCode: selectedOption.procedureCode,
      messageName: selectedOption.messageName,
    });

    fetch(`/api/filing/release?${params}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || "No release configured for this selection");
        }
        setRelease(data as ReleaseResult);
      })
      .catch((err) => {
        setReleaseError(err instanceof Error ? err.message : "Unable to determine release version");
      })
      .finally(() => setReleaseLoading(false));
  }, [selectedOption, selectedCountry]);

  function handleCreate() {
    if (!selectedOption || !selectedCountry || !release) return;

    const params = new URLSearchParams({
      country: selectedCountry,
      procedure: selectedOption.procedureCode,
      message: selectedOption.messageName,
      release: release.release,
    });

    router.push(`/app/filing/new?${params.toString()}`);
    onClose();
  }

  function handleReset() {
    setSelectedCountry("");
    setSelectedOption(null);
    setRelease(null);
    setReleaseError(null);
    setError(null);
  }

  const canCreate = !!selectedOption && !!release && !releaseLoading;

  return (
    <Modal isOpen={isOpen} onClose={onClose} titleId="new-filing-title" size="lg">
      <ModalHeader
        titleId="new-filing-title"
        title="Create New Filing"
        subtitle="Select country, procedure, and message type"
        icon={<FileText className="w-5 h-5" />}
        onClose={onClose}
      />

      <ModalBody>
        {loading ? (
          <div className="py-12 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full mx-auto"></div>
            <p className="text-sm text-ink-muted mt-4">Loading filing procedures...</p>
          </div>
        ) : error && countries.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Step 1: Select Country */}
            <FormField>
              <Label htmlFor="country">
                <Globe className="w-4 h-4 inline mr-1.5" />
                Destination Country
              </Label>
              <Select
                id="country"
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
              >
                <option value="">-- Select Country --</option>
                {countries.map((c) => (
                  <option key={c.country} value={c.country}>{c.country}</option>
                ))}
              </Select>
            </FormField>

            {/* Step 2: Select Procedure & Message */}
            {selectedCountry && availableOptions.length > 0 && (
              <div>
                <Label>Available Procedures and Messages</Label>
                <div className="mt-2 border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-muted border-b border-border">
                      <tr>
                        <th className="text-left py-2 px-3 font-bold text-ink-muted">Select</th>
                        <th className="text-left py-2 px-3 font-bold text-ink-muted">Procedure</th>
                        <th className="text-left py-2 px-3 font-bold text-ink-muted">Message</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {availableOptions.map((opt, idx) => {
                        const isSelected =
                          selectedOption?.procedureCode === opt.procedureCode &&
                          selectedOption?.messageName === opt.messageName;
                        return (
                          <tr
                            key={`${opt.procedureCode}-${opt.messageName}-${idx}`}
                            onClick={() => setSelectedOption(opt)}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? "bg-brand/5 hover:bg-brand/10" : "hover:bg-surface-muted"
                            }`}
                          >
                            <td className="py-2 px-3">
                              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                isSelected ? "border-brand bg-brand text-white" : "border-border"
                              }`}>
                                {isSelected && <CheckCircle2 className="w-3 h-3" />}
                              </div>
                            </td>
                            <td className="py-2 px-3 font-semibold text-ink">{opt.procedureCode}</td>
                            <td className="py-2 px-3 text-ink">{opt.messageName}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {selectedCountry && availableOptions.length === 0 && (
              <div className="py-8 text-center text-sm text-ink-muted">
                No procedures configured for {selectedCountry}
              </div>
            )}

            {/* Step 3: Release status */}
            {selectedOption && (
              <div>
                {releaseLoading && (
                  <div className="flex items-center gap-2 text-xs text-ink-muted bg-gray-50 border border-border rounded-lg px-4 py-3">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Checking release versionâ€¦
                  </div>
                )}

                {!releaseLoading && releaseError && (
                  <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-800">No Release Configured</p>
                      <p className="text-xs text-red-700 mt-1">{releaseError}</p>
                      <p className="text-xs text-red-600 mt-1">
                        Please contact your administrator to configure a release version for{" "}
                        <strong>{selectedCountry} Â· {selectedOption.procedureCode} Â· {selectedOption.messageName}</strong>.
                      </p>
                    </div>
                  </div>
                )}

                {!releaseLoading && release && (
                  <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                    <Tag className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-green-800">Release Confirmed</p>
                      <p className="text-sm font-bold text-green-900 font-mono mt-0.5">{release.description}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && (
              <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {error}
              </p>
            )}
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <div className="flex items-center justify-between w-full">
          <Button onClick={handleReset} variant="ghost">Reset</Button>
          <div className="flex gap-3">
            <Button onClick={onClose} variant="outline">Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={!canCreate}
              title={releaseError ? "Cannot create filing: no release configured" : undefined}
            >
              Create Filing
            </Button>
          </div>
        </div>
      </ModalFooter>
    </Modal>
  );
}

interface Message {
  messageName: string;
  id: string;
}

interface Procedure {
  procedureCode: string;
  messages: Message[];
}

interface Country {
  country: string;
  procedures: Procedure[];
}

interface ProcedureOption {
  procedureCode: string;
  messageName: string;
  configId: string;
}

interface NewFilingModalProps {
  isOpen: boolean;
  onClose: () => void;
}
