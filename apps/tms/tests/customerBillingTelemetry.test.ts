import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_BILLING_EVENT_DEFINITIONS } from "@qubere/billing/constants";

describe("TMS customer billing telemetry", () => {
  const source = (relative: string) => readFileSync(join(process.cwd(), "src", relative), "utf8");

  it("registers all economically meaningful TMS events in the shared catalog", () => {
    const codes = DEFAULT_BILLING_EVENT_DEFINITIONS.filter((event) => event.productLine === "TMS").map((event) => event.eventCode);
    expect(codes).toEqual(expect.arrayContaining([
      "TMS_TENDER_DISPATCHED",
      "TMS_POD_CONFIRMED",
      "TMS_LOAD_DELIVERED",
      "TMS_FREIGHT_AUDIT_APPROVED",
    ]));
  });

  it("emits POD, delivery, freight-audit, and confirmed tender events with stable keys", () => {
    const pod = source("modules/pod/podPipeline.ts");
    const audit = source("modules/invoices/services/freightAuditAgent.ts");
    const tender = source("modules/tenders/services/tenderService.ts");
    expect(pod).toContain('eventCode: "TMS_POD_CONFIRMED"');
    expect(pod).toContain('eventCode: "TMS_LOAD_DELIVERED"');
    expect(audit).toContain('eventCode: "TMS_FREIGHT_AUDIT_APPROVED"');
    expect(tender).toContain("markTenderDispatched");
    expect(tender).toContain('eventCode: "TMS_TENDER_DISPATCHED"');
    expect(tender).toContain("providerMessageId");
  });

  it("keeps carrier AP explicitly separate from customer AR", () => {
    const emitter = source("lib/billingTelemetry.ts");
    expect(emitter).toContain("Carrier invoices remain");
    expect(emitter).toContain('productLine: "TMS"');
  });
});
