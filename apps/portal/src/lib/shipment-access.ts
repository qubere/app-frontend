import { hasRequiredPortalPermission, type AccountContext } from '@qubere/auth';

export function freightReadPermission(ctx: AccountContext) {
  return hasRequiredPortalPermission(ctx, 'portal.orders.read') ? 'portal.orders.read' : 'portal.tms.read';
}

/** Freight-only access applies only to a shipment in an active TMS workspace. */
export function shipmentReadPermission(ctx: AccountContext, workspaces: { product: string; status: string }[]) {
  if (hasRequiredPortalPermission(ctx, 'portal.shipments.read')) return 'portal.shipments.read';
  return workspaces.some(w => w.product === 'TMS' && w.status === 'ACTIVE')
    ? freightReadPermission(ctx)
    : 'portal.shipments.read';
}
