/**
 * scripts/seed-work-management-demo.ts
 *
 * Puts a real account into a state where all six Work Management demo
 * workflows (docs/plans/review/WORK-MANAGEMENT-PR100-REVIEW.md) can be shown
 * live, without waiting for agent-pipeline runs. Idempotent — safe to re-run;
 * it deletes and recreates its own demo artifacts each time.
 *
 * Creates / sets:
 *   - StageGatePolicy: COMPLIANCE = HUMAN_GATE (LICENSED_BROKER)
 *   - SlaPolicy defaults (decision 4/12/48h, exception 6/18/72h)
 *   - One EscalationRule: SLA breach + 2h -> team manager, in-app + email
 *   - A "Brokerage Ops" Team with the account owner as MANAGER
 *   - UserClientAssignment: owner -> first client (auto-route target)
 *   - 4 demo shipments positioned at interesting lifecycle stages:
 *       S1  COMPLIANCE / GATE_PENDING  + a "Stage Gate" review decision   (WF-3)
 *       S2  VALUATION  / IN_PROGRESS   + clean prior stages, 1 open review (WF-3 auto-advance on approve)
 *       S3  VALUATION  / BLOCKED       + tripped breaker + SYSTEM exception (WF-6)
 *       S4  CLASSIFICATION / IN_PROGRESS + 3 unassigned reviews, SLA 4h overdue (WF-4, WF-5)
 *
 * Run (from repo root):
 *   npx tsx apps/custom/scripts/seed-work-management-demo.ts ["Account Name"]
 */

import * as dotenv from "dotenv";
dotenv.config();

import { db } from "@qubere/db";

const STAGES = [
  "DOCUMENT_INTAKE",
  "CLASSIFICATION",
  "VALUATION",
  "ORIGIN",
  "COMPLIANCE",
  "FILING_PREP",
  "READY_TO_FILE",
] as const;

const HOURS = (n: number) => new Date(Date.now() + n * 3_600_000);

/** Every seeded AgentDecision.purpose starts with this so re-runs can clean up. */
const DEMO_TAG = "Demo seed:";

