import { getAccountContext } from "@/lib/auth";
import { BulkImportClient } from "./BulkImportClient";

export default async function BulkImportPage() {
  const context = await getAccountContext();
  if (!context) return null;
  return <BulkImportClient />;
}
