export type DataMode = "PRODUCTION" | "SANDBOX" | "TEST";

export function dataModeFooterLabel(mode: DataMode): string {
  switch (mode) {
    case "SANDBOX":
      return "Sandbox Environment";
    case "TEST":
      return "Test / Staging Mode";
    case "PRODUCTION":
    default:
      return "Production Environment";
  }
}
