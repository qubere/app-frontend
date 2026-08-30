import { redirect } from "next/navigation";

// The Tariffs & Regulations hub only ever linked to Regulatory Updates and the
// Tariff Simulator, both of which are now their own sidebar rows under Data &
// Intelligence. Forward the old route (and its deep links / Copilot tool href).
export default function TariffsPage() {
  redirect("/app/regulatory");
}
