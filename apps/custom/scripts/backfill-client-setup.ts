/** npx tsx --tsconfig apps/custom/tsconfig.json apps/custom/scripts/backfill-client-setup.ts --account-id <id> */
import {db,runWithAccountId,runWithDataMode} from '@qubere/db';
import {syncClientSetup} from '@qubere/db/services/client-setup-service';
import {parseArgs} from 'node:util';
const {values}=parseArgs({options:{'account-id':{type:'string'}}});
if(!values['account-id'])throw new Error('An explicit --account-id is required');
runWithDataMode(null,()=>runWithAccountId(values['account-id']!,async()=>{const clients=await db.client.findMany({where:{accountId:values['account-id']}});for(const c of clients)await syncClientSetup(c.accountId,c.id);console.log(`Updated setup for ${clients.length} clients; no invitations or emails sent.`)})).catch(e=>{console.error(e instanceof Error?e.message:'Backfill failed');process.exitCode=1}).finally(()=>db.$disconnect());
