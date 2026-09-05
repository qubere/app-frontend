/**
 * The unified Qubere authorization & permissions catalogue.
 * Supports both Qubere Customs and Qubere TMS with product-specific catalogs,
 * atomic <resource>.<action> permissions, dynamic scope, and shared administration roles.
 */

export const SYSTEM_ROLES = [
  // Customs Roles
  "BROKER_ADMIN",
  "BROKER_MANAGER",
  "BROKER_SPECIALIST",
  "BROKER_VIEWER",
  "BROKER_BILLING",
  "BROKER_BILLING_MANAGER",
  "BROKER_BILLING_USER",
  "BROKER_BILLING_VIEWER",
  // TMS Roles
  "TMS_ADMIN",
  "TMS_MANAGER",
  "TMS_OPERATIONS",
  "TMS_DISPATCHER",
  "TMS_BILLING",
  "TMS_BILLING_MANAGER",
  "TMS_BILLING_USER",
  "TMS_BILLING_VIEWER",
  "TMS_VIEWER",
  // Qubere Customer Portal Roles
  "CUSTOMER_ADMIN",
  "CUSTOMER_USER",
  "CUSTOMER_VIEWER",
  "CUSTOMER_CUSTOMS_USER",
  "CUSTOMER_TMS_USER",
  // Qubere System Admin Roles
  "INTERNAL_ADMIN",
  "SUPER_ADMIN_READ",
  "SUPER_ADMIN_WRITE",
  // Legacy / Shared Aliases
  "OWNER",
  "ADMIN",
  "BROKER",
  "SPECIALIST",
  "REVIEWER",
  "MEMBER",
  "VIEWER",
] as const;

export type SystemRole = (typeof SYSTEM_ROLES)[number];

export type PermissionCategory =
  | "Client"
  | "Users"
  | "Shipment"
  | "Document"
  | "Entry"
  | "Classification"
  | "Origin"
  | "Valuation"
  | "Compliance"
  | "PGA"
  | "Filing"
  | "Reporting"
  | "Billing"
  | "Settings"
  | "Audit"
  | "Customer"
  | "Order"
  | "Load"
  | "Stop"
  | "Carrier"
  | "Rate"
  | "Tender"
  | "Tracking"
  | "Invoice"
  | "Integration"
  | "Freight"
  | "AI"
  | "System";

export interface PermissionDefinition {
  name: string;
  description: string;
  category: PermissionCategory;
  defaultRoles: readonly SystemRole[];
  /**
   * Names this permission was seeded under previously. Lets the seed tell a
   * rename apart from a brand-new permission and update the existing
   * Permission row's name in place -- preserving its id so every
   * RolePermission grant already pointing at it (system AND custom roles)
   * follows the rename automatically, instead of being left orphaned while a
   * duplicate row is created under the new name.
   */
  formerNames?: readonly string[];
}

const BILLING_ADMINS: readonly SystemRole[] = ["BROKER_ADMIN", "TMS_ADMIN", "OWNER", "ADMIN"];
const BILLING_MANAGERS: readonly SystemRole[] = [...BILLING_ADMINS, "BROKER_BILLING", "TMS_BILLING", "BROKER_BILLING_MANAGER", "TMS_BILLING_MANAGER"];
const BILLING_USERS: readonly SystemRole[] = [...BILLING_ADMINS, "BROKER_BILLING_USER", "TMS_BILLING_USER"];
const BILLING_VIEWERS: readonly SystemRole[] = [...BILLING_MANAGERS, ...BILLING_USERS, "BROKER_BILLING_VIEWER", "TMS_BILLING_VIEWER", "SUPER_ADMIN_READ"];

