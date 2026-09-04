import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import type { PgaAgencyDataPayload } from '@/lib/abi/pgaMessageSet/types';

describe('CATAIR Gap Closure Schema Validation', () => {
  it('validates Prisma model exports exist in Prisma.ModelName enum/keys', () => {
    const models = Object.keys(Prisma.ModelName);

    expect(models).toContain('CensusWarningOverride');
    expect(models).toContain('FilingFeeLine');
    expect(models).toContain('FtzDetail');
    expect(models).toContain('AdcvdLineDetail');
    expect(models).toContain('DrawbackImportLink');
    expect(models).toContain('DrawbackExportDestroy');
    expect(models).toContain('DrawbackTfteaLine');
    expect(models).toContain('DrawbackNaftaUsmcaLine');
    expect(models).toContain('CargoReleaseBillOfLading');
    expect(models).toContain('BondParty');
    expect(models).toContain('InBondRecord');
    expect(models).toContain('InBondEvent');
    expect(models).toContain('ManifestRecord');
    expect(models).toContain('StatementRecord');
    expect(models).toContain('StatementFeeLine');
  });

  it('validates PgaAgencyDataPayload TypeScript interface typing', () => {
    const samplePayload: PgaAgencyDataPayload = {
      fda: {
        priorNoticeConfirmationNumber: 'PNC12345678',
        canDimensions: {
          diameterInches: '03',
          diameterSixteenths: '00',
          heightInches: '04',
          heightSixteenths: '07',
        },
      },
      epa: {
        vehicleEngineClass: 'HDV',
        modelYear: '2026',
      },
      fws: {
        genusName: 'Panthera',
        speciesName: 'leo',
      },
      noaa: {
        vesselName: 'Pacific Harvest',
        vesselFlagState: 'US',
      },
    };

    expect(samplePayload.fda?.priorNoticeConfirmationNumber).toBe('PNC12345678');
    expect(samplePayload.epa?.vehicleEngineClass).toBe('HDV');
    expect(samplePayload.fws?.genusName).toBe('Panthera');
    expect(samplePayload.noaa?.vesselName).toBe('Pacific Harvest');
  });
});
