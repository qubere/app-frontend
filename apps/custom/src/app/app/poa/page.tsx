import { permanentRedirect } from "next/navigation";

export default function LegacyPoaPage() {
  permanentRedirect("/app/importers?view=poa");
}
