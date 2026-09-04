import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  try {
    const count = await prisma.filingProcedureConfig.count({
      where: {
        isActive: true,
        canCreateNewFiling: true
      }
    });
    
    console.log(`📊 FilingProcedureConfig records (active, canCreateNewFiling=true): ${count}\n`);
    
    if (count === 0) {
      console.log('❌ NO procedure configs found!');
      console.log('\nThis is why the "Create New Filing" modal shows "Failed to fetch procedures".');
      console.log('\nYou need to seed the FilingProcedureConfig table with at least one record.');
      console.log('\nExample for NL Import:');
      console.log(`
  INSERT INTO "FilingProcedureConfig" (
      id, country, procedureCode, messageName, 
      canCreateNewFiling, isActive, createdAt, updatedAt
  ) VALUES (
      'sample-nl-import', 
      'NL', 'NCTS', 'IE501', true, true, NOW(), NOW()
  );
        `);
      } else {
        const records = await prisma.filingProcedureConfig.findMany({
          where: {
            isActive: true,
            canCreateNewFiling: true
          },
          select: { country: true, procedureCode: true, messageName: true, filingSchemaId: true },
          take: 10
        });
      
        console.log('✅ Available procedures:\n');
        records.forEach(rec => {
          console.log(`  ${rec.country} | ${rec.procedureCode} | ${rec.messageName} | schema: ${rec.filingSchemaId ?? 'N/A'}`);
        });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

check();
