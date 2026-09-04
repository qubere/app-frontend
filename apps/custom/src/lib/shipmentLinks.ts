/**
 * Deep-links into the shipment workspace tab and opens a specific document
 * there. Not `?tab=documents` -- the shipment detail page reads a `view`
 * param, and its tab set has no "documents" value; `docId` on the workspace
 * view is what actually opens a document.
 */
export function shipmentDocumentViewerUrl(shipmentId: string, documentId: string): string {
  return `/app/shipments/${shipmentId}?view=workspace&docId=${documentId}`;
}
