import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
import {OpenSignProvider} from '@/lib/esign/providers/openSignProvider';
beforeEach(()=>vi.stubEnv('OPEN_SIGN_WEBHOOK_SECRET',''));
afterEach(()=>vi.unstubAllEnvs());
describe('OpenSign completion authentication',()=>{
 it('rejects unsigned callbacks before parsing their contents',()=>{vi.stubEnv('OPENSIGN_WEBHOOK_SECRET','secret');expect(()=>new OpenSignProvider().parseWebhook({},Buffer.from('{"IsCompleted":true}'))).toThrow('authentication')});
 it('fails closed when no webhook secret is configured',()=>{vi.stubEnv('OPENSIGN_WEBHOOK_SECRET','');expect(()=>new OpenSignProvider().parseWebhook({'x-qubere-webhook-secret':''},Buffer.from('{}'))).toThrow('authentication')});
 it('accepts the authenticated completion signal with its envelope identity',()=>{vi.stubEnv('OPENSIGN_WEBHOOK_SECRET','secret');expect(new OpenSignProvider().parseWebhook({'x-qubere-webhook-secret':'secret'},Buffer.from('{"objectId":"doc1","IsCompleted":true}'))).toMatchObject({providerEnvelopeId:'doc1',eventType:'completed'})});
 it('prefers the canonical URL secret over a legacy header when both are configured',()=>{
  vi.stubEnv('OPEN_SIGN_WEBHOOK_SECRET','canonical');vi.stubEnv('OPENSIGN_WEBHOOK_SECRET','legacy');
  const p=new OpenSignProvider(), body=Buffer.from('{"objectId":"doc1","IsCompleted":true}');
  expect(()=>p.parseWebhook({'x-qubere-webhook-secret':'legacy'},body,'https://portal/webhook')).toThrow('authentication');
  expect(p.parseWebhook({},body,'https://portal/webhook?secret=canonical').eventType).toBe('completed');
 });
});