async function main() {
  const accountName = process.argv[2];

  const account = accountName
    ? await db.account.findFirst({ where: { name: accountName } })
    : await db.account.findFirst({
        where: { shipments: { some: { deletedAt: null } } },
        orderBy: { createdAt: "asc" },
      });

  if (!account) {
    throw new Error(
      accountName
        ? `No account named "${accountName}"`
        : "No account with shipments found — pass an account name as arg 1"
    );
  }
  console.log(`\n▶ Seeding Work Management demo for account: ${account.name} (${account.id})`);

  // ── Actors ────────────────────────────────────────────────────────────────
  const members = await db.accountMembership.findMany({
    where: { accountId: account.id, status: "ACTIVE" },
    include: { user: true },
  });
  if (members.length === 0) throw new Error("Account has no active members");

  const owner =
    members.find((m) => m.userId === account.ownerUserId)?.user ?? members[0].user;
  let broker = members.find((m) => m.user.brokerLicenseNumber)?.user ?? null;
  if (!broker) {
    broker = members.find((m) => m.userId !== owner.id)?.user ?? owner;
    await db.user.update({
      where: { id: broker.id },
      data: { brokerLicenseNumber: broker.brokerLicenseNumber ?? "CHB-DEMO-12345" },
    });
    console.log(`  · marked ${broker.email} as licensed broker (CHB-DEMO-12345)`);
  }

  // ── Team + manager (escalation target) ────────────────────────────────────
  const team = await db.team.upsert({
    where: { accountId_name: { accountId: account.id, name: "Brokerage Ops" } },
    create: { accountId: account.id, name: "Brokerage Ops", description: "Demo ops team" },
    update: {},
  });
  await db.accountTeamMembership.upsert({
    where: { teamId_userId: { teamId: team.id, userId: owner.id } },
    create: { teamId: team.id, userId: owner.id, role: "MANAGER" },
    update: { role: "MANAGER" },
  });
  if (broker.id !== owner.id) {
    await db.accountTeamMembership.upsert({
      where: { teamId_userId: { teamId: team.id, userId: broker.id } },
      create: { teamId: team.id, userId: broker.id, role: "MEMBER" },
      update: {},
    });
  }
  console.log(`  · team "Brokerage Ops" — ${owner.email} is MANAGER`);

  // ── Config: stage gate, SLA, escalation ──────────────────────────────────
  // (entryType / priority are nullable, so these can't use a compound-key
  // upsert — findFirst + create/update, same as the runtime code.)
  const gateFields = {
    mode: "HUMAN_GATE",
    minimumReviewerRole: "LICENSED_BROKER",
    requireLicensedBroker: true,
    gateReason: "PGA / AD-CVD exposure review before filing prep",
  };
  const existingGate = await db.stageGatePolicy.findFirst({
    where: { accountId: account.id, stage: "COMPLIANCE", entryType: null },
  });
  if (existingGate) {
    await db.stageGatePolicy.update({ where: { id: existingGate.id }, data: gateFields });
  } else {
    await db.stageGatePolicy.create({
      data: { accountId: account.id, stage: "COMPLIANCE", entryType: null, createdBy: owner.id, ...gateFields },
    });
  }

  const slaRows: Array<[string, string, number]> = [
    ["decision", "critical", 4],
    ["decision", "high", 12],
    ["decision", "normal", 48],
    ["exception", "critical", 6],
    ["exception", "high", 18],
    ["exception", "normal", 72],
  ];
  for (const [workKind, priority, reviewHours] of slaRows) {
    const existingSla = await db.slaPolicy.findFirst({
      where: { accountId: account.id, workKind, priority },
    });
    if (existingSla) {
      await db.slaPolicy.update({ where: { id: existingSla.id }, data: { reviewHours } });
    } else {
      await db.slaPolicy.create({
        data: { accountId: account.id, workKind, priority, reviewHours, businessHoursOnly: true },
      });
    }
  }

  await db.escalationRule.deleteMany({
    where: { accountId: account.id, escalateTo: "TEAM_MANAGER", trigger: "SLA_BREACH" },
  });
  await db.escalationRule.create({
    data: {
      accountId: account.id,
      appliesToKinds: ["decision", "exception"],
      trigger: "SLA_BREACH",
      thresholdHours: 2,
      escalateTo: "TEAM_MANAGER",
      maxLevel: 2,
      notifyChannel: "both",
      active: true,
    },
  });
  console.log("  · stage-gate + SLA policies + escalation rule set");

  // ── Pick 4 shipments ─────────────────────────────────────────────────────
  const shipments = await db.shipment.findMany({
    where: { accountId: account.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 4,
    select: { id: true, shipmentNumber: true, clientId: true },
  });
  if (shipments.length < 4) {
    throw new Error(`Need at least 4 shipments on ${account.name}, found ${shipments.length}`);
  }
  const [s1, s2, s3, s4] = shipments;

  // Auto-route target for WF-4: the owner is assigned to S2's client, so work
  // on S2 auto-routes; S4's reviews stay genuinely unassigned for the demo.
  if (s2.clientId) {
    await db.userClientAssignment.upsert({
      where: { userId_clientId: { userId: owner.id, clientId: s2.clientId } },
      create: { userId: owner.id, clientId: s2.clientId, assignedBy: owner.id },
      update: {},
    });
  }

  const shipmentIds = shipments.map((s) => s.id);

  // ── Reset prior demo artifacts on these shipments ────────────────────────
  await db.shipmentStageHistory.deleteMany({ where: { shipmentId: { in: shipmentIds } } });
  await db.pipelineStageRun.deleteMany({ where: { shipmentId: { in: shipmentIds } } });
  await db.agentDecision.deleteMany({
    where: {
      shipmentId: { in: shipmentIds },
      OR: [{ agentName: "Stage Gate" }, { purpose: { startsWith: DEMO_TAG } }],
    },
  });
  await db.exceptionItem.deleteMany({
    where: { shipmentId: { in: shipmentIds }, sourceAgent: "Workflow Engine", category: "SYSTEM" },
  });

  const now = new Date();
  const historyThrough = async (shipmentId: string, upToIdx: number, activeStatus: string) => {
    for (let i = 0; i <= upToIdx; i++) {
      await db.shipmentStageHistory.create({
        data: {
          accountId: account.id,
          shipmentId,
          stage: STAGES[i],
          enteredAt: new Date(now.getTime() - (upToIdx - i + 1) * 3_600_000),
          exitedAt: i < upToIdx ? new Date(now.getTime() - (upToIdx - i) * 3_600_000) : null,
          outcome: i < upToIdx ? "ADVANCED" : null,
          advancedBy: "SYSTEM",
        },
      });
    }
    await db.shipment.update({
      where: { id: shipmentId },
      data: {
        currentStage: STAGES[upToIdx],
        stageStatus: activeStatus,
        stageEnteredAt: new Date(now.getTime() - 3_600_000),
        stageUpdatedAt: now,
        autoAdvance: true,
      },
    });
  };

  // Uses the REAL agent name so buildStageCheckContext counts the stage's
  // agent as complete; the DEMO_TAG purpose is what makes it cleanable.
  const cleanDecision = (
    shipmentId: string,
    agentName: string,
    summary: string,
    triageState: string
  ) =>
    db.agentDecision.create({
      data: {
        accountId: account.id,
        shipmentId,
        agentName,
        status: triageState === "NEEDS_REVIEW" ? "Review Required" : "Completed",
        triageState,
        decisionSummary: summary,
        purpose: `${DEMO_TAG} ${agentName}`,
        dataSources: ["Demo Seed"],
      },
    });

  // ── S1 — COMPLIANCE / GATE_PENDING (WF-3) ────────────────────────────────
  await historyThrough(s1.id, 4, "GATE_PENDING");
  for (const [agent, name] of [
    ["Document Intake Agent", "documents classified"],
    ["Document Intelligence Agent", "fields extracted"],
    ["HTS Classification Agent", "all lines classified, 96% conf"],
    ["Product Intelligence Agent", "product master matched"],
    ["Valuation Agent", "customs value computed"],
    ["Origin Agent", "origin confirmed IN"],
    ["Compliance Agent", "PGA + AD/CVD screen clear"],
  ] as const) {
    await cleanDecision(s1.id, agent, name, "AUTO_VERIFIED");
  }
  await db.agentDecision.create({
    data: {
      accountId: account.id,
      shipmentId: s1.id,
      agentName: "Stage Gate",
      status: "Review Required",
      triageState: "NEEDS_REVIEW",
      purpose: "Human gate review for stage COMPLIANCE",
      decisionSummary: "Compliance stage complete — licensed broker approval required before Filing Prep.",
      dataSources: ["Stage Gate Policy", "Workflow Engine"],
      assignedToUserId: broker.id,
      assignedAt: now,
      assignedBy: "SYSTEM",
      assignmentSource: "CLIENT_ROUTE",
      reviewSlaDueAt: HOURS(4),
    },
  });
  console.log(`  · S1 ${s1.shipmentNumber} → COMPLIANCE / GATE_PENDING (assigned to ${broker.email})`);

  // ── S2 — VALUATION / IN_PROGRESS, one open review (WF-3 auto-advance) ────
  // Every downstream stage's agent decision is already clean, so approving
  // the one open Valuation review cascades VALUATION → ORIGIN → COMPLIANCE
  // and stops at the COMPLIANCE human gate.
  await historyThrough(s2.id, 2, "IN_PROGRESS");
  await cleanDecision(s2.id, "Document Intake Agent", "documents classified", "AUTO_VERIFIED");
  await cleanDecision(s2.id, "Document Intelligence Agent", "fields extracted", "AUTO_VERIFIED");
  await cleanDecision(s2.id, "HTS Classification Agent", "all lines classified", "AUTO_VERIFIED");
  await cleanDecision(s2.id, "Product Intelligence Agent", "product master matched", "AUTO_VERIFIED");
  await cleanDecision(s2.id, "Origin Agent", "origin confirmed IN", "AUTO_VERIFIED");
  await cleanDecision(s2.id, "Compliance Agent", "PGA + AD/CVD screen clear", "AUTO_VERIFIED");
  await db.agentDecision.create({
    data: {
      accountId: account.id,
      shipmentId: s2.id,
      agentName: "Valuation Agent",
      status: "Review Required",
      triageState: "NEEDS_REVIEW",
      purpose: `${DEMO_TAG} Valuation Agent (review)`,
      decisionSummary: "Assist (tooling) allocation needs review — approve to complete Valuation.",
      dataSources: ["Demo Seed"],
      reviewSlaDueAt: HOURS(10),
    },
  });
  console.log(`  · S2 ${s2.shipmentNumber} → VALUATION / IN_PROGRESS (approve the Valuation review to watch it auto-advance to the COMPLIANCE gate)`);

  // ── S3 — VALUATION / BLOCKED, tripped breaker (WF-6) ─────────────────────
  await historyThrough(s3.id, 2, "BLOCKED");
  for (let attempt = 1; attempt <= 3; attempt++) {
    await db.pipelineStageRun.create({
      data: {
        accountId: account.id,
        shipmentId: s3.id,
        stage: "VALUATION",
        attempt,
        status: attempt < 3 ? "FAILED" : "BREAKER_OPEN",
        failureReason: "Malformed commercial invoice — currency field unparseable",
        breakerTrippedAt: attempt === 3 ? now : null,
      },
    });
  }
  await db.shipmentStageHistory.create({
    data: {
      accountId: account.id,
      shipmentId: s3.id,
      stage: "VALUATION",
      enteredAt: now,
      outcome: "BREAKER_TRIPPED",
      note: "Circuit breaker tripped after 3 consecutive failed attempts",
    },
  });
  await db.exceptionItem.create({
    data: {
      accountId: account.id,
      shipmentId: s3.id,
      category: "SYSTEM",
      type: "broker_hold",
      severity: "Critical",
      description: "Valuation stage failed 3× — manual review required.",
      requiredAction:
        "Fix the commercial invoice currency, then Reset & retry from the stage stepper.",
      blocking: true,
      sourceAgent: "Workflow Engine",
      slaDueAt: HOURS(6),
    },
  });
  console.log(`  · S3 ${s3.shipmentNumber} → VALUATION / BLOCKED (circuit breaker open; use Reset & retry)`);

  // ── S4 — CLASSIFICATION, 3 unassigned overdue reviews (WF-4, WF-5) ───────
  await historyThrough(s4.id, 1, "IN_PROGRESS");
  const overdue = new Date(now.getTime() - 4 * 3_600_000); // 4h past due -> breaches, escalates
  for (const summary of [
    "Line 3 (control boards) — proposed 8537.10.2030, 71% conf, needs review",
    "Line 7 (wiring harness) — proposed 8544.42.9090, 64% conf, needs review",
    "Line 11 (enclosure) — proposed 8538.90.6000, 68% conf, needs review",
  ]) {
    await db.agentDecision.create({
      data: {
        accountId: account.id,
        shipmentId: s4.id,
        agentName: "HTS Classification Agent",
        status: "Review Required",
        triageState: "NEEDS_REVIEW",
        purpose: `${DEMO_TAG} HTS Classification Agent (review)`,
        decisionSummary: summary,
        dataSources: ["Demo Seed"],
        reviewSlaDueAt: overdue,
      },
    });
  }
  console.log(`  · S4 ${s4.shipmentNumber} → CLASSIFICATION with 3 unassigned reviews, SLA 4h overdue`);

  console.log(`
✓ Done. Demo runbook: docs/plans/review/WORK-MANAGEMENT-PR100-DEMO.md

   WF-3  open ${s1.shipmentNumber} → stage stepper → review the gate as ${broker.email}
   WF-3  approve the Valuation review on ${s2.shipmentNumber} → watch it advance to the gate
   WF-4  /app/actions → Unassigned tab → bulk-assign ${s4.shipmentNumber}'s reviews
   WF-5  POST /api/admin/work/run-sla-sweep → ${s4.shipmentNumber}'s reviews escalate to ${owner.email}
   WF-6  open ${s3.shipmentNumber} → stage stepper shows BLOCKED → Reset & retry
`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
