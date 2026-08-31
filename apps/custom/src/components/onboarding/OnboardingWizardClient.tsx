"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Circle, AlertCircle, Clock, Minus } from "lucide-react";
import { Button, Badge } from "@/components/ui";
import { StepLegalEntity } from "./steps/StepLegalEntity";
import { StepFiveOhSix } from "./steps/StepFiveOhSix";
import { StepBond } from "./steps/StepBond";
import StepPoa from "./steps/StepPoa";
import { StepBilling } from "./steps/StepBilling";
import { StepReviewActivate } from "./steps/StepReviewActivate";
import type { ChecklistItem, ChecklistStatus } from "@/modules/onboarding/readiness";

interface ReadinessResult {
  ready: boolean;
  checklist: ChecklistItem[];
}

interface FiveOhSixRecord {
  id: string;
  status: string;
  deliveryMethod: string | null;
  transmissionRef: string | null;
  submittedAt: string | null;
  payload: unknown;
}

interface OnboardingEntity {
  id: string;
  importerNumberType: string;
  importerNumber: string | null;
  bondCoverage: string;
  legalEntity: { legalName: string; entityType: string; taxIdentifier?: string | null } | null;
  importerOfRecord: { id: string; name: string } | null;
  poa: {
    id: string;
    status: string;
    executionMethod: string | null;
    signerName: string | null;
    signerTitle: string | null;
    signerRole: string | null;
    expirationDate: string | null;
    executedDocumentUrl: string | null;
    envelope: {
      id: string;
      provider: string;
      status: string;
      sentAt: string | null;
      completedAt: string | null;
    } | null;
  } | null;
  bond: {
    id: string;
    bondNumber: string;
    bondType: string;
    suretyName: string;
    suretyCode: string | null;
    bondAmount: string;
    activityCode: string | null;
    effectiveDate: string | null;
    expirationDate: string | null;
    status: string;
    lastVerifiedAt: string | null;
    verifications?: Array<{
      id: string;
      method: string;
      result: string;
      suretyCode: string | null;
      suretyName: string | null;
      queriedImporterNumber: string | null;
      responseRaw: string | null;
      discrepancies: unknown[] | null;
      performedAt: string;
    }>;
  } | null;
}

interface OnboardingCaseData {
  id: string;
  path: string;
  status: string;
  currentStep: number;
  stepStatus: Record<string, unknown>;
  client: { id: string; name: string; contactEmail?: string | null } | null;
  primaryImporter: { id: string; name: string } | null;
  entities: OnboardingEntity[];
  fiveOhSixRecords: FiveOhSixRecord[];
  readiness: ReadinessResult;
}

interface Props {
  initialCase: OnboardingCaseData;
  initialStep: number;
}

const STEPS = [
  { number: 1, label: "Legal entity" },
  { number: 2, label: "CBP 5106" },
  { number: 3, label: "Power of attorney" },
  { number: 4, label: "Customs bond" },
  { number: 5, label: "Screening" },
  { number: 6, label: "Billing & access" },
  { number: 7, label: "Review & activate" },
];

const CHECKLIST_STEPS: Record<string, number> = {
  legal_entity: 1,
  five_oh_six: 2,
  poa: 3,
  bond: 4,
  screening: 5,
  billing: 6,
};

const STATUS_VARIANTS: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  draft: "neutral",
  in_progress: "info",
  awaiting_bond: "warning",
  awaiting_signature: "warning",
  blocked_screening: "danger",
  blocked_bond: "danger",
  ready_to_activate: "success",
  active: "success",
  suspended: "warning",
  withdrawn: "neutral",
};

function stepStatusForChecklist(checklist: ChecklistItem[], stepNum: number): ChecklistStatus {
  const item = checklist.find((i) => CHECKLIST_STEPS[i.item] === stepNum);
  return item?.status ?? "todo";
}

function StepDot({ status }: { status: ChecklistStatus }) {
  if (status === "done") return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
  if (status === "blocked") return <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />;
  if (status === "in_progress") return <Clock className="h-4 w-4 text-blue-500 shrink-0" />;
  if (status === "waived") return <Minus className="h-4 w-4 text-ink-muted shrink-0" />;
  return <Circle className="h-4 w-4 text-gray-300 shrink-0" />;
}

