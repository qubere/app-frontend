import {afterEach,describe,expect,it,vi} from 'vitest';
import {OpenSignProvider} from '@/lib/esign/providers/openSignProvider';
afterEach(()=>vi.unstubAllEnvs());
describe('OpenSign completion authentication',()=>{
 it('rejects unsigned callbacks before parsing their contents',()=>{vi.stubEnv('OPENSIGN_WEBHOOK_SECRET','secret');expect(()=>new OpenSignProvider().parseWebhook({},Buffer.from('{"IsCompleted":true}'))).toThrow('authentication')});
 it('fails closed when no webhook secret is configured',()=>{vi.stubEnv('OPENSIGN_WEBHOOK_SECRET','');expect(()=>new OpenSignProvider().parseWebhook({'x-qubere-webhook-secret':''},Buffer.from('{}'))).toThrow('authentication')});
 it('accepts the authenticated completion signal with its envelope identity',()=>{vi.stubEnv('OPENSIGN_WEBHOOK_SECRET','secret');expect(new OpenSignProvider().parseWebhook({'x-qubere-webhook-secret':'secret'},Buffer.from('{"objectId":"doc1","IsCompleted":true}'))).toMatchObject({providerEnvelopeId:'doc1',eventType:'completed'})});
});
