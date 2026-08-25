"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search, Upload, Plus, Anchor, Plane, Truck,
  TriangleAlert, Sparkles, Layers, X
} from "lucide-react";
import { TmsSidebar } from "@/components/TmsSidebar";
import { TmsHeader } from "@/components/TmsHeader";
import { Card, Badge, Button } from "@/components/ui";
import { DocumentUploadModal } from "@/components/DocumentUploadModal";

export interface ShipmentListItem {
  id: string;
  shipmentNumber: string;
  importerName: string;
  transportMode: string;
  countryOfExport?: string | null;
  destinationCountry?: string | null;
  estimatedArrival?: string | null;
  status: string;
  readinessScore?: number;
  customsStatus?: string;
  exceptionCount: number;
}

function getModeIcon(mode: string) {
  const m = (mode || "OCEAN").toUpperCase();
  if (m === "AIR") return <Plane className="w-3.5 h-3.5 text-sky-500" />;
  if (m === "TRUCK") return <Truck className="w-3.5 h-3.5 text-amber-600" />;
  return <Anchor className="w-3.5 h-3.5 text-blue-600" />;
}

export function ShipmentsWorkbenchClient({ initialShipments }: { initialShipments: ShipmentListItem[] }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"ALL" | "ATTENTION" | "TRANSIT" | "HOLD" | "COMPLETED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMode, setSelectedMode] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isNewShipmentOpen, setIsNewShipmentOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const [newImporterName, setNewImporterName] = useState("");
  const [newTransportMode, setNewTransportMode] = useState("OCEAN");
  const [newOriginPort, setNewOriginPort] = useState("");
  const [newDestinationPort, setNewDestinationPort] = useState("");
  const [isSubmittingShipment, setIsSubmittingShipment] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingShipment(true);
    setCreateError(null);

    try {
      const res = await fetch("/api/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          importerName: newImporterName.trim() || "Acme Import Logistics LLC",
          transportMode: newTransportMode,
          originPort: newOriginPort.trim() || "CNSHA",
          destinationPort: newDestinationPort.trim() || "USOAK",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to create shipment");
      }

      setIsNewShipmentOpen(false);
      setNewImporterName("");
      setNewOriginPort("");
      setNewDestinationPort("");

      if (data.shipmentId) {
        router.push(`/shipments/${data.shipmentId}`);
      } else {
        window.location.reload();
      }
    } catch (err: any) {
      setCreateError(err.message || "Error creating shipment");
    } finally {
      setIsSubmittingShipment(false);
    }
  };

  const shipments = initialShipments;

  // Tab Filtering
  const filtered = useMemo(() => {
    return shipments.filter((shp) => {
      // Tab filter
      if (activeTab === "ATTENTION" && shp.status !== "At Risk" && shp.exceptionCount === 0) return false;
      if (activeTab === "TRANSIT" && shp.status !== "In Transit") return false;
      if (activeTab === "HOLD" && shp.customsStatus !== "HOLD") return false;
      if (activeTab === "COMPLETED" && shp.status !== "Completed") return false;

      // Mode filter
      if (selectedMode !== "all" && shp.transportMode.toUpperCase() !== selectedMode.toUpperCase()) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          shp.shipmentNumber.toLowerCase().includes(q) ||
          shp.importerName.toLowerCase().includes(q) ||
          shp.transportMode.toLowerCase().includes(q) ||
          (shp.countryOfExport && shp.countryOfExport.toLowerCase().includes(q)) ||
          (shp.destinationCountry && shp.destinationCountry.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [shipments, activeTab, selectedMode, searchQuery]);

  return (
    <div className="min-h-screen bg-surface-muted text-ink flex w-full">
      <TmsSidebar accountName="Enterprise Freight" />

      <div className="flex-1 flex flex-col min-w-0">
        <TmsHeader tenantName="Enterprise Freight" userName="Operations Lead" />

        <main className="flex-1 p-8 overflow-y-auto space-y-6">
          {/* Top Title & Quick Actions */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2.5">
                <Layers className="w-5 h-5 text-brand" />
                <h1 className="text-2xl font-extrabold text-ink tracking-tight">Active Multimodal Shipments Workbench</h1>
              </div>
              <p className="text-xs text-ink-muted mt-1 font-medium">
                Unified transportation movements, tracking telemetry, readiness scoring, and customs release clearance.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Button onClick={() => setIsUploadOpen(true)} variant="secondary" className="flex items-center space-x-1.5 cursor-pointer">
                <Upload className="w-4 h-4 text-brand" />
                <span>Upload Document</span>
              </Button>
              <Button onClick={() => setIsNewShipmentOpen(true)} className="flex items-center space-x-1.5 shadow-xs cursor-pointer">
                <Plus className="w-4 h-4" />
                <span>New Shipment</span>
              </Button>
            </div>
          </div>

          {/* Workbench Tabs Bar */}
          <div className="flex items-center justify-between border-b border-border pb-1 gap-4 flex-wrap">
            <div className="flex bg-surface-muted p-1 rounded-xl border border-border text-xs">
              <button
                onClick={() => setActiveTab("ALL")}
                className={`px-4 py-2 rounded-lg font-bold transition-all cursor-pointer ${
                  activeTab === "ALL" ? "bg-white text-brand shadow-3xs" : "text-ink-muted hover:text-ink"
                }`}
              >
                All Shipments ({shipments.length})
              </button>
              <button
                onClick={() => setActiveTab("ATTENTION")}
                className={`px-4 py-2 rounded-lg font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                  activeTab === "ATTENTION" ? "bg-white text-red-600 shadow-3xs" : "text-ink-muted hover:text-ink"
                }`}
              >
                <TriangleAlert className="w-3.5 h-3.5 text-red-500" />
                <span>Needs Attention ({shipments.filter((s) => s.status === "At Risk" || s.exceptionCount > 0).length})</span>
              </button>
              <button
                onClick={() => setActiveTab("TRANSIT")}
                className={`px-4 py-2 rounded-lg font-bold transition-all cursor-pointer ${
                  activeTab === "TRANSIT" ? "bg-white text-brand shadow-3xs" : "text-ink-muted hover:text-ink"
                }`}
              >
                In Transit ({shipments.filter((s) => s.status === "In Transit").length})
              </button>
              <button
                onClick={() => setActiveTab("HOLD")}
                className={`px-4 py-2 rounded-lg font-bold transition-all cursor-pointer ${
                  activeTab === "HOLD" ? "bg-white text-amber-700 shadow-3xs" : "text-ink-muted hover:text-ink"
                }`}
              >
                Customs Hold ({shipments.filter((s) => s.customsStatus === "HOLD").length})
              </button>
            </div>

            {/* Mode & Filter Selection */}
            <div className="flex items-center space-x-3 text-xs">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search shipment #, client, port..."
                  className="pl-8 pr-3 py-1.5 text-xs bg-white border border-border rounded-xl focus:outline-none focus:border-brand text-ink w-64 font-medium"
                />
              </div>
              <select
                value={selectedMode}
                onChange={(e) => setSelectedMode(e.target.value)}
                className="px-3 py-1.5 bg-white border border-border rounded-xl text-xs font-semibold text-ink focus:outline-none focus:border-brand"
              >
                <option value="all">All Modes</option>
                <option value="OCEAN">OCEAN</option>
                <option value="AIR">AIR</option>
                <option value="TRUCK">TRUCK</option>
              </select>
            </div>
          </div>

          {/* Batch Selection Action Bar */}
          {selectedIds.length > 0 && (
            <div className="p-3 bg-brand/10 border border-brand/20 rounded-xl flex items-center justify-between text-xs font-semibold text-brand animate-in fade-in duration-150">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-brand" />
                <span>{selectedIds.length} shipment(s) selected</span>
              </div>
              <div className="flex items-center space-x-2">
                <Button size="sm" variant="secondary">Dispatch Batch Tender</Button>
                <Button size="sm" variant="secondary" onClick={() => setSelectedIds([])}>Deselect All</Button>
              </div>
            </div>
          )}

          <Card className="p-0 border border-border overflow-hidden bg-white shadow-xs">
            {filtered.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Layers className="w-8 h-8 text-ink-muted mx-auto opacity-40" />
                <p className="text-sm font-semibold text-ink">No shipments match your current view</p>
                <p className="text-xs text-ink-muted">Try adjusting filters or search query to find your freight.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-muted/60 border-b border-border text-ink-muted font-semibold">
                    <tr>
                      <th className="py-3 px-4 w-10">
                        <input
                          type="checkbox"
                          className="rounded border-border cursor-pointer"
                          checked={selectedIds.length === filtered.length && filtered.length > 0}
                          onChange={(e) => setSelectedIds(e.target.checked ? filtered.map((s) => s.id) : [])}
                        />
                      </th>
                      <th className="py-3 px-4">Shipment #</th>
                      <th className="py-3 px-4">Importer</th>
                      <th className="py-3 px-4">Mode</th>
                      <th className="py-3 px-4">Lane (Origin → Dest)</th>
                      <th className="py-3 px-4">Readiness</th>
                      <th className="py-3 px-4">Customs Status</th>
                      <th className="py-3 px-4">Exceptions</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filtered.map((shp) => {
                      const isSelected = selectedIds.includes(shp.id);
                      const isReleased = shp.customsStatus === "RELEASED" || shp.customsStatus === "ACCEPTED";
                      return (
                        <tr key={shp.id} className={`hover:bg-surface-muted/30 transition-colors ${isSelected ? "bg-brand/5" : ""}`}>
                          <td className="py-3.5 px-4">
                            <input
                              type="checkbox"
                              className="rounded border-border cursor-pointer"
                              checked={isSelected}
                              onChange={(e) => {
                                setSelectedIds(e.target.checked ? [...selectedIds, shp.id] : selectedIds.filter((id) => id !== shp.id));
                              }}
                            />
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-ink">
                            <Link href={`/shipments/${shp.id}`} className="hover:underline text-brand">
                              {shp.shipmentNumber}
                            </Link>
                          </td>
                          <td className="py-3.5 px-4 font-medium text-ink">{shp.importerName}</td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center space-x-1.5 font-semibold text-[11px] text-ink-muted">
                              {getModeIcon(shp.transportMode)}
                              <span>{shp.transportMode}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[11px]">
                            {shp.countryOfExport ?? "CNSHA"} → {shp.destinationCountry ?? "USOAK"}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center space-x-2">
                              <div className="w-16 h-2 bg-surface-muted rounded-full overflow-hidden border border-border">
                                <div
                                  className={`h-full ${
                                    (shp.readinessScore ?? 90) >= 90 ? "bg-emerald-500" : (shp.readinessScore ?? 90) >= 70 ? "bg-amber-500" : "bg-red-500"
                                  }`}
                                  style={{ width: `${shp.readinessScore ?? 90}%` }}
                                />
                              </div>
                              <span className="font-bold text-[11px] text-ink">{shp.readinessScore ?? 90}%</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <Badge variant={isReleased ? "success" : shp.customsStatus === "HOLD" ? "danger" : "warning"}>
                              {isReleased ? "✓ Released" : shp.customsStatus === "HOLD" ? "CUSTOMS HOLD" : "In Prep"}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4">
                            {shp.exceptionCount > 0 ? (
                              <Badge variant="danger">{shp.exceptionCount} Exception{shp.exceptionCount > 1 ? "s" : ""}</Badge>
                            ) : (
                              <span className="text-ink-muted text-[11px]">Clear</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <Link href={`/shipments/${shp.id}`}>
                              <Button variant="secondary" size="sm">Workspace</Button>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {isNewShipmentOpen && (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
              <form onSubmit={handleCreateShipment} className="bg-white rounded-2xl border border-border shadow-2xl w-full max-w-md p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h3 className="font-bold text-sm text-ink">Create New Freight Shipment</h3>
                  <button type="button" onClick={() => setIsNewShipmentOpen(false)} className="text-ink-muted hover:text-ink">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {createError && (
                  <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                    {createError}
                  </div>
                )}
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-ink mb-1">Importer / Client</label>
                    <input
                      type="text"
                      placeholder="e.g. Acme Import Logistics LLC"
                      value={newImporterName}
                      onChange={(e) => setNewImporterName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-brand/20 font-medium"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-ink mb-1">Transport Mode</label>
                    <select
                      value={newTransportMode}
                      onChange={(e) => setNewTransportMode(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-border font-semibold focus:outline-none focus:ring-2 focus:ring-brand/20"
                    >
                      <option value="OCEAN">OCEAN Container</option>
                      <option value="TRUCK">TRUCK Full Truckload (FTL)</option>
                      <option value="AIR">AIR Air Cargo</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold text-ink mb-1">Origin Port</label>
                      <input
                        type="text"
                        placeholder="e.g. CNSHA"
                        value={newOriginPort}
                        onChange={(e) => setNewOriginPort(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-brand/20 font-medium"
                        required
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-ink mb-1">Destination Port</label>
                      <input
                        type="text"
                        placeholder="e.g. USOAK"
                        value={newDestinationPort}
                        onChange={(e) => setNewDestinationPort(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-brand/20 font-medium"
                        required
                      />
                    </div>
                  </div>
                </div>
                <div className="pt-2 flex items-center justify-end space-x-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => setIsNewShipmentOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={isSubmittingShipment} className="cursor-pointer">
                    {isSubmittingShipment ? "Saving..." : "Create Shipment"}
                  </Button>
                </div>
              </form>
            </div>
          )}

          <DocumentUploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} />
        </main>
      </div>
    </div>
  );
}
