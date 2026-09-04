import { permanentRedirect } from "next/navigation";

export default function LegacyBondsPage() {
  permanentRedirect("/app/importers?view=bonds");
}
