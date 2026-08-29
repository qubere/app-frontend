import { describe, it, expect, vi, beforeEach } from "vitest";

// Bulk Compliance Screening: saved column-mapping templates. Covers
// fail-closed validation and tenant isolation on get/delete.

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    complianceBatchColumnMappingTemplate: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

const { ComplianceBatchTemplateService, ComplianceBatchTemplateValidationError } = await import(
  "@/modules/complianceBatch/templates"
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ComplianceBatchTemplateService.create", () => {
  it("rejects a blank name", async () => {
    await expect(
      ComplianceBatchTemplateService.create("acct_1", "user_1", "   ", { partyName: "Party Name" })
    ).rejects.toThrow(ComplianceBatchTemplateValidationError);
    expect(dbMock.complianceBatchColumnMappingTemplate.create).not.toHaveBeenCalled();
  });

  it("rejects a non-object fieldMappings payload", async () => {
    await expect(ComplianceBatchTemplateService.create("acct_1", "user_1", "ERP Export", "not-an-object")).rejects.toThrow(
      ComplianceBatchTemplateValidationError
    );
  });

  it("rejects an unknown field name", async () => {
    await expect(
      ComplianceBatchTemplateService.create("acct_1", "user_1", "ERP Export", { notARealField: "Some Header" })
    ).rejects.toThrow(ComplianceBatchTemplateValidationError);
  });

  it("rejects an empty-string mapping value", async () => {
    await expect(
      ComplianceBatchTemplateService.create("acct_1", "user_1", "ERP Export", { partyName: "   " })
    ).rejects.toThrow(ComplianceBatchTemplateValidationError);
  });

  it("rejects an empty fieldMappings object", async () => {
    await expect(ComplianceBatchTemplateService.create("acct_1", "user_1", "ERP Export", {})).rejects.toThrow(
      ComplianceBatchTemplateValidationError
    );
  });

  it("trims the name and creates the template", async () => {
    dbMock.complianceBatchColumnMappingTemplate.create.mockResolvedValue({ id: "tmpl_1" });

    await ComplianceBatchTemplateService.create("acct_1", "user_1", "  ERP Export  ", {
      partyName: "Party Name",
    });

    expect(dbMock.complianceBatchColumnMappingTemplate.create).toHaveBeenCalledWith({
      data: {
        accountId: "acct_1",
        createdByUserId: "user_1",
        name: "ERP Export",
        fieldMappings: { partyName: "Party Name" },
      },
    });
  });

  it("maps a Prisma unique-constraint violation to a validation error", async () => {
    dbMock.complianceBatchColumnMappingTemplate.create.mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
    );

    await expect(
      ComplianceBatchTemplateService.create("acct_1", "user_1", "ERP Export", { partyName: "Party Name" })
    ).rejects.toThrow(ComplianceBatchTemplateValidationError);
  });
});

describe("ComplianceBatchTemplateService.get / delete tenant isolation", () => {
  it("scopes get() by id and accountId together", async () => {
    dbMock.complianceBatchColumnMappingTemplate.findFirst.mockResolvedValue(null);

    await ComplianceBatchTemplateService.get("acct_2", "tmpl_1");

    expect(dbMock.complianceBatchColumnMappingTemplate.findFirst).toHaveBeenCalledWith({
      where: { id: "tmpl_1", accountId: "acct_2" },
    });
  });

  it("delete() returns false when no row matches the caller's tenant", async () => {
    dbMock.complianceBatchColumnMappingTemplate.deleteMany.mockResolvedValue({ count: 0 });

    const result = await ComplianceBatchTemplateService.delete("acct_2", "tmpl_1");

    expect(result).toBe(false);
    expect(dbMock.complianceBatchColumnMappingTemplate.deleteMany).toHaveBeenCalledWith({
      where: { id: "tmpl_1", accountId: "acct_2" },
    });
  });

  it("delete() returns true when a row owned by the caller's tenant was removed", async () => {
    dbMock.complianceBatchColumnMappingTemplate.deleteMany.mockResolvedValue({ count: 1 });

    const result = await ComplianceBatchTemplateService.delete("acct_1", "tmpl_1");

    expect(result).toBe(true);
  });
});
