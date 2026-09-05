import { createHash } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocking pattern follows tests/entry-summary-draft-service.test.ts's
// vi.hoisted() dbMock, plus module mocks for storage + notify (both do real
// I/O / DB writes in production and must not run in a unit test).
const { dbMock, exportRows, storageMock, notifyMock } = vi.hoisted(() => {
  const exportRows: any[] = [];
  let idCounter = 0;

  const filerExport = {
    findFirst: vi.fn(async ({ where }: any) => {
      return exportRows.find((r) => Object.entries(where).every(([k, v]) => r[k] === v)) ?? null;
    }),
    create: vi.fn(async ({ data }: any) => {
      if (
        exportRows.some((r) => r.accountId === data.accountId && r.idempotencyKey === data.idempotencyKey)
      ) {
        const err: any = new Error("Unique constraint failed");
        err.code = "P2002";
        throw err;
      }
      const row = {
        id: `fe_${++idCounter}`,
        deliveredAt: null,
        lastError: null,
        attemptCount: 0,
        createdAt: new Date(),
        ...data,
      };
      exportRows.push(row);
      return row;
    }),
    update: vi.fn(async ({ where, data }: any) => {
      const row = exportRows.find((r) => r.id === where.id);
      if (!row) throw new Error("not found");
      Object.assign(row, data);
      return row;
    }),
    updateMany: vi.fn(async ({ where, data }: any) => {
      let count = 0;
      for (const row of exportRows) {
        if (Object.entries(where).every(([k, v]) => row[k] === v)) {
          Object.assign(row, data);
          count++;
        }
      }
      return { count };
    }),
  };

  const storedBytesByPath: Record<string, Buffer> = {};
  const storeGeneratedFile = vi.fn(async (params: { objectPath: string; filename: string; contentType: string; body: Buffer }) => {
    storedBytesByPath[params.objectPath] = params.body;
    return {
      url: `local-fs://${params.objectPath}`,
      filename: params.filename,
      size: params.body.byteLength,
      checksum: "irrelevant-storage-checksum",
      provider: "local-fs" as const,
    };
  });

  const notify = vi.fn(async () => ({ created: true }));

  return {
    dbMock: { filerExport },
    exportRows,
    storageMock: { storeGeneratedFile, storedBytesByPath },
    notifyMock: { notify },
  };
});

vi.mock("@/lib/storage", () => ({ storeGeneratedFile: storageMock.storeGeneratedFile }));
vi.mock("@/modules/notifications/notify", () => ({ notify: notifyMock.notify }));

import {
  computeIdempotencyKey,
  createFakeSftpTransport,
  downloadTransport,
  getExport,
  markDownloadDelivered,
  requestExport,
  supersedeExportsForDraft,
  DraftNotApproved,
  type RequestExportInput,
} from "@/modules/entrySummary/export.service";
import { DraftNotExportable } from "@/modules/entrySummary/draft.service";
import { buildDraft, buildFilerProfile, buildLine, money } from "./helpers/entrySummaryFixtures";

const fixedClock = () => new Date("2026-06-01T00:00:00.000Z");
const noopSleep = async () => {};

function draftRow(overrides: Partial<RequestExportInput["draftRow"]> = {}) {
  return {
    id: "esd_1",
    accountId: "acct_1",
    shipmentId: "shp_1",
    filingId: null,
    version: 1,
    draftData: {},
    validationData: {},
    isExportable: true,
    blockingCount: 0,
    warningCount: 0,
    generatedBy: "system",
    supersededAt: null,
    approvedAt: new Date("2026-05-30T00:00:00.000Z"),
    approvedBy: "user_1",
    inputHash: "hash1",
    createdAt: new Date("2026-05-29T00:00:00.000Z"),
    ...overrides,
  };
}

function sampleDraft() {
  return buildDraft([buildLine(1, { B28_DESCRIPTION: "Widget", B32A_ENTERED_VALUE: money("10.00") })], {
    B06_PORT_CODE: "2704",
  });
}

function csvProfile() {
  return buildFilerProfile({
    format: "CSV",
    fieldMap: { columns: [{ blockId: "B28_DESCRIPTION", header: "Description" }] },
  });
}

function baseInput(overrides: Partial<RequestExportInput> = {}): RequestExportInput {
  return {
    accountId: "acct_1",
    draftRow: draftRow(),
    draft: sampleDraft(),
    validation: { findings: [], blockingCount: 0, warningCount: 0, isExportable: true },
    profile: csvProfile(),
    format: "CSV",
    transport: downloadTransport,
    requestedBy: "user_1",
    clock: fixedClock,
    sleep: noopSleep,
    shipmentNumber: "SHP-2026-000001",
    ...overrides,
  };
}

beforeEach(() => {
  exportRows.length = 0;
  for (const key of Object.keys(storageMock.storedBytesByPath)) delete storageMock.storedBytesByPath[key];
  vi.clearAllMocks();
});

