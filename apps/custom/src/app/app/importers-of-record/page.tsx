import { permanentRedirect } from "next/navigation";

export default function LegacyImportersPage() {
  permanentRedirect("/app/importers");
}
