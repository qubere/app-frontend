import { permanentRedirect } from "next/navigation";

export default function LegacyLegalEntitiesPage() {
  permanentRedirect("/app/importers");
}
