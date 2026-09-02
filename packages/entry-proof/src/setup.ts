export interface SetupSummary {
 clientId:string;clientName:string;brokerName:string;
 onboarding:{status:string;path:string|null;activatedAt:string|null;steps:{key:string;label:string;state:string}[];blockers:string[]};
 importer:{legalName:string;ein:string;cbpImporterNumber:string|null;registrationStatus:string}|null;
 bond:{type:string;surety:string;number:string;amountUsd:number;activityCode:string|null;expirationDate:string|null;status:string}|null;
 poa:{status:string;executionMethod:string|null;signerName:string|null;signedDate:string|null;expirationDate:string|null;documentId:string|null}|null;
 screening:{status:string;lastRunAt:string|null};documents:{id:string;kind:string;title:string;expirationDate:string|null}[];
 stakeholders:{name:string;role:string;title:string|null;isSigner:boolean;loginStatus:string}[];
 brokerTeam:{name:string;role:string;email:string}[];
}
