import { Suspense } from "react";
import { FilingNewClient } from "./FilingNewClient";

export default function FilingNewPage() {
  return (
    <Suspense fallback={null}>
      <FilingNewClient />
    </Suspense>
  );
}
