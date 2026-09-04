"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Package, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardHeader, CardHeaderIcon } from "@/components/ui/Card";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Select, Label, FormField } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { ImporterPicker, type ImporterOption } from "@/components/importers/ImporterPicker";
import { COUNTRIES } from "@/modules/shipment/countryCode";

export default function NewShipmentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImporter, setSelectedImporter] = useState<ImporterOption | null>(null);
  const [clientScope, setClientScope] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    importerOfRecordId: "",
    entryType: "",
    destinationCountry: "",
  });

  useEffect(() => {
    setClientScope(new URLSearchParams(window.location.search).get("clientId"));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedImporter) {
      setError("Choose the importer of record before initializing the shipment.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || data.error || "Failed to create shipment");
      }

      const shipmentId = data.shipment?.id;
      if (shipmentId) {
        router.push(`/app/shipments/${shipmentId}`);
      } else {
        router.push("/app/shipments");
      }
      // Note: Keep loading true while router.push performs transition so user sees transitioning state
    } catch (err: unknown) {
      console.error("Error creating shipment:", err);
      setError(err instanceof Error ? err.message : "Failed to create shipment. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-8 space-y-6 relative">
      {/* Top Header */}
      <div className="flex items-center space-x-4">
        <Link
          href="/app/dashboard"
          className="p-2 bg-white border border-border rounded-xl hover:bg-surface-muted transition-all text-ink"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <Badge variant="info">Shipment Management</Badge>
          <h1 className="text-2xl font-bold tracking-tight text-ink mt-1">Create New Shipment</h1>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center space-x-3 text-xs text-red-800">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Form Card with Transition Overlay */}
      <form onSubmit={handleSubmit} className="relative">
        <Card className={loading ? "opacity-40 pointer-events-none transition-all duration-300" : "transition-all duration-300"}>
          <CardHeader>
            <CardHeaderIcon>
              <Package className="w-5 h-5" />
            </CardHeaderIcon>
            <div>
              <h2 className="text-base font-semibold text-ink">Shipment & Importer Details</h2>
              <p className="text-xs text-ink-muted">
                Initialize compliance checking & document ingestion. Logistics, PO, and port details will be automatically extracted from uploaded documents.
              </p>
            </div>
          </CardHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField className="md:col-span-2">
              <ImporterPicker
                value={selectedImporter}
                onChange={(importer) => {
                  setSelectedImporter(importer);
                  setFormData((current) => ({ ...current, importerOfRecordId: importer?.id ?? "" }));
                  setError(null);
                }}
                clientId={clientScope}
                disabled={loading}
              />
            </FormField>

            <FormField>
              <Label>Destination Country *</Label>
              <Select
                required
                disabled={loading}
                value={formData.destinationCountry}
                onChange={(e) => setFormData({ ...formData, destinationCountry: e.target.value })}
              >
                <option value="">Select destination country</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField>
              <Label>Customs Entry Type</Label>
              <Select
                disabled={loading}
                value={formData.entryType}
                onChange={(e) => setFormData({ ...formData, entryType: e.target.value })}
              >
                <option value="">Select Customs Entry Type</option>
                <option value="Consumption Entry">Consumption Entry (Type 01)</option>
                <option value="Informal Entry">Informal Entry (Type 11)</option>
                <option value="In-Bond Entry">In-Bond Entry (Type 61)</option>
                <option value="Foreign Trade Zone Entry">Foreign Trade Zone (Type 06)</option>
                <option value="Temporary Importation under Bond">TIB Entry (Type 23)</option>
              </Select>
            </FormField>

          </div>

          {/* Submit Actions */}
          <div className="pt-6 mt-6 border-t border-border flex items-center justify-end space-x-3">
            <Link href="/app/dashboard" className={buttonVariants({ variant: "secondary", size: "md" })}>
              Cancel
            </Link>
            <Button type="submit" loading={loading} disabled={loading}>
              {!loading && <ShieldCheck className="w-4 h-4" />}
              <span>{loading ? "Creating Shipment..." : "Initialize Shipment"}</span>
            </Button>
          </div>
        </Card>

        {/* Transition Overlay Banner */}
        {loading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-xs rounded-2xl flex flex-col items-center justify-center p-6 space-y-3 z-20 shadow-lg border border-border/50 animate-in fade-in duration-200">
            <div className="p-3 bg-surface rounded-2xl border border-border shadow-xs">
              <Loader2 className="w-8 h-8 text-ink animate-spin" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-ink">Creating Shipment Workspace...</p>
              <p className="text-xs text-ink-muted">Initializing compliance engine & redirecting to shipment details</p>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
