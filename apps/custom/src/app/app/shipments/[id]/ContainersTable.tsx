import type { ShipmentContainerRow } from "./workspaceTypes";

interface ContainersTableProps {
  containers: ShipmentContainerRow[];
}

/** Read-only structured view of a shipment's containers -- extracted by the
 * pipeline (Bill of Lading, Forwarding Instruction, Booking Request, Packing
 * List) but, until now, never surfaced anywhere in the review UI. */
export function ContainersTable({ containers }: ContainersTableProps) {
  const orderedContainers = [...containers].sort((a, b) =>
    a.containerNumber.localeCompare(b.containerNumber)
  );

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center justify-between text-xs font-bold text-ink">
        <span>Containers ({containers.length})</span>
      </div>
      {containers.length > 0 ? (
        <div className="border border-border rounded-xl text-xs max-h-96 overflow-y-auto">
          <table className="w-full table-fixed text-left border-collapse">
            <thead className="bg-surface-muted text-[10px] font-bold text-ink-muted uppercase border-b border-border">
              <tr>
                <th className="p-2.5 w-[20%]">Container #</th>
                <th className="p-2.5 w-[16%]">Seal #</th>
                <th className="p-2.5 w-[12%]">Type</th>
                <th className="p-2.5 w-[10%]">Size</th>
                <th className="p-2.5 w-[27%]">Description of Goods</th>
                <th className="p-2.5 w-[15%] text-right">Gross Weight</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orderedContainers.map((container) => (
                <tr key={container.id} className="hover:bg-surface-muted/30 transition-colors">
                  <td className="p-2.5 font-mono font-semibold text-ink">{container.containerNumber}</td>
                  <td className="p-2.5 font-mono text-ink-muted break-words">
                    {container.sealNumbers.length > 0 ? container.sealNumbers.join(", ") : "—"}
                  </td>
                  <td className="p-2.5 text-ink">{container.containerType || "—"}</td>
                  <td className="p-2.5 text-ink">{container.containerSize || "—"}</td>
                  <td className="p-2.5 text-ink break-words">{container.descriptionOfGoods || "—"}</td>
                  <td className="p-2.5 text-right font-mono">
                    {container.grossWeight != null
                      ? `${container.grossWeight.toLocaleString()}${container.weightUom ? ` ${container.weightUom}` : ""}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
          <p className="font-bold">No Containers Extracted</p>
          <p className="text-[11px]">Containers will appear here automatically upon document vision extraction.</p>
        </div>
      )}
    </div>
  );
}
