// @vitest-environment happy-dom
/**
 * Component-rendering coverage for ContainersTable, closing the "containers
 * have no structured list/table in the review UI" gap: ShipmentContainer rows
 * are extracted and persisted by the pipeline already (ContainerReconciler),
 * but were never rendered anywhere in the shipment workspace.
 */
import { describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { ContainersTable } from "@/app/app/shipments/[id]/ContainersTable";
import type { ShipmentContainerRow } from "@/app/app/shipments/[id]/workspaceTypes";

afterEach(cleanup);

function container(overrides: Partial<ShipmentContainerRow> = {}): ShipmentContainerRow {
  return {
    id: "cnt_1",
    containerNumber: "MSCU1234567",
    sealNumbers: ["SEAL001"],
    containerType: "Dry",
    containerSize: "40HC",
    packageCount: 12,
    descriptionOfGoods: "Apparel",
    grossWeight: 18500,
    weightUom: "KG",
    status: "Unreviewed",
    ...overrides,
  };
}

describe("ContainersTable", () => {
  it("renders a row per container with its structured fields", () => {
    render(<ContainersTable containers={[container()]} />);

    expect(screen.getByText("Containers (1)")).toBeInTheDocument();
    expect(screen.getByText("MSCU1234567")).toBeInTheDocument();
    expect(screen.getByText("SEAL001")).toBeInTheDocument();
    expect(screen.getByText("Dry")).toBeInTheDocument();
    expect(screen.getByText("40HC")).toBeInTheDocument();
    expect(screen.getByText("Apparel")).toBeInTheDocument();
    expect(screen.getByText("18,500 KG")).toBeInTheDocument();
  });

  it("sorts containers by container number", () => {
    render(
      <ContainersTable
        containers={[
          container({ id: "cnt_2", containerNumber: "ZIMU2000000" }),
          container({ id: "cnt_1", containerNumber: "APLU1000000" }),
        ]}
      />
    );

    const cells = screen.getAllByRole("cell", { name: /U\d{7}/ });
    expect(cells[0]).toHaveTextContent("APLU1000000");
  });

  it("shows placeholders for a container with no seal, type, or weight", () => {
    render(
      <ContainersTable
        containers={[
          container({
            sealNumbers: [],
            containerType: null,
            containerSize: null,
            descriptionOfGoods: null,
            grossWeight: null,
            weightUom: null,
          }),
        ]}
      />
    );

    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(4);
  });

  it("renders an empty state when the shipment has no extracted containers", () => {
    render(<ContainersTable containers={[]} />);

    expect(screen.getByText("Containers (0)")).toBeInTheDocument();
    expect(screen.getByText("No Containers Extracted")).toBeInTheDocument();
  });
});
