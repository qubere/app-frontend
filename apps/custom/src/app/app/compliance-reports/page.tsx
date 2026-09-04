import { redirect } from "next/navigation";

// Compliance Reports is now the "Reports" tab of the Compliance workspace.
// Forward the old route and its deep links.
export default function ComplianceReportsPage() {
  redirect("/app/compliance?tab=reports");
}
