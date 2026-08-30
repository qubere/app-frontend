import { describe, it, expect } from "vitest";
import { planTrackingIdentifiers } from "@/modules/shipments/trackingIdentifierSync";

describe("planTrackingIdentifiers", () => {
  it("returns nothing for empty metadata", () => {
    expect(planTrackingIdentifiers(null, "Bill of Lading")).toEqual([]);
    expect(planTrackingIdentifiers({}, "Bill of Lading")).toEqual([]);
  });

  it("maps a bill-of-lading number to MBL on a master BL", () => {
    const out = planTrackingIdentifiers({ transportDocumentNumber: "MAEU123456789" }, "Bill of Lading");
    expect(out).toEqual([{ type: "MBL", value: "MAEU123456789" }]);
  });

  it("maps a bill-of-lading number to HBL on a house BL", () => {
    const out = planTrackingIdentifiers({ billOfLading: "FFWD-0099" }, "House Bill of Lading");
    expect(out).toEqual([{ type: "HBL", value: "FFWD-0099" }]);
  });

  it("keeps only ISO 6346-valid container numbers from a delimited list", () => {
    const out = planTrackingIdentifiers(
      { containerNumber: "CSQU3054383, NOTACONTAINER, TCLU1234560" },
      "Packing List"
    );
    const values = out.filter((o) => o.type === "CONTAINER").map((o) => o.value);
    expect(values).toContain("CSQU3054383");
    expect(values).not.toContain("NOTACONTAINER");
  });

  it("maps air waybill + booking", () => {
    const out = planTrackingIdentifiers(
      { airWaybill: "020-12345678", bookingNumber: "BKG-55512" },
      "Air Waybill"
    );
    expect(out).toContainEqual({ type: "MAWB", value: "020-12345678" });
    expect(out).toContainEqual({ type: "BOOKING", value: "BKG-55512" });
  });

  it("dedupes the same identifier seen under two keys", () => {
    const out = planTrackingIdentifiers(
      { transportDocumentNumber: "MAEU123456789", blNumber: "MAEU123456789" },
      "Bill of Lading"
    );
    expect(out).toHaveLength(1);
  });
});
