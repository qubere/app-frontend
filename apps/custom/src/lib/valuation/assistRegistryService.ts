import { rethrowWorkflowConflict } from "@/lib/api/workflowConflict";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/api/error";
import { createAuditLog, AuditAction } from "@/lib/audit";
import { Decimal } from "@/lib/tariff/decimal";
import type { AssistInput, AssistPatch } from "./assistContracts";

export const assistInclude = { suppliers: { include: { party: { include: { names: { where: { isPrimary: true, status: "ACTIVE" as const }, take: 1 } } } } }, hts: true, importerOfRecord: { select: { id: true, name: true } } } satisfies Prisma.AssistInclude;
export const assistConflict = () => new DomainError("The assist balance or entry changed. Review the refreshed amount and confirm again.", "ASSIST_CONFLICT", 409);
export async function getAssist(accountId: string, id: string) {
  const assist = await db.assist.findFirst({ where: { id, accountId }, include: assistInclude });
  if (!assist) throw new DomainError("Assist not found.", "NOT_FOUND", 404);
  return assist;
}
export async function expireAssists(accountId: string, now = new Date()) {
  const expired = await db.assist.findMany({ where: { accountId, status: "Active", effectiveTo: { lt: now } }, select: { id: true, version: true } });
  for (const assist of expired) {
    const result = await db.assist.updateMany({ where: { id: assist.id, accountId, version: assist.version, status: "Active", effectiveTo: { lt: now } }, data: { status: "Suspended", version: { increment: 1 } } });
    if (result.count) await createAuditLog({ accountId, action: AuditAction.ASSIST_SUSPENDED, entity: "Assist", entityId: assist.id, source: "SYSTEM", metadata: { reason: "EFFECTIVE_RANGE_EXPIRED" } });
  }
}
async function validateScope(accountId: string, input: AssistInput) {
  if (input.importerOfRecordId && !await db.importerOfRecord.findFirst({ where: { id: input.importerOfRecordId, accountId }, select: { id: true } })) throw new DomainError("Importer not found.", "NOT_FOUND", 404);
  const ids = [...new Set(input.suppliers.map(p => p.partyId))];
  const parties = await db.party.findMany({ where: { id: { in: ids }, accountId, deletedAt: null }, select: { id: true } });
  if (parties.length !== ids.length) throw new DomainError("A selected supplier or manufacturer is unavailable in this account.", "INVALID_ASSIST_PARTY", 422);
  if (input.suppliers.length !== new Set(input.suppliers.map(p => p.partyId + ":" + p.role)).size) throw new DomainError("Remove duplicate party scopes.", "INVALID_ASSIST_PARTY", 422);
  if (input.hts.length !== new Set(input.hts).size) throw new DomainError("Remove duplicate HTS scopes.", "INVALID_ASSIST_SCOPE", 422);
}
function requireActivation(input: { importerOfRecordId: string | null; suppliers: unknown[]; hts: unknown[]; skuPattern: string | null; effectiveTo: Date | null; allocationMethod: string; allocationBasis: string; estimatedVolume: { toString(): string } | string | null; estimatedImportValue: { toString(): string } | string | null }) {
  if (!input.importerOfRecordId || !input.suppliers.length || (!input.hts.length && !input.skuPattern)) throw new DomainError("Choose an importer, supplier/manufacturer and HTS or SKU scope before activating.", "ASSIST_INCOMPLETE", 422);
  if (input.effectiveTo && input.effectiveTo < new Date()) throw new DomainError("Extend the effective end date before reactivating.", "ASSIST_EXPIRED", 422);
  if (input.allocationMethod === "equal_allocation") {
    const volume = new Decimal(input.estimatedVolume?.toString() ?? 0);
    if (volume.lte(0) || (input.allocationBasis === "entries" && !volume.isInteger())) throw new DomainError("Enter a positive estimated volume; entries must be whole numbers.", "ASSIST_INCOMPLETE", 422);
  }
  if (input.allocationMethod === "value_proportional" && new Decimal(input.estimatedImportValue?.toString() ?? 0).lte(0)) throw new DomainError("Enter the estimated import value in the assist currency.", "ASSIST_INCOMPLETE", 422);
}
function dataFromInput(input: AssistInput) {
  const { suppliers, hts, ...rest } = input;
  return { ...rest, effectiveFrom: new Date(input.effectiveFrom), effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
    suppliers: { create: suppliers }, hts: { create: hts.map(prefix => ({ prefix })) } };
}
export async function createAssist(accountId: string, userId: string, input: AssistInput) {
  await validateScope(accountId, input);
  const assist = await db.assist.create({ data: { ...dataFromInput(input), accountId, remainingValue: input.totalValue, createdByUserId: userId }, include: assistInclude });
  await createAuditLog({ accountId, userId, action: AuditAction.ASSIST_CREATED, entity: "Assist", entityId: assist.id, source: "UI" });
  return assist;
}
export async function updateAssist(accountId: string, userId: string, id: string, patch: AssistPatch) {
  const current = await getAssist(accountId, id);
  if (current.status === "Amortized") throw new DomainError("Amortized assists are read-only.", "ASSIST_READ_ONLY", 409);
  if (patch.input) await validateScope(accountId, patch.input);
  const declarations = await db.assistDeclaration.count({ where: { accountId, assistId: id } });
  if (patch.action === "edit" && !patch.input) throw new DomainError("Updated values are required.", "INVALID_INPUT", 422);
  if (patch.input && current.status === "Active") throw new DomainError("Suspend the assist before changing its scope or allocation.", "ASSIST_ACTIVE", 409);
  if (patch.input && declarations && (patch.input.currency !== current.currency || patch.input.importerOfRecordId !== current.importerOfRecordId || new Decimal(patch.input.totalValue).lt(new Decimal(current.totalValue.toString()).minus(current.remainingValue.toString())))) throw new DomainError("Declared currency/importer cannot change, and total cannot fall below the declared amount.", "ASSIST_HAS_DECLARATIONS", 409);
  const next = patch.input ? { ...current, ...patch.input, effectiveTo: patch.input.effectiveTo ? new Date(patch.input.effectiveTo) : null } : current;
  let status = current.status;
  if (patch.action === "activate" || patch.action === "reactivate") {
    if ((patch.action === "activate" && current.status !== "Draft") || (patch.action === "reactivate" && current.status !== "Suspended")) throw new DomainError("This status transition is not available.", "INVALID_ASSIST_TRANSITION", 409);
    requireActivation(next); status = "Active";
  }
  if (patch.action === "suspend") {
    if (current.status !== "Active") throw new DomainError("Only active assists can be suspended.", "INVALID_ASSIST_TRANSITION", 409);
    status = "Suspended";
  }
  const remaining = patch.input ? new Decimal(patch.input.totalValue).minus(new Decimal(current.totalValue.toString()).minus(current.remainingValue.toString())) : new Decimal(current.remainingValue.toString());
  if (status === "Active" && remaining.lte(0)) throw new DomainError("No balance remains to activate.", "ASSIST_NO_BALANCE", 409);
  await db.$transaction(async tx => {
    const { suppliers: _s, hts: _h, ...data } = patch.input ? dataFromInput(patch.input) : { suppliers: undefined, hts: undefined };
    void _s; void _h;
    const result = await tx.assist.updateMany({ where: { id, accountId, version: patch.version, status: current.status }, data: {
      ...data, status, remainingValue: remaining.toFixed(2), version: { increment: 1 },
      ...(patch.action === "reactivate" && remaining.gte(new Decimal(next.totalValue.toString()).times("0.1")) ? { warningEpoch: { increment: 1 } } : {}),
    } });
    if (result.count !== 1) throw assistConflict();
    if (patch.input) {
      await tx.assistParty.deleteMany({ where: { assistId: id, assist: { accountId } } });
      await tx.assistHtsScope.deleteMany({ where: { assistId: id, assist: { accountId } } });
      await tx.assistParty.createMany({ data: patch.input.suppliers.map(p => ({ ...p, assistId: id })) });
      await tx.assistHtsScope.createMany({ data: patch.input.hts.map(prefix => ({ prefix, assistId: id })) });
    }
  }, { isolationLevel: "Serializable" }).catch(rethrowWorkflowConflict);
  await createAuditLog({ accountId, userId, action: status === "Suspended" ? AuditAction.ASSIST_SUSPENDED : AuditAction.ASSIST_UPDATED, entity: "Assist", entityId: id, source: "UI", metadata: { transition: patch.action, status } });
  return getAssist(accountId, id);
}