export const PERMISSION_CATALOGUE: readonly PermissionDefinition[] = [
  // ─── QUBERE CUSTOMS PERMISSIONS ──────────────────────────────────────────

  // Client
  { name: "client.read", description: "View client details and profile.", category: "Client", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "BROKER_BILLING", "SUPER_ADMIN_READ", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "MEMBER", "VIEWER"] },
  { name: "client.create", description: "Create new client records.", category: "Client", defaultRoles: ["BROKER_ADMIN", "OWNER", "ADMIN"] },
  { name: "client.update", description: "Update client settings and metadata.", category: "Client", defaultRoles: ["BROKER_ADMIN", "OWNER", "ADMIN"] },
  { name: "client.delete", description: "Delete client records.", category: "Client", defaultRoles: ["BROKER_ADMIN", "OWNER"] },
  { name: "client.assign_users", description: "Assign specialist users to client.", category: "Client", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "OWNER", "ADMIN"] },
  { name: "client.manage_settings", description: "Configure client-specific workspace settings.", category: "Client", defaultRoles: ["BROKER_ADMIN", "OWNER"] },

  // Onboarding
  { name: "onboarding.manage", description: "Create and manage importer onboarding cases, run wizard steps.", category: "Client", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "OWNER", "ADMIN"] },
  { name: "onboarding.activate", description: "Activate an importer (final wizard step — makes client filable).", category: "Client", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "OWNER", "ADMIN"] },

  // Broker compliance
  { name: "broker_compliance.manage", description: "Configure the broker's own license, permits, PQOs, and filer credentials.", category: "Settings", defaultRoles: ["BROKER_ADMIN", "OWNER"] },

  // Parties / bonds — these were phantom permissions; now real entries.
  { name: "parties.manage", description: "Create and update party and importer-of-record records.", category: "Client", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "OWNER", "ADMIN"] },
  { name: "bonds.manage", description: "Create, update, and verify customs bond records.", category: "Client", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "OWNER", "ADMIN"] },

  // Users
  { name: "user.read", description: "View workspace users.", category: "Users", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "BROKER_BILLING", "TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "TMS_BILLING", "TMS_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN", "MEMBER", "VIEWER"] },
  { name: "user.invite", description: "Invite new users to organization.", category: "Users", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "TMS_ADMIN", "TMS_MANAGER", "OWNER", "ADMIN"] },
  { name: "user.update", description: "Update user role assignments.", category: "Users", defaultRoles: ["BROKER_ADMIN", "TMS_ADMIN", "OWNER", "ADMIN"] },
  { name: "user.deactivate", description: "Deactivate user access.", category: "Users", defaultRoles: ["BROKER_ADMIN", "TMS_ADMIN", "OWNER", "ADMIN"] },
  { name: "user.assign_client", description: "Assign client access to user.", category: "Users", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "OWNER", "ADMIN"] },
  { name: "user.remove_client", description: "Remove client access from user.", category: "Users", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "OWNER", "ADMIN"] },

  // Customs Shipments
  { name: "shipment.read", description: "View customs shipments.", category: "Shipment", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "TMS_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "MEMBER", "VIEWER"] },
  { name: "shipment.create", description: "Create customs shipments.", category: "Shipment", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "MEMBER"] },
  { name: "shipment.update", description: "Update customs shipments.", category: "Shipment", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "MEMBER"] },
  { name: "shipment.delete", description: "Delete customs shipments.", category: "Shipment", defaultRoles: ["BROKER_ADMIN", "TMS_ADMIN", "OWNER", "ADMIN"] },
  { name: "shipment.assign", description: "Assign shipment to broker/user.", category: "Shipment", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "OWNER", "ADMIN"] },
  { name: "shipment.cancel", description: "Cancel active shipment.", category: "Shipment", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "TMS_ADMIN", "TMS_MANAGER", "TMS_DISPATCHER", "OWNER", "ADMIN"] },
  { name: "shipment.reopen", description: "Reopen cancelled shipment.", category: "Shipment", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "TMS_ADMIN", "TMS_MANAGER", "OWNER", "ADMIN"] },
  { name: "shipments.manage", description: "Run shipment-level operations: transport legs, stage transitions, on-demand reconciliation, exception resolution.", category: "Shipment", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "MEMBER"] },
  { name: "specialist.write", description: "Perform broker-specialist write actions: advance pipeline stages, assign or escalate work items, set document visibility.", category: "Shipment", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "MEMBER"] },

  // Documents
  { name: "document.read", description: "View attached trade documents.", category: "Document", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "TMS_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "MEMBER", "VIEWER"] },
  { name: "document.upload", description: "Upload trade documents.", category: "Document", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "MEMBER"] },
  { name: "document.update", description: "Update trade document metadata.", category: "Document", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "MEMBER"] },
  { name: "document.delete", description: "Delete trade document.", category: "Document", defaultRoles: ["BROKER_ADMIN", "TMS_ADMIN", "OWNER", "ADMIN"] },
  { name: "document.download", description: "Download trade document file.", category: "Document", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "TMS_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "MEMBER", "VIEWER"] },
  { name: "document.approve", description: "Approve extracted trade document.", category: "Document", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "TMS_ADMIN", "TMS_MANAGER", "OWNER", "ADMIN"] },
  { name: "document.request", description: "Request missing document from client.", category: "Document", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "OWNER", "ADMIN"] },

  // Customs Entries
  { name: "entry.read", description: "View entry summary and CBP details.", category: "Entry", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "MEMBER", "VIEWER"] },
  { name: "entry.create", description: "Create entry summary draft.", category: "Entry", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "OWNER", "ADMIN", "BROKER", "SPECIALIST"] },
  { name: "entry.update", description: "Update entry summary line items.", category: "Entry", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "OWNER", "ADMIN", "BROKER", "SPECIALIST"] },
  { name: "entry.validate", description: "Validate entry against CATAIR rules.", category: "Entry", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "OWNER", "ADMIN", "BROKER", "SPECIALIST"] },
  { name: "entry.approve", description: "Approve entry summary for transmission.", category: "Entry", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "OWNER", "ADMIN"] },
  { name: "entry.submit", description: "Transmit entry summary to CBP ACE.", category: "Entry", defaultRoles: ["BROKER_ADMIN", "OWNER", "ADMIN"] },
  { name: "entry.amend", description: "Amend transmitted entry (PSC/reconciliation).", category: "Entry", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "OWNER", "ADMIN"] },
  { name: "entry.cancel", description: "Cancel entry summary.", category: "Entry", defaultRoles: ["BROKER_ADMIN", "OWNER", "ADMIN"] },
  { name: "entry.reopen", description: "Reopen closed entry summary.", category: "Entry", defaultRoles: ["BROKER_ADMIN", "OWNER", "ADMIN"] },

  // Classification
  { name: "classification.read", description: "View HTS classification and AI rationale.", category: "Classification", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "MEMBER", "VIEWER"] },
  { name: "classification.create", description: "Suggest HTS code for line item.", category: "Classification", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "OWNER", "ADMIN", "BROKER", "SPECIALIST"] },
  { name: "classification.update", description: "Modify line item classification.", category: "Classification", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "OWNER", "ADMIN", "BROKER", "SPECIALIST"] },
  { name: "classification.approve", description: "Approve HTS classification.", category: "Classification", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "OWNER", "ADMIN"] },
  { name: "classification.override", description: "Override recommended classification.", category: "Classification", defaultRoles: ["BROKER_ADMIN", "OWNER", "ADMIN"] },

  // Origin
  { name: "origin.read", description: "View country of origin determination.", category: "Origin", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "VIEWER"] },
  { name: "origin.update", description: "Modify origin determination.", category: "Origin", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "OWNER", "ADMIN", "BROKER", "SPECIALIST"] },
  { name: "origin.approve", description: "Approve trade agreement origin.", category: "Origin", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "OWNER", "ADMIN"] },
  { name: "origin.override", description: "Override origin determination.", category: "Origin", defaultRoles: ["BROKER_ADMIN", "OWNER", "ADMIN"] },

  // Valuation
  { name: "valuation.read", description: "View customs valuation and additions/deductions.", category: "Valuation", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "VIEWER"] },
  { name: "valuation.update", description: "Modify entered values and assists.", category: "Valuation", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "OWNER", "ADMIN", "BROKER", "SPECIALIST"] },
  { name: "valuation.approve", description: "Approve customs valuation methodology.", category: "Valuation", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "OWNER", "ADMIN"] },
  { name: "valuation.override", description: "Override valuation calculations.", category: "Valuation", defaultRoles: ["BROKER_ADMIN", "OWNER", "ADMIN"] },

  // Compliance
  { name: "compliance.read", description: "View compliance checks and risk scores.", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "VIEWER"] },
  { name: "compliance.review", description: "Review compliance exceptions and warnings.", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "OWNER", "ADMIN", "BROKER", "SPECIALIST"] },
  { name: "compliance.approve", description: "Approve compliance clearance.", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "OWNER", "ADMIN"] },
  { name: "compliance.override", description: "Waive or override compliance exception.", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "OWNER", "ADMIN"] },
  { name: "compliance.restricted_party.approve", description: "Approve a Party for restricted-party screening reuse (pre-approval).", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "OWNER", "ADMIN"], formerNames: ["compliance.restricted_party_approve"] },
  { name: "compliance.restricted_party.revoke", description: "Revoke a Party's restricted-party screening pre-approval.", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "OWNER", "ADMIN"], formerNames: ["compliance.restricted_party_revoke"] },
  { name: "compliance.rdps.read", description: "View Continuous Party Monitoring (RDPS) runs, alerts, and reference-data changes.", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "VIEWER"] },
  { name: "compliance.rdps.manage", description: "Trigger manual/targeted RDPS scans and disposition RDPS worsening alerts.", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "OWNER", "ADMIN"] },
  { name: "compliance.community_screening.read", description: "View Community Screening runs, results, and findings.", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "VIEWER"] },
  { name: "compliance.community_screening.screen", description: "Run new Community Screening batches and rescreen failed/error/incomplete rows.", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "OWNER", "ADMIN", "BROKER", "SPECIALIST"] },
  { name: "compliance.community_screening.override", description: "Override Community Screening name/address thresholds, country-match, and red-flag settings for a run.", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "OWNER", "ADMIN"] },

  // Export/Import License Determination
  { name: "compliance.license_determination.view", description: "View license determination results.", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "VIEWER"], formerNames: ["license_determination.view", "licenseDetermination.view"] },
  { name: "compliance.license_determination.execute", description: "Run a new license determination.", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "OWNER", "ADMIN", "BROKER", "SPECIALIST"], formerNames: ["license_determination.execute", "licenseDetermination.execute"] },
  { name: "compliance.license_determination.review", description: "Disposition (verify/return-for-info) a license determination result.", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "OWNER", "ADMIN"], formerNames: ["license_determination.review", "licenseDetermination.review"] },
  { name: "compliance.license_determination.override", description: "Formally override a license determination result.", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "OWNER", "ADMIN"], formerNames: ["license_determination.override", "licenseDetermination.override"] },

  // Bulk Compliance Screening
  { name: "compliance.bulk_screening.view", description: "View Bulk Compliance Screening batches, records, and findings.", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "VIEWER"], formerNames: ["bulk_compliance.view"] },
  { name: "compliance.bulk_screening.create", description: "Upload and submit a new Bulk Compliance Screening batch.", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "OWNER", "ADMIN", "BROKER", "SPECIALIST"], formerNames: ["bulk_compliance.create"] },
  { name: "compliance.bulk_screening.cancel", description: "Cancel an in-progress Bulk Compliance Screening batch.", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "OWNER", "ADMIN", "BROKER"], formerNames: ["bulk_compliance.cancel"] },
  { name: "compliance.bulk_screening.retry", description: "Retry the failed records of a Bulk Compliance Screening batch.", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "OWNER", "ADMIN", "BROKER"], formerNames: ["bulk_compliance.retry"] },
  { name: "compliance.bulk_screening.rescreen", description: "Re-run screening on every record of a completed Bulk Compliance Screening batch.", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "OWNER", "ADMIN", "BROKER"], formerNames: ["bulk_compliance.rescreen"] },
  { name: "compliance.bulk_screening.download", description: "Download Bulk Compliance Screening batch artifacts.", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "OWNER", "ADMIN", "BROKER", "SPECIALIST"], formerNames: ["bulk_compliance.download"] },

  // License Management (managed authorization portfolio, utilization, allocation)
  { name: "licenses.view", description: "View the managed license portfolio, utilization, and events.", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "VIEWER"] },
  { name: "licenses.create", description: "Create new managed licenses and lines.", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "OWNER", "ADMIN"] },
  { name: "licenses.update", description: "Edit managed licenses, lines, notes, and status.", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "OWNER", "ADMIN"] },
  { name: "licenses.delete", description: "Close or remove a managed license.", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "OWNER", "ADMIN"] },
  { name: "licenses.manage_parties", description: "Add or remove Party associations on a managed license.", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "OWNER", "ADMIN"] },
  { name: "licenses.manage_documents", description: "Upload or remove documents attached to a managed license.", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "OWNER", "ADMIN", "BROKER", "SPECIALIST"] },
  { name: "licenses.allocate", description: "Reserve, release, or select a managed license against a determination.", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "OWNER", "ADMIN", "BROKER", "SPECIALIST"] },
  { name: "licenses.post_events", description: "Post utilization events (commitment/shipment/release/reversal) to a license line.", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "OWNER", "ADMIN"] },
  { name: "licenses.adjust", description: "Post manual utilization adjustments to a license line.", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "OWNER", "ADMIN"] },
  { name: "licenses.alerts", description: "View and manage license expiry/utilization alerts.", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "VIEWER"] },

  // PGA
  { name: "pga.read", description: "View PGA message set requirements.", category: "PGA", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "VIEWER"] },
  { name: "pga.update", description: "Update PGA program data.", category: "PGA", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "OWNER", "ADMIN", "BROKER", "SPECIALIST"] },
  { name: "pga.review", description: "Review PGA validation warnings.", category: "PGA", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "OWNER", "ADMIN", "BROKER"] },
  { name: "pga.approve", description: "Approve PGA message set for transmission.", category: "PGA", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "OWNER", "ADMIN"] },

  // Filing
  { name: "filing.read", description: "View customs filing status.", category: "Filing", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "VIEWER"] },
  { name: "filing.prepare", description: "Prepare filing package.", category: "Filing", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "OWNER", "ADMIN", "BROKER", "SPECIALIST"] },
  { name: "filing.validate", description: "Run pre-filing validation checks.", category: "Filing", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "OWNER", "ADMIN", "BROKER", "SPECIALIST"] },
  { name: "filing.submit", description: "Transmit filing package to customs API.", category: "Filing", defaultRoles: ["BROKER_ADMIN", "OWNER", "ADMIN"] },
  { name: "filing.amend", description: "Submit post-summary amendment.", category: "Filing", defaultRoles: ["BROKER_ADMIN", "OWNER", "ADMIN"] },
  { name: "filing.cancel", description: "Request filing cancellation.", category: "Filing", defaultRoles: ["BROKER_ADMIN", "OWNER", "ADMIN"] },
  { name: "filing.view_responses", description: "View raw ACE/CBP electronic responses.", category: "Filing", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "SUPER_ADMIN_READ", "OWNER", "ADMIN", "BROKER"] },

  // Entry Summary (CBP Form 7501) draft + ABI filer export — issue #219 Phase C (U12)
  { name: "filing.entry_summary.generate", description: "Generate/regenerate the validated 7501 entry summary draft.", category: "Filing", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "OWNER", "ADMIN", "BROKER", "SPECIALIST"] },
  { name: "filing.entry_summary.approve", description: "Approve a 7501 entry summary draft for export.", category: "Filing", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "OWNER", "ADMIN"] },
  { name: "filing.entry_summary.export", description: "Export an approved 7501 entry summary draft to a filer.", category: "Filing", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "OWNER", "ADMIN"] },
  { name: "filing.filer_profile.manage", description: "Create and manage ABI filer profiles.", category: "Filing", defaultRoles: ["BROKER_ADMIN", "OWNER", "ADMIN"] },

  // Post-entry recovery
  { name: "psc.read", description: "View post-summary corrections.", category: "Filing", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "MEMBER", "VIEWER"] },
  { name: "psc.create", description: "Create and update draft post-summary corrections.", category: "Filing", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "OWNER", "ADMIN", "BROKER", "SPECIALIST"] },
  { name: "psc.manage", description: "Submit, withdraw, and otherwise manage post-summary corrections.", category: "Filing", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "OWNER", "ADMIN"] },
  { name: "protest.read", description: "View customs protests and their supporting records.", category: "Filing", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "MEMBER", "VIEWER"] },
  { name: "protest.create", description: "Create and update draft customs protests, notes, and attachments.", category: "Filing", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "OWNER", "ADMIN", "BROKER", "SPECIALIST"] },
  { name: "protest.manage", description: "File, withdraw, and request further review of customs protests.", category: "Filing", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "OWNER", "ADMIN"] },

  // Reporting
  { name: "report.read", description: "View analytics reports and dashboards.", category: "Reporting", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "BROKER_BILLING", "TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_BILLING", "TMS_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "VIEWER"] },
  { name: "report.export", description: "Export report datasets to CSV/Excel.", category: "Reporting", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_BILLING", "TMS_ADMIN", "TMS_MANAGER", "TMS_BILLING", "OWNER", "ADMIN"] },
  { name: "dashboard.read", description: "Access operational command center dashboard.", category: "Reporting", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "BROKER_BILLING", "TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "TMS_BILLING", "TMS_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "VIEWER"] },

  // Compliance Reports (audit-ready screening/embargo/RDPS/exceptions reporting)
  { name: "compliance.reports.view", description: "View the Compliance Reports library, generated reports, and schedules.", category: "Reporting", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "VIEWER"] },
  { name: "compliance.reports.generate", description: "Generate and download compliance reports.", category: "Reporting", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "OWNER", "ADMIN", "BROKER", "SPECIALIST"] },
  { name: "compliance.reports.manage", description: "Create, share, and schedule saved compliance reports.", category: "Reporting", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "OWNER", "ADMIN"] },


  // Billing. Legacy umbrella codes remain registered during rollout, but all
  // financial mutations enforce the granular codes below.
  { name: "billing.view", description: "View the billing workspace overview and billing navigation.", category: "Billing", defaultRoles: BILLING_VIEWERS },
  { name: "billing.read", description: "View customer billing records and rate cards.", category: "Billing", defaultRoles: BILLING_VIEWERS },
  { name: "billing.create", description: "Legacy umbrella for creating customer billing records.", category: "Billing", defaultRoles: BILLING_USERS },
  { name: "billing.update", description: "Legacy umbrella for updating customer billing records.", category: "Billing", defaultRoles: BILLING_USERS },
  { name: "billing.approve", description: "Legacy umbrella for approving customer billing records.", category: "Billing", defaultRoles: BILLING_MANAGERS },
  { name: "billing.export", description: "Legacy umbrella for exporting billing data.", category: "Billing", defaultRoles: BILLING_USERS },
  { name: "billing.invoice.manage", description: "Legacy billing invoice administration umbrella.", category: "Billing", defaultRoles: BILLING_ADMINS },
  { name: "billing.ratecard.manage", description: "Legacy billing rate-card administration umbrella.", category: "Billing", defaultRoles: BILLING_ADMINS },

  { name: "billing.cost.view", description: "View internal shipment and platform costs.", category: "Billing", defaultRoles: BILLING_MANAGERS },
  { name: "billing.margin.view", description: "View gross profit, margin, and client profitability.", category: "Billing", defaultRoles: BILLING_MANAGERS },
  { name: "billing.ratecard.view", description: "View billing rate cards and simulation results.", category: "Billing", defaultRoles: BILLING_VIEWERS },
  { name: "billing.ratecard.create", description: "Create and duplicate draft rate cards and versions.", category: "Billing", defaultRoles: BILLING_USERS },
  { name: "billing.ratecard.upload", description: "Upload imported billing rate-card files.", category: "Billing", defaultRoles: BILLING_USERS },
  { name: "billing.ratecard.edit", description: "Edit draft rate cards and rate rules.", category: "Billing", defaultRoles: BILLING_USERS },
  { name: "billing.ratecard.activate", description: "Approve and activate a draft rate-card version.", category: "Billing", defaultRoles: BILLING_MANAGERS },
  { name: "billing.ratecard.retire", description: "Retire an active rate card.", category: "Billing", defaultRoles: BILLING_MANAGERS },
  { name: "billing.ratecard.duplicate", description: "Duplicate a rate card into a new draft.", category: "Billing", defaultRoles: BILLING_USERS },
  { name: "billing.mapping.view", description: "View rate-rule to billing-event mappings.", category: "Billing", defaultRoles: BILLING_VIEWERS },
  { name: "billing.mapping.edit", description: "Edit rate-rule to billing-event mappings.", category: "Billing", defaultRoles: BILLING_USERS },
  { name: "billing.usage.view", description: "View the immutable billing usage ledger.", category: "Billing", defaultRoles: BILLING_VIEWERS },
  { name: "billing.charge.view", description: "View shipment charge detail and calculation traces.", category: "Billing", defaultRoles: BILLING_VIEWERS },
  { name: "billing.charge.adjust", description: "Request permitted charge adjustments.", category: "Billing", defaultRoles: BILLING_USERS },
  { name: "billing.charge.waive", description: "Approve charge waivers.", category: "Billing", defaultRoles: BILLING_MANAGERS },
  { name: "billing.discount.create", description: "Create customer billing discounts.", category: "Billing", defaultRoles: BILLING_USERS },
  { name: "billing.discount.approve", description: "Approve discounts above configured thresholds.", category: "Billing", defaultRoles: BILLING_MANAGERS },
  { name: "billing.credit.create", description: "Create customer billing credits.", category: "Billing", defaultRoles: BILLING_USERS },
  { name: "billing.credit.approve", description: "Approve customer billing credits.", category: "Billing", defaultRoles: BILLING_MANAGERS },
  { name: "billing.invoice.view", description: "View customer invoices and their trace chains.", category: "Billing", defaultRoles: BILLING_VIEWERS },
  { name: "billing.invoice.create", description: "Create and submit draft customer invoices.", category: "Billing", defaultRoles: BILLING_USERS },
  { name: "billing.invoice.edit", description: "Edit draft customer invoices.", category: "Billing", defaultRoles: BILLING_USERS },
  { name: "billing.invoice.approve", description: "Approve a pending customer invoice.", category: "Billing", defaultRoles: BILLING_MANAGERS },
  { name: "billing.invoice.send", description: "Send an approved customer invoice.", category: "Billing", defaultRoles: BILLING_MANAGERS },
  { name: "billing.invoice.void", description: "Void an unpaid customer invoice.", category: "Billing", defaultRoles: BILLING_MANAGERS },
  { name: "billing.payment.view", description: "View customer payment records and balances.", category: "Billing", defaultRoles: BILLING_VIEWERS },
  { name: "billing.payment.record", description: "Record customer payment activity against invoices.", category: "Billing", defaultRoles: BILLING_USERS },
  { name: "billing.exception.view", description: "View billing exceptions and revenue leakage alerts.", category: "Billing", defaultRoles: BILLING_VIEWERS },
  { name: "billing.exception.resolve", description: "Resolve a billing exception with a reason.", category: "Billing", defaultRoles: BILLING_USERS },
  { name: "billing.exception.waive", description: "Waive a billing exception and accept the associated risk.", category: "Billing", defaultRoles: BILLING_MANAGERS },
  { name: "billing.reports.view", description: "View billing reports, leakage analysis, and profitability dashboards.", category: "Billing", defaultRoles: BILLING_VIEWERS },
  { name: "billing.report.export", description: "Export billing reports and ledgers.", category: "Billing", defaultRoles: BILLING_USERS },
  { name: "billing.settings.manage", description: "Manage billing settings and costing configuration.", category: "Billing", defaultRoles: BILLING_ADMINS },
  { name: "billing.cost_profile.create", description: "Create an effective-dated internal cost profile.", category: "Billing", defaultRoles: BILLING_MANAGERS },
  { name: "billing.permissions.manage", description: "Manage billing roles and permission grants.", category: "Billing", defaultRoles: BILLING_ADMINS },
  { name: "billing.audit.view", description: "View complete billing audit history.", category: "Billing", defaultRoles: BILLING_MANAGERS },
  { name: "billing.funds.view", description: "View client trust balances and duty advance accounts.", category: "Billing", defaultRoles: BILLING_VIEWERS },
  { name: "billing.funds.manage", description: "Manage duty advance accounts and payment configurations.", category: "Billing", defaultRoles: BILLING_USERS },
  { name: "billing.funds.authorize", description: "Authorize duty disbursements.", category: "Billing", defaultRoles: BILLING_USERS },
  { name: "billing.funds.disburse", description: "Record duty disbursement payments to CBP.", category: "Billing", defaultRoles: BILLING_USERS },
  { name: "billing.funds.deposit", description: "Record client advance deposits and replenishment receipts.", category: "Billing", defaultRoles: BILLING_USERS },
  { name: "billing.funds.refund", description: "Refund advance balances to clients.", category: "Billing", defaultRoles: BILLING_USERS },
  { name: "billing.funds.adjust", description: "Record manual balance adjustments and ledger reversals.", category: "Billing", defaultRoles: BILLING_MANAGERS },
  { name: "billing.funds.reconcile", description: "Reconcile disbursements against CBP statement records.", category: "Billing", defaultRoles: BILLING_USERS },
  { name: "billing.funds.override", description: "Override reconciliation variances and negative balance controls.", category: "Billing", defaultRoles: BILLING_MANAGERS },


  // Settings
  { name: "settings.read", description: "View organization configuration.", category: "Settings", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "TMS_ADMIN", "TMS_MANAGER", "SUPER_ADMIN_READ", "OWNER", "ADMIN"] },
  { name: "settings.manage", description: "Manage organization settings and administrative configuration.", category: "Settings", defaultRoles: ["BROKER_ADMIN", "TMS_ADMIN", "OWNER", "ADMIN"] },
  { name: "settings.update", description: "Update organization settings.", category: "Settings", defaultRoles: ["BROKER_ADMIN", "TMS_ADMIN", "OWNER", "ADMIN"] },
  { name: "integration.read", description: "View API integrations.", category: "Integration", defaultRoles: ["BROKER_ADMIN", "TMS_ADMIN", "SUPER_ADMIN_READ", "OWNER", "ADMIN"] },
  { name: "integration.configure", description: "Configure webhooks and API credentials.", category: "Integration", defaultRoles: ["BROKER_ADMIN", "TMS_ADMIN", "OWNER"] },
  { name: "workflow.read", description: "View automation workflows.", category: "Settings", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "TMS_ADMIN", "TMS_MANAGER", "SUPER_ADMIN_READ", "OWNER", "ADMIN"] },
  { name: "workflow.configure", description: "Configure AI auto-approval workflows.", category: "Settings", defaultRoles: ["BROKER_ADMIN", "TMS_ADMIN", "OWNER"] },

  // Audit
  { name: "audit.read", description: "View workspace audit log trail.", category: "Audit", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_BILLING", "TMS_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN"] },
  { name: "audit.export", description: "Export audit log records.", category: "Audit", defaultRoles: ["BROKER_ADMIN", "TMS_ADMIN", "SUPER_ADMIN_READ", "OWNER", "ADMIN"] },

  // ─── QUBERE TMS PERMISSIONS ──────────────────────────────────────────────

  // Legacy administration and decision gates
  { name: "account.manage", description: "Manage account-level settings and administrative account actions.", category: "Settings", defaultRoles: ["BROKER_ADMIN", "TMS_ADMIN", "OWNER", "ADMIN"] },
  { name: "users.manage", description: "Manage users, roles, invitations, and account memberships.", category: "Users", defaultRoles: ["BROKER_ADMIN", "TMS_ADMIN", "OWNER", "ADMIN"] },
  { name: "decisions.approve", description: "Approve automated decisions and human review outcomes.", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "TMS_ADMIN", "TMS_MANAGER", "OWNER", "ADMIN"] },
  { name: "decisions.reject", description: "Reject automated decisions and require corrective handling.", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "TMS_ADMIN", "TMS_MANAGER", "OWNER", "ADMIN"] },
  { name: "decisions.override", description: "Override automated decision recommendations with justification.", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "TMS_ADMIN", "OWNER", "ADMIN"] },
  { name: "decisions.reevaluate", description: "Request automated reevaluation for an existing decision.", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "TMS_ADMIN", "TMS_MANAGER", "OWNER", "ADMIN"] },
  { name: "exceptions.resolve", description: "Resolve compliance exceptions after review is complete.", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "TMS_ADMIN", "TMS_MANAGER", "OWNER", "ADMIN"] },
  { name: "exceptions.waive", description: "Waive compliance exceptions and accept documented risk.", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "TMS_ADMIN", "OWNER", "ADMIN"] },

  // Customer
  { name: "customer.read", description: "View TMS shipper/customer accounts.", category: "Customer", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "TMS_BILLING", "TMS_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN"] },
  { name: "customer.create", description: "Create TMS customer profile.", category: "Customer", defaultRoles: ["TMS_ADMIN", "OWNER", "ADMIN"] },
  { name: "customer.update", description: "Update TMS customer details.", category: "Customer", defaultRoles: ["TMS_ADMIN", "OWNER", "ADMIN"] },
  { name: "customer.delete", description: "Delete TMS customer profile.", category: "Customer", defaultRoles: ["TMS_ADMIN", "OWNER"] },
  { name: "customer.assign_users", description: "Assign operations team to customer.", category: "Customer", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "OWNER", "ADMIN"] },
  { name: "customer.manage_settings", description: "Configure customer freight rules.", category: "Customer", defaultRoles: ["TMS_ADMIN", "OWNER"] },

  // Orders
  { name: "order.read", description: "View transportation orders.", category: "Order", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "TMS_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN"] },
  { name: "order.create", description: "Create transportation order from intake.", category: "Order", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "OWNER", "ADMIN"] },
  { name: "order.update", description: "Update transportation order details.", category: "Order", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "OWNER", "ADMIN"] },
  { name: "order.delete", description: "Delete draft transportation order.", category: "Order", defaultRoles: ["TMS_ADMIN", "OWNER", "ADMIN"] },
  { name: "order.cancel", description: "Cancel transportation order.", category: "Order", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "OWNER", "ADMIN"] },
  { name: "order.approve", description: "Promote order to execution shipment.", category: "Order", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "OWNER", "ADMIN"] },
  { name: "order.assign", description: "Assign order to dispatcher.", category: "Order", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "OWNER", "ADMIN"] },
  { name: "order.reopen", description: "Reopen cancelled order.", category: "Order", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "OWNER", "ADMIN"] },

  // Loads
  { name: "load.read", description: "View load execution plan.", category: "Load", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "TMS_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN"] },
  { name: "load.create", description: "Consolidate shipments into load.", category: "Load", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "OWNER", "ADMIN"] },
  { name: "load.update", description: "Modify load composition and route.", category: "Load", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "OWNER", "ADMIN"] },
  { name: "load.delete", description: "Delete a planned load before dispatch.", category: "Load", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "OWNER", "ADMIN"] },
  { name: "load.assign", description: "Assign carrier/driver to load.", category: "Load", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "OWNER", "ADMIN"] },
  { name: "load.dispatch", description: "Dispatch load to carrier.", category: "Load", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_DISPATCHER", "OWNER", "ADMIN"] },
  { name: "load.cancel", description: "Cancel load execution.", category: "Load", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_DISPATCHER", "OWNER", "ADMIN"] },
  { name: "load.reopen", description: "Reopen unassigned load.", category: "Load", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "OWNER", "ADMIN"] },

  // Stops
  { name: "stop.read", description: "View load origin/intermediate/destination stops.", category: "Stop", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "TMS_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN"] },
  { name: "stop.create", description: "Add pickup or delivery stop.", category: "Stop", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "OWNER", "ADMIN"] },
  { name: "stop.update", description: "Update stop times and appointment windows.", category: "Stop", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "OWNER", "ADMIN"] },
  { name: "stop.delete", description: "Remove stop from load.", category: "Stop", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_DISPATCHER", "OWNER", "ADMIN"] },
  { name: "stop.resequence", description: "Resequence multi-stop load.", category: "Stop", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_DISPATCHER", "OWNER", "ADMIN"] },

  // Carriers
  { name: "carrier.read", description: "View carrier master data and safety scores.", category: "Carrier", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "TMS_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN"] },
  { name: "carrier.create", description: "Add new motor carrier entity.", category: "Carrier", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "OWNER", "ADMIN"] },
  { name: "carrier.update", description: "Update carrier compliance & insurance info.", category: "Carrier", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "OWNER", "ADMIN"] },
  { name: "carrier.delete", description: "Delete carrier profile.", category: "Carrier", defaultRoles: ["TMS_ADMIN", "OWNER"] },
  { name: "carrier.assign", description: "Assign carrier to tender/load.", category: "Carrier", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "OWNER", "ADMIN"] },
  { name: "carrier.approve", description: "Approve carrier for dispatch.", category: "Carrier", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "OWNER", "ADMIN"] },

  // Rates & Quotes
  { name: "rate.read", description: "View spot and contract freight rates.", category: "Rate", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "TMS_BILLING", "TMS_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN"] },
  { name: "rate.create", description: "Create freight rate card.", category: "Rate", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "OWNER", "ADMIN"] },
  { name: "rate.update", description: "Modify rate benchmark.", category: "Rate", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "OWNER", "ADMIN"] },
  { name: "rate.approve", description: "Approve tariff update.", category: "Rate", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "OWNER", "ADMIN"] },
  { name: "rate.override", description: "Override system recommended spot rate.", category: "Rate", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "OWNER", "ADMIN"] },
  { name: "quote.read", description: "View customer freight quotes.", category: "Rate", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "TMS_BILLING", "TMS_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN"] },
  { name: "quote.create", description: "Calculate freight quote.", category: "Rate", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "OWNER", "ADMIN"] },
  { name: "quote.update", description: "Update quote parameters.", category: "Rate", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "OWNER", "ADMIN"] },
  { name: "quote.send", description: "Transmit quote to customer.", category: "Rate", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "OWNER", "ADMIN"] },
  { name: "quote.approve", description: "Approve customer quote acceptance.", category: "Rate", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "OWNER", "ADMIN"] },

  // Tender
  { name: "tender.read", description: "View load tender status.", category: "Tender", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "TMS_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN"] },
  { name: "tender.create", description: "Create electronic tender offer.", category: "Tender", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "OWNER", "ADMIN"] },
  { name: "tender.send", description: "Transmit tender to carrier.", category: "Tender", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "OWNER", "ADMIN"] },
  { name: "tender.accept", description: "Record carrier tender acceptance.", category: "Tender", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_DISPATCHER", "OWNER", "ADMIN"] },
  { name: "tender.reject", description: "Record carrier tender rejection.", category: "Tender", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_DISPATCHER", "OWNER", "ADMIN"] },
  { name: "tender.cancel", description: "Recall/cancel pending tender.", category: "Tender", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_DISPATCHER", "OWNER", "ADMIN"] },

  // Tracking
  { name: "tracking.read", description: "View real-time telematics & ETA observations.", category: "Tracking", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "TMS_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN"] },
  { name: "tracking.update", description: "Log manual tracking update / checkcall.", category: "Tracking", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "OWNER", "ADMIN"] },
  { name: "tracking.manage", description: "Configure Project44 / Samsara telematics streams.", category: "Tracking", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "OWNER", "ADMIN"] },

  // Invoices
  { name: "invoice.read", description: "View carrier and customer invoices.", category: "Invoice", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_BILLING", "SUPER_ADMIN_READ", "OWNER", "ADMIN"] },
  { name: "invoice.create", description: "Create invoice record.", category: "Invoice", defaultRoles: ["TMS_ADMIN", "TMS_BILLING", "OWNER", "ADMIN"] },
  { name: "invoice.update", description: "Update invoice charges.", category: "Invoice", defaultRoles: ["TMS_ADMIN", "TMS_BILLING", "OWNER", "ADMIN"] },
  { name: "invoice.approve", description: "Approve carrier invoice payment.", category: "Invoice", defaultRoles: ["TMS_ADMIN", "TMS_BILLING", "OWNER", "ADMIN"] },
  { name: "invoice.send", description: "Send customer invoice email.", category: "Invoice", defaultRoles: ["TMS_ADMIN", "TMS_BILLING", "OWNER", "ADMIN"] },
  { name: "invoice.void", description: "Void an invoice before final settlement.", category: "Invoice", defaultRoles: ["TMS_ADMIN", "TMS_BILLING", "OWNER"] },
  { name: "invoice.export", description: "Export invoice batch for ERP ingestion.", category: "Invoice", defaultRoles: ["TMS_ADMIN", "TMS_BILLING", "OWNER", "ADMIN"] },

  // TMS Integration Testing & Extra
  { name: "integration.test", description: "Execute test payload against EDI/API integration.", category: "Integration", defaultRoles: ["TMS_ADMIN", "BROKER_ADMIN", "OWNER"] },
  { name: "integration.disable", description: "Disable API integration stream.", category: "Integration", defaultRoles: ["TMS_ADMIN", "BROKER_ADMIN", "OWNER"] },

  // AI
  { name: "ai.use", description: "Use AI-assisted features: the Copilot chat and on-demand embargo / PGA screening from a shipment.", category: "AI", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "TMS_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "MEMBER", "VIEWER"] },

  // TMS Access & General
  { name: "tms.access", description: "Access Qubere TMS Freight Execution System.", category: "System", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "TMS_BILLING", "TMS_VIEWER", "SUPER_ADMIN_READ", "SUPER_ADMIN_WRITE", "INTERNAL_ADMIN", "OWNER", "ADMIN", "MEMBER", "BROKER_ADMIN", "BROKER_MANAGER"] },

  // Freight Execution
  { name: "transportation_orders.read", description: "View transportation orders.", category: "Freight", defaultRoles: ["ADMIN", "MEMBER", "VIEWER", "OWNER", "TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "TMS_VIEWER", "SUPER_ADMIN_READ"] },
  { name: "transportation_orders.write", description: "Create and update transportation orders.", category: "Freight", defaultRoles: ["ADMIN", "MEMBER", "OWNER", "TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS"] },
  { name: "carriers.manage", description: "Manage carriers and profiles.", category: "Freight", defaultRoles: ["ADMIN", "OWNER", "TMS_ADMIN", "TMS_MANAGER"] },
  { name: "tenders.send", description: "Send load tenders to carriers.", category: "Freight", defaultRoles: ["ADMIN", "MEMBER", "OWNER", "TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER"] },
  { name: "carrier_invoices.match", description: "Perform freight audit and invoice matching.", category: "Freight", defaultRoles: ["ADMIN", "MEMBER", "OWNER", "TMS_ADMIN", "TMS_BILLING"] },
  { name: "carrier_invoices.override", description: "Override invoice audit mismatch warnings.", category: "Freight", defaultRoles: ["ADMIN", "OWNER", "TMS_ADMIN"] },

  // ─── QUBERE ADMIN / PLATFORM PERMISSIONS ─────────────────────────────────

  { name: "system.users.read", description: "Read all platform users across tenants.", category: "System", defaultRoles: ["INTERNAL_ADMIN", "SUPER_ADMIN_READ", "SUPER_ADMIN_WRITE"] },
  { name: "system.users.manage", description: "Manage platform users across tenants.", category: "System", defaultRoles: ["INTERNAL_ADMIN", "SUPER_ADMIN_WRITE"] },
  { name: "system.tenants.read", description: "Read platform tenants/organizations.", category: "System", defaultRoles: ["INTERNAL_ADMIN", "SUPER_ADMIN_READ", "SUPER_ADMIN_WRITE"] },
  { name: "system.configuration.read", description: "View platform global configuration.", category: "System", defaultRoles: ["INTERNAL_ADMIN", "SUPER_ADMIN_READ", "SUPER_ADMIN_WRITE"] },
  { name: "system.configuration.write", description: "Modify platform global configuration.", category: "System", defaultRoles: ["INTERNAL_ADMIN", "SUPER_ADMIN_WRITE"] },
  { name: "system.audit.read", description: "Read global system audit log.", category: "System", defaultRoles: ["INTERNAL_ADMIN", "SUPER_ADMIN_READ", "SUPER_ADMIN_WRITE"] },
  { name: "system.support.read", description: "View support tickets and diagnostics.", category: "System", defaultRoles: ["INTERNAL_ADMIN", "SUPER_ADMIN_READ", "SUPER_ADMIN_WRITE"] },
  { name: "system.impersonate.write", description: "Impersonate customer user for troubleshooting.", category: "System", defaultRoles: ["SUPER_ADMIN_WRITE"] },

  // ─── QUBERE CUSTOMER PORTAL PERMISSIONS ──────────────────────────────────
  { name: "portal.porter", description: "Porter View permission for Importers and Exporters to log into and access Qubere Customer Portal.", category: "Customer", defaultRoles: ["CUSTOMER_ADMIN", "CUSTOMER_USER", "CUSTOMER_VIEWER", "CUSTOMER_CUSTOMS_USER", "CUSTOMER_TMS_USER", "BROKER_ADMIN", "TMS_ADMIN", "SUPER_ADMIN_READ", "SUPER_ADMIN_WRITE", "INTERNAL_ADMIN", "OWNER", "ADMIN"] },
  { name: "portal.access", description: "Access Qubere Customer Portal.", category: "Customer", defaultRoles: ["CUSTOMER_ADMIN", "CUSTOMER_USER", "CUSTOMER_VIEWER", "CUSTOMER_CUSTOMS_USER", "CUSTOMER_TMS_USER", "BROKER_ADMIN", "TMS_ADMIN", "SUPER_ADMIN_READ", "SUPER_ADMIN_WRITE", "INTERNAL_ADMIN", "OWNER", "ADMIN"] },
  { name: "portal.customs.read", description: "View Customs shipments and CBP status in portal.", category: "Customer", defaultRoles: ["CUSTOMER_ADMIN", "CUSTOMER_USER", "CUSTOMER_VIEWER", "CUSTOMER_CUSTOMS_USER", "BROKER_ADMIN", "SUPER_ADMIN_READ", "OWNER"] },
  { name: "portal.shipments.read", description: "View customer shipments.", category: "Customer", defaultRoles: ["CUSTOMER_ADMIN", "CUSTOMER_USER", "CUSTOMER_VIEWER", "CUSTOMER_CUSTOMS_USER", "BROKER_ADMIN", "SUPER_ADMIN_READ", "OWNER"] },
  { name: "portal.entries.read", description: "View customer entry summaries.", category: "Customer", defaultRoles: ["CUSTOMER_ADMIN", "CUSTOMER_USER", "CUSTOMER_VIEWER", "CUSTOMER_CUSTOMS_USER", "BROKER_ADMIN", "SUPER_ADMIN_READ", "OWNER"] },
  { name: "portal.entries.comment", description: "Ask questions about a published entry proof.", category: "Customer", defaultRoles: ["CUSTOMER_ADMIN", "CUSTOMER_USER", "CUSTOMER_CUSTOMS_USER", "BROKER_ADMIN", "OWNER"] },
  { name: "portal.setup.read", description: "View customer onboarding, documents, and stakeholders.", category: "Customer", defaultRoles: ["CUSTOMER_ADMIN", "CUSTOMER_USER", "CUSTOMER_VIEWER", "CUSTOMER_CUSTOMS_USER", "BROKER_ADMIN", "OWNER"] },
  { name: "portal.entries.download", description: "Download customer 7501 PDF entry summaries.", category: "Customer", defaultRoles: ["CUSTOMER_ADMIN", "CUSTOMER_USER", "CUSTOMER_VIEWER", "CUSTOMER_CUSTOMS_USER", "BROKER_ADMIN", "SUPER_ADMIN_READ", "OWNER"] },
  { name: "portal.tms.read", description: "View TMS freight orders and carrier tracking in portal.", category: "Customer", defaultRoles: ["CUSTOMER_ADMIN", "CUSTOMER_USER", "CUSTOMER_VIEWER", "CUSTOMER_TMS_USER", "TMS_ADMIN", "SUPER_ADMIN_READ", "OWNER"] },
  { name: "portal.orders.read", description: "View customer transportation orders.", category: "Customer", defaultRoles: ["CUSTOMER_ADMIN", "CUSTOMER_USER", "CUSTOMER_VIEWER", "CUSTOMER_TMS_USER", "TMS_ADMIN", "SUPER_ADMIN_READ", "OWNER"] },
  { name: "portal.loads.read", description: "View customer freight loads.", category: "Customer", defaultRoles: ["CUSTOMER_ADMIN", "CUSTOMER_USER", "CUSTOMER_VIEWER", "CUSTOMER_TMS_USER", "TMS_ADMIN", "SUPER_ADMIN_READ", "OWNER"] },
  { name: "portal.documents.read", description: "View customer-visible documents.", category: "Customer", defaultRoles: ["CUSTOMER_ADMIN", "CUSTOMER_USER", "CUSTOMER_VIEWER", "CUSTOMER_CUSTOMS_USER", "CUSTOMER_TMS_USER", "BROKER_ADMIN", "TMS_ADMIN", "SUPER_ADMIN_READ", "OWNER"] },
  { name: "portal.documents.create", description: "Upload documents to customer requests or shipments.", category: "Customer", defaultRoles: ["CUSTOMER_ADMIN", "CUSTOMER_USER", "CUSTOMER_CUSTOMS_USER", "CUSTOMER_TMS_USER", "BROKER_ADMIN", "TMS_ADMIN", "OWNER"] },
  { name: "portal.requests.read", description: "View customer requests and questions.", category: "Customer", defaultRoles: ["CUSTOMER_ADMIN", "CUSTOMER_USER", "CUSTOMER_VIEWER", "CUSTOMER_CUSTOMS_USER", "CUSTOMER_TMS_USER", "BROKER_ADMIN", "TMS_ADMIN", "SUPER_ADMIN_READ", "OWNER"] },
  { name: "portal.requests.respond", description: "Respond to broker/carrier customer requests.", category: "Customer", defaultRoles: ["CUSTOMER_ADMIN", "CUSTOMER_USER", "CUSTOMER_CUSTOMS_USER", "CUSTOMER_TMS_USER", "BROKER_ADMIN", "TMS_ADMIN", "OWNER"] },
  { name: "portal.invoices.read", description: "View customer issued invoices.", category: "Customer", defaultRoles: ["CUSTOMER_ADMIN", "CUSTOMER_USER", "CUSTOMER_VIEWER", "CUSTOMER_CUSTOMS_USER", "CUSTOMER_TMS_USER", "BROKER_ADMIN", "TMS_ADMIN", "SUPER_ADMIN_READ", "OWNER"] },
  { name: "portal.invoices.download", description: "Download customer-safe PDF invoices.", category: "Customer", defaultRoles: ["CUSTOMER_ADMIN", "CUSTOMER_USER", "CUSTOMER_VIEWER", "CUSTOMER_CUSTOMS_USER", "CUSTOMER_TMS_USER", "BROKER_ADMIN", "TMS_ADMIN", "SUPER_ADMIN_READ", "OWNER"] },
  { name: "portal.users.manage", description: "Manage customer portal user access for client.", category: "Customer", defaultRoles: ["CUSTOMER_ADMIN", "BROKER_ADMIN", "TMS_ADMIN", "OWNER"] },
] as const;

export const PERMISSION_NAMES = PERMISSION_CATALOGUE.map((p) => p.name);
export type PermissionName = (typeof PERMISSION_NAMES)[number];

export function findPermission(name: string): PermissionDefinition | null {
  return PERMISSION_CATALOGUE.find((p) => p.name === name) ?? null;
}

export function defaultPermissionsForRole(roleName: string): string[] {
  const role = roleName.toUpperCase();
  if (role === "OWNER" || role === "PLATFORM_ADMIN" || role === "SUPER_ADMIN_WRITE") {
    return [...PERMISSION_NAMES];
  }
  return PERMISSION_CATALOGUE.filter((p) =>
    (p.defaultRoles as readonly string[]).includes(role as SystemRole)
  ).map((p) => p.name);
}

export interface CatalogueCoverage {
  missing: string[];
  unknown: string[];
  seeded: number;
  total: number;
}

export function catalogueCoverage(existingNames: readonly string[]): CatalogueCoverage {
  const existing = new Set(existingNames);
  const catalogued = new Set(PERMISSION_NAMES);
  return {
    missing: PERMISSION_NAMES.filter((name) => !existing.has(name)),
    unknown: [...existing].filter((name) => !catalogued.has(name)).sort(),
    seeded: PERMISSION_NAMES.filter((name) => existing.has(name)).length,
    total: PERMISSION_NAMES.length,
  };
}

export interface RoleGrantGap {
  roleName: string;
  missing: string[];
  extra: string[];
}

export function roleGrantGap(roleName: string, granted: readonly string[]): RoleGrantGap {
  const defaults = defaultPermissionsForRole(roleName);
  const held = new Set(granted);
  const defaultSet = new Set(defaults);
  return {
    roleName,
    missing: defaults.filter((name) => !held.has(name)),
    extra: [...held].filter((name) => !defaultSet.has(name)).sort(),
  };
}

/**
 * Grant names a role holds that no longer exist in PERMISSION_CATALOGUE --
 * e.g. left behind by a permission rename, since the seed sync upserts by
 * name and never renames/removes the old DB row. Unlike roleGrantGap's
 * `extra` (which flags any grant beyond a system role's defaults, including
 * intentional customization), this applies to every role, system or custom,
 * because an uncatalogued name is never intentional -- the permission it
 * once named doesn't exist anymore.
 */
export function staleGrantNames(granted: readonly string[]): string[] {
  const catalogued = new Set(PERMISSION_NAMES);
  return granted.filter((name) => !catalogued.has(name));
}
