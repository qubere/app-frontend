import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@qubere/auth";
import { db } from "@qubere/db";
import { z } from "zod";

const MAX_SESSIONS_PER_USER = 20;

const createChatSchema = z.object({
  title: z.string().min(1).max(200),
  messages: z.array(z.unknown()).default([]),
  history: z.array(z.unknown()).default([]),
});

export const GET = withAuthenticatedRoute(
  async ({ req, ctx }) => {
    try {
      const { searchParams } = new URL(req.url);
      const limitParam = searchParams.get("limit") || searchParams.get("pageSize");
      const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 10, 1), 50) : 10;

      const sessions = await db.assistantChatSession.findMany({
        where: { accountId: ctx.accountId, userId: ctx.userId },
        orderBy: { updatedAt: "desc" },
        take: limit,
      });

      return NextResponse.json({ sessions });
    } catch (err) {
      console.error("Failed to fetch chat sessions:", err);
      return NextResponse.json({ sessions: [] });
    }
  }
);

export const POST = withAuthenticatedRoute(
  async ({ req, ctx }) => {
    try {
      const body = await req.json().catch(() => ({}));
      const parsed = createChatSchema.parse(body);

      const created = await db.assistantChatSession.create({
        data: {
          accountId: ctx.accountId,
          userId: ctx.userId,
          title: parsed.title,
          messages: parsed.messages as any,
          history: parsed.history as any,
        },
      });

      // Prune oldest sessions beyond max limit
      const stale = await db.assistantChatSession.findMany({
        where: { accountId: ctx.accountId, userId: ctx.userId },
        orderBy: { updatedAt: "desc" },
        skip: MAX_SESSIONS_PER_USER,
        select: { id: true },
      });
      if (stale.length > 0) {
        await db.assistantChatSession.deleteMany({
          where: { id: { in: stale.map((s) => s.id) }, accountId: ctx.accountId },
        });
      }

      return NextResponse.json({ session: created });
    } catch (err) {
      console.error("Failed to create chat session:", err);
      return NextResponse.json({ error: "Failed to create chat session" }, { status: 500 });
    }
  }
);
