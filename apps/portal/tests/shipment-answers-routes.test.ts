import {beforeEach,describe,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({ctx:{accountId:'a1',userId:'u1',roleNames:['CUSTOMER_USER'],permissions:['portal.shipments.read','portal.invoices.read'],dataMode:'DEMO'},scope:{isAllClients:false,authorizedClientIds:['target'],teamIds:[]},db:{$queryRaw:vi.fn(),invoice:{findMany:vi.fn()},shipment:{findFirst:vi.fn(),findUnique:vi.fn()}}}));
vi.mock('../../../packages/auth/src/auth',()=>({getAccountContext:async()=>m.ctx}));
vi.mock('../../../packages/auth/src/scope-engine',()=>({getEffectiveUserScope:async()=>m.scope}));
vi.mock('@qubere/auth',async()=>({...await import('../../../packages/auth/src/portal-auth'),getAccountContext:async()=>m.ctx,getEffectiveUserScope:async()=>m.scope}));
vi.mock('@qubere/db',async()=>({...await import('../../../packages/db/src/services/portal-status-mapper'),db:m.db,withAccountIdContext: (_account: unknown, fn: () => unknown) => fn(), withDataModeContext:(_mode:unknown,fn:()=>unknown)=>fn(),isDataMode:()=>true}));
const route=await import('../src/app/api/shipments/[id]/answers/route');
const params={params:Promise.resolve({id:'s1'})};
beforeEach(()=>{vi.clearAllMocks();m.ctx.permissions=['portal.shipments.read','portal.invoices.read'];m.db.invoice.findMany.mockResolvedValue([]);m.db.$queryRaw.mockResolvedValue([]);m.db.shipment.findFirst.mockResolvedValue({accountId:'a1',clientId:'target',importerName:'Target'});m.db.shipment.findUnique.mockResolvedValue({id:'s1',shipmentNumber:'SHP1',status:'In Progress',customsFilings:[],entryProofs:[],etaObservations:[],trackingEvents:[],legs:[],trackingIdentifiers:[],shipmentCharges:[],invoiceLines:[],customerRequests:[],complianceDeadlines:[],pgaHolds:[],demurrageExposureUsd:null,actualBuyCost:1234,expectedBuyCost:4321,grossProfit:222,grossMarginPct:50,humanNotes:'PRIVATE'})});
describe('Shipment answers HTTP scope and redaction',()=>{
 it('never reads shipment content for another workspace',async()=>{m.db.shipment.findFirst.mockResolvedValue({accountId:'amazon-workspace',clientId:'amazon',importerName:'Amazon'});expect((await route.GET(new Request('http://portal/answers'),params)).status).toBe(404);expect(m.db.shipment.findUnique).not.toHaveBeenCalled()});
 it('returns an explicit safe projection even when ORM data contains internal costs',async()=>{const r=await route.GET(new Request('http://portal/answers'),params);expect(r.status).toBe(200);expect(r.headers.get('Cache-Control')).toBe('no-store');const content=JSON.stringify(await r.json());expect(content).not.toMatch(/actualBuyCost|expectedBuyCost|grossProfit|grossMarginPct|humanNotes|PRIVATE/);expect(m.db.shipment.findUnique.mock.calls[0][0].include).toBeUndefined();expect(m.db.shipment.findUnique.mock.calls[0][0].select.entryProofs).toBeUndefined();expect(m.db.shipment.findUnique.mock.calls[0][0].select.customerRequests.select.description).toBeUndefined();expect(m.db.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({accountId:'a1',lines:{some:{shipmentId:'s1'}}})}));expect(m.db.$queryRaw).not.toHaveBeenCalled()});
});

describe('Published proof cost summaries', () => {
 it('returns authoritative totals without transferring proof JSON and keeps partial costs marked', async () => {
  m.ctx.permissions.push('portal.entries.read');
  m.db.$queryRaw.mockResolvedValue([{ dutyAndFeesUsd: '150.25', complete: false }]);
  const response = await route.GET(new Request('http://portal/answers'), params);
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.cost.dutyAndFeesUsd).toBe(150.25);
  expect(body.cost.costIsPartial).toBe(true);
  const [template, ...values] = m.db.$queryRaw.mock.calls[0];
  const sql = template.join('?');
  expect(values).toEqual(['a1', 'DEMO', 's1', 's1']);
  expect(sql).not.toContain('p."clientId" = ?');
  expect(sql).toContain('a."dataMode"::text = ?');
  expect(sql).toContain("p.status = 'PUBLISHED'");
  expect(sql).toContain('f."customerVisibleAt" IS NOT NULL');
  expect(sql).toContain("'NOT_EVALUATED', 'DATA_UNAVAILABLE', 'REVIEW_REQUIRED'");
  expect(sql).toMatch(/SELECT p."dutyAndFeesUsd", NOT EXISTS/);
 });
 it('never runs proof SQL for another workspace', async () => {
  m.ctx.permissions.push('portal.entries.read');
  m.db.shipment.findFirst.mockResolvedValue({ accountId: 'amazon-workspace', clientId: 'amazon', importerName: 'Amazon' });
  expect((await route.GET(new Request('http://portal/answers'), params)).status).toBe(404);
  expect(m.db.$queryRaw).not.toHaveBeenCalled();
 });
});