export function OnboardingWizardClient({ initialCase, initialStep }: Props) {
  const router = useRouter();
  const [caseData, setCaseData] = useState(initialCase);
  const [activeStep, setActiveStep] = useState(initialStep);

  const { readiness } = caseData;
  const pathLabel = {
    STANDARD: "Standard",
    SWITCHING: "Broker switch",
    NON_RESIDENT: "Non-resident",
    BULK: "Bulk",
    ERP: "ERP",
  }[caseData.path] ?? caseData.path;

  async function refreshCase() {
    const res = await fetch(`/api/onboarding/cases/${caseData.id}`);
    if (res.ok) {
      const data = await res.json();
      setCaseData(data.case);
    }
  }

  function handleStepClick(stepNum: number) {
    if (stepNum > 1 && caseData.entities.length === 0) return;
    setActiveStep(stepNum);
  }

  function renderStep() {
    switch (activeStep) {
      case 1:
        return (
          <StepLegalEntity
            caseId={caseData.id}
            entities={caseData.entities as Parameters<typeof StepLegalEntity>[0]["entities"]}
            path={caseData.path}
            onSaved={async () => { await refreshCase(); setActiveStep(2); }}
          />
        );
      case 2:
        return (
          <StepFiveOhSix
            caseId={caseData.id}
            path={caseData.path}
            entities={caseData.entities}
            initialRecords={caseData.fiveOhSixRecords as unknown as Parameters<typeof StepFiveOhSix>[0]["initialRecords"]}
            onSaved={async () => { await refreshCase(); setActiveStep(3); }}
          />
        );
      case 3:
        return (
          <StepPoa
            caseId={caseData.id}
            entities={caseData.entities as Parameters<typeof StepPoa>[0]["entities"]}
            onSaved={async () => { await refreshCase(); setActiveStep(4); }}
          />
        );
      case 4:
        return (
          <StepBond
            caseId={caseData.id}
            entities={caseData.entities as Parameters<typeof StepBond>[0]["entities"]}
            onSaved={async () => { await refreshCase(); setActiveStep(5); }}
          />
        );
      case 6:
        return (
          <StepBilling
            caseId={caseData.id}
            client={caseData.client}
            stepStatus={caseData.stepStatus}
            onSaved={async () => { await refreshCase(); setActiveStep(7); }}
          />
        );
      case 7:
        return (
          <StepReviewActivate
            caseData={caseData}
            readiness={readiness}
            onActivated={() => { refreshCase(); router.push("/app/onboarding"); }}
            onStepClick={setActiveStep}
          />
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center py-20 text-center text-ink-muted gap-3">
            <Clock className="h-8 w-8 opacity-40" />
            <p className="font-medium">Step {activeStep} coming in Phase 2 / 3 / 4</p>
            <p className="text-sm max-w-sm mx-auto">
              {STEPS.find((s) => s.number === activeStep)?.label} is implemented in a later phase.
              Complete this step via manual methods and mark it waived from the review step if needed.
            </p>
            <div className="flex gap-2 mt-2">
              {activeStep < 7 && (
                <Button variant="secondary" onClick={() => setActiveStep(activeStep + 1)}>
                  Skip to next step
                </Button>
              )}
              <Button variant="secondary" onClick={() => setActiveStep(7)}>
                Go to review
              </Button>
            </div>
          </div>
        );
    }
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="border-b px-6 py-3 flex items-center gap-3 bg-white">
        <Link href="/app/onboarding" className="text-ink-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{caseData.client?.name ?? "Untitled case"}</div>
          {caseData.primaryImporter && (
            <div className="text-xs text-ink-muted">{caseData.primaryImporter.name}</div>
          )}
        </div>
        <Badge variant="neutral" className="shrink-0 text-xs">{pathLabel}</Badge>
        <Badge variant={STATUS_VARIANTS[caseData.status] ?? "neutral"} className="shrink-0">
          {caseData.status.replace(/_/g, " ")}
        </Badge>
        <Button variant="ghost" size="sm" onClick={() => router.push("/app/onboarding")}>
          Save &amp; exit
        </Button>
      </div>

      {/* Readiness footer strip */}
      <div className="border-b px-6 py-2 bg-surface-muted flex items-center gap-4 overflow-x-auto">
        {readiness.checklist.map((item) => (
          <button
            key={item.item}
            onClick={() => {
              const step = CHECKLIST_STEPS[item.item];
              if (step) setActiveStep(step);
            }}
            className="flex items-center gap-1.5 text-xs whitespace-nowrap hover:underline"
          >
            <StepDot status={item.status} />
            <span className={item.status === "blocked" ? "text-red-600" : item.status === "done" ? "text-emerald-700" : "text-ink-muted"}>
              {item.label}
            </span>
          </button>
        ))}
        <div className="ml-auto">
          {readiness.ready && (
            <Badge variant="success" className="text-xs">Ready to activate</Badge>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Step rail */}
        <nav className="w-56 border-r p-4 space-y-1 shrink-0 bg-white">
          {STEPS.map((step) => {
            const checklistStatus = stepStatusForChecklist(readiness.checklist, step.number);
            const isActive = step.number === activeStep;
            const isLocked = step.number > 1 && caseData.entities.length === 0;

            return (
              <button
                key={step.number}
                onClick={() => !isLocked && handleStepClick(step.number)}
                disabled={isLocked}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                  isActive
                    ? "bg-brand text-white font-medium"
                    : isLocked
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-surface-muted text-ink"
                }`}
              >
                {!isActive && <StepDot status={checklistStatus} />}
                {isActive && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                <span className="truncate">{step.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Step content */}
        <main className="flex-1 p-6 overflow-y-auto">
          {renderStep()}
        </main>
      </div>
    </div>
  );
}