describe("requestExport", () => {
  it("1a. DOWNLOAD transport: row starts Pending, becomes Delivered after markDownloadDelivered", async () => {
    const row = await requestExport(dbMock as any, baseInput());
    expect(row.status).toBe("Pending");
    expect(row.payloadHash).toBeTruthy();
    expect(row.storageUrl).toBeTruthy();

    const delivered = await markDownloadDelivered(dbMock as any, "acct_1", row.id);
    expect(delivered.status).toBe("Delivered");
    expect(delivered.deliveredAt).not.toBeNull();
  });

  it("1b. a successful fake transport delivers immediately", async () => {
    const transport = createFakeSftpTransport("success");
    const row = await requestExport(dbMock as any, baseInput({ transport }));
    expect(row.status).toBe("Delivered");
    expect(row.payloadHash).toBeTruthy();
    expect(row.storageUrl).toBeTruthy();
  });

  it("2. same request twice -> one row, transport invoked once", async () => {
    const transport = createFakeSftpTransport("success");
    const deliverSpy = vi.spyOn(transport, "deliver");
    const input = baseInput({ transport });
    const first = await requestExport(dbMock as any, input);
    const second = await requestExport(dbMock as any, input);
    expect(second.id).toBe(first.id);
    expect(exportRows).toHaveLength(1);
    expect(deliverSpy).toHaveBeenCalledTimes(1);
  });

  it("3. approvedAt null -> throws DraftNotApproved; no row created", async () => {
    const input = baseInput({ draftRow: draftRow({ approvedAt: null }) });
    await expect(requestExport(dbMock as any, input)).rejects.toBeInstanceOf(DraftNotApproved);
    expect(exportRows).toHaveLength(0);
  });

  it("4. blockingCount > 0 (isExportable false) -> throws DraftNotExportable, distinct from DraftNotApproved", async () => {
    const input = baseInput({ draftRow: draftRow({ isExportable: false, blockingCount: 2 }) });
    await expect(requestExport(dbMock as any, input)).rejects.toBeInstanceOf(DraftNotExportable);
    expect(exportRows).toHaveLength(0);
  });

  it("5. transport fails 3x -> attemptCount 3, status Failed, lastError set, notify called once", async () => {
    const transport = createFakeSftpTransport("fail");
    const input = baseInput({ transport, brokerUserId: "broker_1" });
    const row = await requestExport(dbMock as any, input);
    expect(row.status).toBe("Failed");
    expect(row.attemptCount).toBe(3);
    expect(row.lastError).toContain("simulated delivery failure");
    expect(notifyMock.notify).toHaveBeenCalledTimes(1);
    expect((notifyMock.notify.mock.calls[0] as any[])[0]).toMatchObject({ userId: "broker_1", accountId: "acct_1" });
  });

  it("6. transport fails twice then succeeds -> Delivered, attemptCount 3", async () => {
    const transport = createFakeSftpTransport(["fail", "fail", "success"]);
    const input = baseInput({ transport });
    const row = await requestExport(dbMock as any, input);
    expect(row.status).toBe("Delivered");
    expect(row.attemptCount).toBe(3);
  });

  it("7. payloadHash equals sha256 of the bytes actually stored", async () => {
    const row = await requestExport(dbMock as any, baseInput());
    const storedPaths = Object.keys(storageMock.storedBytesByPath);
    expect(storedPaths).toHaveLength(1);
    const storedBytes = storageMock.storedBytesByPath[storedPaths[0]];
    expect(createHash("sha256").update(storedBytes).digest("hex")).toBe(row.payloadHash);
  });

  it("8. regenerating the draft to v2 marks v1's exports Superseded", async () => {
    const row = await requestExport(dbMock as any, baseInput());
    expect(row.status).toBe("Pending");
    await supersedeExportsForDraft(dbMock as any, "acct_1", "esd_1");
    const refreshed = await getExport(dbMock as any, "acct_1", row.id);
    expect(refreshed?.status).toBe("Superseded");
  });

  it("9. same draft exported as CSV and as CATAIR -> two rows, different idempotency keys", async () => {
    const csvRow = await requestExport(dbMock as any, baseInput());
    const catairInput = baseInput({
      format: "CATAIR_AE",
      profile: buildFilerProfile({ format: "CATAIR_AE", fieldMap: { layout: "catair-ae-2024.1" } }),
      draft: buildDraft(
        [
          buildLine(1, {
            B29A_HTSUS_NUMBER: "8501104000",
            B10_COUNTRY_OF_ORIGIN: "CN",
            B28_DESCRIPTION: "Widget",
            B32A_ENTERED_VALUE: money("10.00"),
          }),
        ],
        {
          B01_FILER_ENTRY_NUMBER: "12345678901",
          B02_ENTRY_TYPE: "01",
          B06_PORT_CODE: "2704",
          B07_ENTRY_DATE: "2026-03-01",
          B35_TOTAL_ENTERED_VALUE: money("10.00"),
        }
      ),
      sequence: (() => {
        let n = 1;
        return () => n++;
      })(),
    });
    const catairRow = await requestExport(dbMock as any, catairInput);
    expect(exportRows).toHaveLength(2);
    expect(csvRow.idempotencyKey).not.toBe(catairRow.idempotencyKey);
    expect(
      computeIdempotencyKey("esd_1", csvRow.filerProfileId, "CSV") === csvRow.idempotencyKey
    ).toBe(true);
  });

  it("10. cross-account: account B cannot fetch account A's export row", async () => {
    const row = await requestExport(dbMock as any, baseInput());
    const asOtherAccount = await getExport(dbMock as any, "acct_2", row.id);
    expect(asOtherAccount).toBeNull();
  });

  it("11. a transport failure never mutates the draft row (approvedAt stays intact; ExportDbClient has no entrySummaryDraft surface at all)", async () => {
    const transport = createFakeSftpTransport("fail");
    const input = baseInput({ transport });
    const approvedAtBefore = input.draftRow.approvedAt;
    await requestExport(dbMock as any, input);
    expect(input.draftRow.approvedAt).toEqual(approvedAtBefore);
    // ExportDbClient's type surface only exposes `filerExport` — there is no
    // entrySummaryDraft.update this module could even call.
    expect((dbMock as any).entrySummaryDraft).toBeUndefined();
  });
});
