import { z } from "zod";
import { canWrite, type AccountContext } from "@qubere/auth";

export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
}

export type CopilotToolAccess =
  | "ALL"
  | "ADMIN_ONLY"
  | { permission?: string; write?: boolean; confirmationRequired?: boolean };

export interface AssistantTool {
  declaration: FunctionDeclaration;
  schema: z.ZodObject<any>;
  access?: CopilotToolAccess;
  execute: (ctx: AccountContext, args: Record<string, unknown>) => Promise<unknown>;
}

export class AssistantToolRegistry {
  private tools = new Map<string, AssistantTool>();

  register(tool: AssistantTool): void {
    this.tools.set(tool.declaration.name, tool);
  }

  get(name: string): AssistantTool | undefined {
    return this.tools.get(name);
  }

  list(): AssistantTool[] {
    return Array.from(this.tools.values());
  }

  async execute(
    name: string,
    ctx: AccountContext,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const tool = this.get(name);
    if (!tool) {
      throw new Error(`Assistant tool '${name}' not found in registry.`);
    }

    const access = tool.access;
    if (access === "ADMIN_ONLY") {
      const isAdmin =
        ctx.isPlatformAdmin ||
        ctx.roleNames.some((role) => role === "OWNER" || role === "ADMIN");
      if (!isAdmin) throw new Error(`Assistant tool '${name}' requires an administrator role.`);
    } else if (access && access !== "ALL") {
      if (
        access.permission &&
        !ctx.isPlatformAdmin &&
        !ctx.permissions.includes(access.permission)
      ) {
        throw new Error(
          `Assistant tool '${name}' requires permission '${access.permission}'.`
        );
      }
      if (access.write && !canWrite(ctx)) {
        throw new Error(`Assistant tool '${name}' is not available to read-only users.`);
      }
    }

    if (
      access &&
      access !== "ALL" &&
      access !== "ADMIN_ONLY" &&
      access.confirmationRequired &&
      args.confirm !== true
    ) {
      throw new Error(`Assistant tool '${name}' requires explicit confirmation.`);
    }
    const parsedArgs = tool.schema.parse(args);
    return tool.execute(ctx, parsedArgs);
  }
}
