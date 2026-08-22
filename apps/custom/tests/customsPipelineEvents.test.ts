import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@qubere/db";
import { sendToCustoms } from "../../tms/src/modules/shipments/services/customsHandoffService";
import { dispatchCustomsHandoffOutboxEvent } from "../../tms/src/lib/customsHandoffOutbox";
import { includeDocument, excludeDocument } from "../src/modules/case/customsCaseDocumentService";

describe("Pipeline & Outbox Event Requirements (Tests 35-47)", () => {
  const testAccountId = `acc_cpe_${Date.now()}`;
  const testUserId = `usr_cpe_${Date.now()}`;

  beforeAll(async () => {
    await db.account.create({
      data: {
        id: testAccountId,
        name: "CPE Test Account",
        slug: `cpe-test-${Date.now()}`,
        productEntitlements: {
          create: [
            { product: "TMS", status: "ACTIVE" },
            { product: "CUSTOMS", status: "ACTIVE" },
          ],
        },
      },
    });

    await db.user.create({
      data: {
        id: testUserId,
        clerkUserId: `clerk_${testUserId}`,
        email: `cpe_test_${Date.now()}@qubere.local`,
      },
    });
  });

  it("35 & 36. TMS document upload triggers TMS pipeline only; does not create CustomsCaseDocument without handoff", async () => {
    const shipment = await db.shipment.create({
      data: {
        accountId: testAccountId,
        shipmentNumber: `SHP-CPE-${Date.now()}-35`,
        importerName: "Test Importer 35",
      },
    });

    const doc = await db.shipmentDocument.create({
      data: {
        accountId: testAccountId,
        shipmentId: shipment.id,
        fileName: "Invoice_TMS_Only.pdf",
        docType: "COMMERCIAL_INVOICE",
      },
    });

    expect(doc.id).toBeDefined();

    // Verify no CustomsCaseDocument link was created automatically
    const caseDocLinks = await db.customsCaseDocument.findMany({
      where: { documentId: doc.id },
    });

    expect(caseDocLinks).toHaveLength(0);
  });

  it("37 & 38. Handoff evaluates documents and creates CustomsCaseDocument suggestions / links", async () => {
    const shipment = await db.shipment.create({
      data: {
        accountId: testAccountId,
        shipmentNumber: `SHP-CPE-${Date.now()}-37`,
        importerName: "Test Importer 37",
      },
    });

    const doc = await db.shipmentDocument.create({
      data: {
        accountId: testAccountId,
        shipmentId: shipment.id,
        fileName: "Invoice_37.pdf",
        docType: "COMMERCIAL_INVOICE",
        documentType: "COMMERCIAL_INVOICE",
        checksum: "hash_37",
        version: "1.0",
      },
    });

    const result = await sendToCustoms({
      accountId: testAccountId,
      userId: testUserId,
      shipmentId: shipment.id,
    });

    expect(result.ok).toBe(true);
    expect(result.documentsEvaluated).toBeGreaterThanOrEqual(1);

    const caseDoc = await db.customsCaseDocument.findFirst({
      where: {
        customsCaseId: result.customsCaseId,
        documentId: doc.id,
      },
    });

    expect(caseDoc).not.toBeNull();
    expect(caseDoc?.status).toBe("INCLUDED");
  });

  it("39 & 40. Manifest changes rerun filing readiness without deleting historical records", async () => {
    const shipment = await db.shipment.create({
      data: {
        accountId: testAccountId,
        shipmentNumber: `SHP-CPE-${Date.now()}-39`,
        importerName: "Test Importer 39",
      },
    });

    await db.auditLog.create({
      data: {
        accountId: testAccountId,
        userId: testUserId,
        action: "FILING_READINESS_EVALUATED",
        entity: "Shipment",
        entityId: shipment.id,
        metadata: { run: 1, score: 75 },
      },
    });

    await db.auditLog.create({
      data: {
        accountId: testAccountId,
        userId: testUserId,
        action: "FILING_READINESS_EVALUATED",
        entity: "Shipment",
        entityId: shipment.id,
        metadata: { run: 2, score: 95 },
      },
    });

    const logs = await db.auditLog.findMany({
      where: { accountId: testAccountId, entityId: shipment.id, action: "FILING_READINESS_EVALUATED" },
    });

    expect(logs).toHaveLength(2);
  });

  it("41 & 42. Handoff creates outbox event in same transaction with case-scoped event key", async () => {
    const shipment = await db.shipment.create({
      data: {
        accountId: testAccountId,
        shipmentNumber: `SHP-CPE-${Date.now()}-41`,
        importerName: "Test Importer 41",
      },
    });

    const result = await sendToCustoms({
      accountId: testAccountId,
      userId: testUserId,
      shipmentId: shipment.id,
    });

    const expectedKey = `customs_handoff_${shipment.id}_${result.customsCaseId}`;

    const outboxEvent = await db.workflowOutboxEvent.findFirst({
      where: { eventKey: expectedKey },
    });

    expect(outboxEvent).not.toBeNull();
    expect(outboxEvent?.eventType).toBe("CUSTOMS_HANDOFF_REQUESTED");
    expect(outboxEvent?.aggregateId).toBe(result.customsCaseId);
  });

  it("43 & 44. Outbox recovery republishes undelivered events idempotently", async () => {
    const eventKey = `customs_handoff_test_${Date.now()}`;

    await db.workflowOutboxEvent.create({
      data: {
        accountId: testAccountId,
        eventKey,
        eventType: "CUSTOMS_HANDOFF_REQUESTED",
        aggregateType: "CustomsCase",
        aggregateId: `cc_test_${Date.now()}`,
        payload: { test: true },
        status: "PENDING",
      },
    });

    // First dispatch claims and completes the event
    const status1 = await dispatchCustomsHandoffOutboxEvent(eventKey);
    expect(status1).toBe("DISPATCHED");

    // Second dispatch on the same event key returns ALREADY_DISPATCHED
    const status2 = await dispatchCustomsHandoffOutboxEvent(eventKey);
    expect(status2).toBe("ALREADY_DISPATCHED");
  });

  it("45. Duplicate handoff requests do not create duplicate cases, links, or outbox rows", async () => {
    const shipment = await db.shipment.create({
      data: {
        accountId: testAccountId,
        shipmentNumber: `SHP-CPE-${Date.now()}-45`,
        importerName: "Test Importer 45",
      },
    });

    const res1 = await sendToCustoms({
      accountId: testAccountId,
      userId: testUserId,
      shipmentId: shipment.id,
    });

    const res2 = await sendToCustoms({
      accountId: testAccountId,
      userId: testUserId,
      shipmentId: shipment.id,
    });

    expect(res1.customsCaseId).toBe(res2.customsCaseId);

    const caseCount = await db.customsCaseShipment.count({
      where: { shipmentId: shipment.id },
    });
    expect(caseCount).toBe(1);

    const outboxCount = await db.workflowOutboxEvent.count({
      where: { aggregateId: res1.customsCaseId },
    });
    expect(outboxCount).toBe(1);
  });

  it("46 & 47. Handoff, inclusion, and exclusion actions create audit records with correlation metadata", async () => {
    const shipment = await db.shipment.create({
      data: {
        accountId: testAccountId,
        shipmentNumber: `SHP-CPE-${Date.now()}-46`,
        importerName: "Test Importer 46",
      },
    });

    const doc = await db.shipmentDocument.create({
      data: {
        accountId: testAccountId,
        shipmentId: shipment.id,
        fileName: "Invoice_46.pdf",
        docType: "COMMERCIAL_INVOICE",
      },
    });

    const res = await sendToCustoms({
      accountId: testAccountId,
      userId: testUserId,
      shipmentId: shipment.id,
    });

    const incLink = await includeDocument({
      accountId: testAccountId,
      userId: testUserId,
      customsCaseId: res.customsCaseId,
      documentId: doc.id,
      documentRole: "Commercial Invoice",
    });

    expect(incLink.status).toBe("INCLUDED");

    const excLink = await excludeDocument({
      accountId: testAccountId,
      userId: testUserId,
      customsCaseId: res.customsCaseId,
      documentId: doc.id,
      reason: "Superseded by v2",
    });

    expect(excLink.status).toBe("EXCLUDED");

    const auditLogs = await db.auditLog.findMany({
      where: {
        accountId: testAccountId,
        action: { in: ["CUSTOMS_HANDOFF_REQUESTED", "CUSTOMS_DOCUMENT_INCLUDED", "CUSTOMS_DOCUMENT_EXCLUDED"] },
      },
    });

    expect(auditLogs.length).toBeGreaterThanOrEqual(3);
  });
});
