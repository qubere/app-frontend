export interface SetupSummary {
  inboundAddress?: { address: string; purpose: string } | null;
    clientId: string | null;
    clientName: string;
    brokerName: string;
    importers: ImporterSetup[];
    onboarding: {
        status: string;
        path: string | null;
        activatedAt: string | null;
        steps: {
            key: string;
            label: string;
            state: string;
        }[];
        blockers: string[];
    };
    importer: {
        legalName: string;
        ein: string;
        cbpImporterNumber: string | null;
        registrationStatus: string;
    } | null;
    bond: {
        type: string;
        surety: string;
        number: string;
        amountUsd: number;
        activityCode: string | null;
        expirationDate: string | null;
        status: string;
    } | null;
    poa: {
        status: string;
        executionMethod: string | null;
        signerName: string | null;
        signedDate: string | null;
        expirationDate: string | null;
        documentId: string | null;
        downloadUrl?: string | null;
    } | null;
    screening: {
        status: string;
        lastRunAt: string | null;
    };
    documents: {
        id: string;
        kind: string;
        downloadUrl?: string;
        title: string;
        expirationDate: string | null;
    }[];
    stakeholders: {
        name: string;
        role: string;
        title: string | null;
        isSigner: boolean;
        loginStatus: string;
    }[];
    brokerTeam: {
        name: string;
        role: string;
        email: string;
    }[];
}

export interface ImporterSetup {
    id: string;
    importer: NonNullable<SetupSummary['importer']>;
    onboardingCaseId: string | null;
    onboarding: SetupSummary['onboarding'];
    bond: SetupSummary['bond'];
    poa: SetupSummary['poa'];
    screening: SetupSummary['screening'];
}
