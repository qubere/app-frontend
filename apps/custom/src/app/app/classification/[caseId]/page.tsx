"use client";

import { use } from "react";
import { ClassificationCaseDetail } from "../ClassificationCaseDetail";

export default function ClassificationCasePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = use(params);
  return (
    <ClassificationCaseDetail
      caseId={caseId}
      backHref="/app/classification"
      backLabel="Back to inbox"
    />
  );
}
