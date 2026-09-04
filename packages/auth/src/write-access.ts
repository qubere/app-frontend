import { NextResponse } from "next/server";
import type { AccountContext } from "./auth";

export const READ_ONLY_MESSAGE = "Your role is read-only and cannot modify records.";

export function canWrite(
  ctx: Pick<AccountContext, "roleNames" | "isPlatformAdmin"> & { platformRoles?: string[] }
): boolean {
  if (ctx.platformRoles?.includes("SUPER_ADMIN_READ") || ctx.platformRoles?.includes("super-admin-read")) {
    return false;
  }
  if (ctx.isPlatformAdmin) return true;
  return ctx.roleNames.some((role) => role !== "VIEWER");
}

export function denyReadOnly(
  ctx: Pick<AccountContext, "roleNames" | "isPlatformAdmin">
): NextResponse | null {
  return canWrite(ctx) ? null : NextResponse.json({ error: READ_ONLY_MESSAGE }, { status: 403 });
}
