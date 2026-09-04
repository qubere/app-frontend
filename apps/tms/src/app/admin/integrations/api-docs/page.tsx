import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { TmsSidebar } from "@/components/TmsSidebar";
import { TmsHeader } from "@/components/TmsHeader";
import { Terminal } from "lucide-react";
import { Card } from "@/components/ui";

export default async function ApiDocsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const endpointGroups = [
    {
      title: "1. Transportation, Dispatch & Cargo Operations",
      description: "Manage multimodal shipments, carrier tenders, freight orders, and lane rate shopping.",
      endpoints: [
        { method: "GET", path: "/api/shipments", description: "List and filter active multimodal shipments by mode, status, or risk.", exampleUse: "curl -H 'Authorization: Bearer <token>' http://localhost:3001/api/shipments?mode=OCEAN" },
        { method: "GET", path: "/api/shipments/[id]", description: "Fetch 360° shipment details, transport legs, tracking stops, and compliance status.", exampleUse: "curl http://localhost:3001/api/shipments/SHP-2026-004872" },
        { method: "GET / POST", path: "/api/tenders", description: "List pending tenders or dispatch an automated waterfall tender to a carrier.", exampleUse: "curl -X POST -d '{\"shipmentNumber\":\"SHP-10482\",\"carrierScac\":\"WSTL\"}' http://localhost:3001/api/tenders" },
        { method: "GET", path: "/api/carriers", description: "Query carrier master directory, DOT/MC numbers, and OTD performance scores.", exampleUse: "curl http://localhost:3001/api/carriers" },
        { method: "GET", path: "/api/quotes", description: "Fetch rate quotes, spot market benchmarks, and margin analytics.", exampleUse: "curl http://localhost:3001/api/quotes" },
        { method: "GET", path: "/api/invoices", description: "Execute 3-way invoice matching (BOL + Rate Con + Carrier Invoice) and detect rate variances.", exampleUse: "curl http://localhost:3001/api/invoices" },
        { method: "GET", path: "/api/exceptions", description: "Fetch open operational exceptions (demurrage risk, stale GPS, missing POD).", exampleUse: "curl http://localhost:3001/api/exceptions" },
      ],
    },
    {
      title: "2. Document Processing & AI Ingestion Agent",
      description: "Upload, parse, classify, and extract trade & freight documents with provenance bounding boxes.",
      endpoints: [
        { method: "POST", path: "/api/documents/upload", description: "Upload trade PDFs or images (BOL, Invoice, POD) for automated AI parsing.", exampleUse: "curl -F 'file=@bol.pdf' -F 'docType=BILL_OF_LADING' http://localhost:3001/api/documents/upload" },
        { method: "POST", path: "/api/documents/[id]/parse", description: "Triggers AI Document Parsing Agent extraction and bounding box span generation.", exampleUse: "curl -X POST http://localhost:3001/api/documents/doc_9012/parse" },
        { method: "POST", path: "/api/documents/[id]/attach", description: "Attaches a parsed document directly to a target shipment workspace.", exampleUse: "curl -X POST -d '{\"shipmentId\":\"SHP-10482\"}' http://localhost:3001/api/documents/doc_9012/attach" },
        { method: "GET", path: "/api/documents/unattached", description: "Queries unattached documents waiting to be linked to shipments.", exampleUse: "curl http://localhost:3001/api/documents/unattached" },
      ],
    },
    {
      title: "3. Qubere AI Assistant & Multi-Agent Orchestrator",
      description: "Streaming server-sent events (SSE) powering interactive turns and autonomous tool execution.",
      endpoints: [
        { method: "POST", path: "/api/assistant/chat", description: "Streaming SSE endpoint for Qubere AI Assistant turns with tool execution data.", exampleUse: "curl -N -X POST -d '{\"message\":\"Show shipments at risk\"}' http://localhost:3001/api/assistant/chat" },
        { method: "GET", path: "/api/exceptions/count", description: "Polls active exception items count for sidebar notification badges.", exampleUse: "curl http://localhost:3001/api/exceptions/count" },
        { method: "GET", path: "/api/notifications", description: "Fetches user notifications feed and unread alerts count.", exampleUse: "curl http://localhost:3001/api/notifications" },
      ],
    },
    {
      title: "4. Administration & Tenant Governance",
      description: "User management, tenant credentials, role permissions, and integration settings.",
      endpoints: [
        { method: "GET / POST", path: "/api/admin/account", description: "Manage company profile, SCAC/USDOT credentials, and auto-tender defaults.", exampleUse: "curl http://localhost:3001/api/admin/account" },
        { method: "GET / POST", path: "/api/admin/users", description: "Query workspace members, assign roles (OWNER, DISPATCHER, FINANCE), and invite users.", exampleUse: "curl http://localhost:3001/api/admin/users" },
        { method: "GET", path: "/api/admin/integrations", description: "Manage Project44, Samsara, FourKites, QuickBooks, and API Secret keys.", exampleUse: "curl http://localhost:3001/api/admin/integrations" },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-surface-muted text-ink flex w-full">
      <TmsSidebar accountName="Enterprise Freight" />

      <div className="flex-1 flex flex-col min-w-0">
        <TmsHeader tenantName="Enterprise Freight" userName="Operations Lead" />

        <main className="flex-1 p-8 overflow-y-auto space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center">
                  <Terminal className="w-4 h-4 text-brand" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-ink">Qubere Platform API Catalog & Documentation</h1>
              </div>
              <p className="text-xs text-ink-muted mt-1 font-medium">
                Complete list of REST & Streaming APIs available in TMS, what they do, and how to execute them.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold font-mono">
                API Version: v1.4
              </span>
            </div>
          </div>

          {/* Endpoint Groups */}
          <div className="space-y-6">
            {endpointGroups.map((group, idx) => (
              <Card key={idx} className="p-6 bg-white border border-border space-y-4">
                <div className="border-b border-border pb-3">
                  <h2 className="text-base font-extrabold text-ink">{group.title}</h2>
                  <p className="text-xs text-ink-muted">{group.description}</p>
                </div>

                <div className="space-y-4">
                  {group.endpoints.map((ep, i) => (
                    <div key={i} className="p-4 rounded-xl bg-surface-muted/40 border border-border/80 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 font-mono">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            ep.method.includes("POST") ? "bg-purple-100 text-purple-900 border border-purple-200" : "bg-blue-100 text-blue-900 border border-blue-200"
                          }`}>
                            {ep.method}
                          </span>
                          <span className="font-bold text-brand">{ep.path}</span>
                        </div>
                      </div>

                      <p className="text-ink font-medium leading-relaxed">{ep.description}</p>

                      <div className="p-2.5 bg-slate-900 text-slate-100 rounded-lg font-mono text-[11px] overflow-x-auto select-all">
                        <code>{ep.exampleUse}</code>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
