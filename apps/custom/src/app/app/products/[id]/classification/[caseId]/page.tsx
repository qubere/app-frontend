"use client";

import { use } from "react";
import { ClassificationCaseDetail } from "@/app/app/classification/ClassificationCaseDetail";

export default function ProductClassificationCasePage({
  params,
}: {
  params: Promise<{ id: string; caseId: string }>;
}) {
  const { id, caseId } = use(params);
  return (
    <ClassificationCaseDetail
      caseId={caseId}
      backHref={`/app/products/${id}`}
      backLabel="Back to product"
    />
  );
}
