import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@qubere/auth";
import { db } from "@qubere/db";
import { z } from "zod";

const updateChatSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  messages: z.array(z.unknown()).optional(),
  history: z.array(z.unknown()).optional(),
});

export const GET = withAuthenticatedRoute<{ id: string }>(
  async ({ ctx, params }) => {
    const { id } = await params;
    const session = await db.assistantChatSession.findFirst({
      where: { id, accountId: ctx.accountId, userId: ctx.userId },
    });
    if (!session) {
      return NextResponse.json({ error: "Chat session not found" }, { status: 404 });
    }
    return NextResponse.json({ session });
  }
);

export const PATCH = withAuthenticatedRoute<{ id: string }>(
  async ({ req, ctx, params }) => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = updateChatSchema.parse(body);

    const existing = await db.assistantChatSession.findFirst({
      where: { id, accountId: ctx.accountId, userId: ctx.userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Chat session not found" }, { status: 404 });
    }

    const session = await db.assistantChatSession.update({
      where: { id: existing.id },
      data: {
        ...(parsed.title !== undefined && { title: parsed.title }),
        ...(parsed.messages !== undefined && { messages: parsed.messages as any }),
        ...(parsed.history !== undefined && { history: parsed.history as any }),
      },
    });

    return NextResponse.json({ session });
  }
);

export const DELETE = withAuthenticatedRoute<{ id: string }>(
  async ({ ctx, params }) => {
    const { id } = await params;
    const existing = await db.assistantChatSession.findFirst({
      where: { id, accountId: ctx.accountId, userId: ctx.userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Chat session not found" }, { status: 404 });
    }

    await db.assistantChatSession.delete({ where: { id: existing.id } });
    return NextResponse.json({ success: true });
  }
);
