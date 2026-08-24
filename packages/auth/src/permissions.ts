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
  // TMS Roles
  "TMS_ADMIN",
  "TMS_MANAGER",
  "TMS_OPERATIONS",
  "TMS_DISPATCHER",
  "TMS_BILLING",
  "TMS_VIEWER",
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
  | "System";

export interface PermissionDefinition {
  name: string;
  description: string;
  category: PermissionCategory;
  defaultRoles: readonly SystemRole[];
}

export const PERMISSION_CATALOGUE: readonly PermissionDefinition[] = [
  // ─── QUBERE CUSTOMS PERMISSIONS ──────────────────────────────────────────

  // Client
  { name: "client.read", description: "View client details and profile", category: "Client", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "BROKER_BILLING", "SUPER_ADMIN_READ", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "MEMBER", "VIEWER"] },
  { name: "client.create", description: "Create new client records", category: "Client", defaultRoles: ["BROKER_ADMIN", "OWNER", "ADMIN"] },
  { name: "client.update", description: "Update client settings and metadata", category: "Client", defaultRoles: ["BROKER_ADMIN", "OWNER", "ADMIN"] },
  { name: "client.delete", description: "Delete client records", category: "Client", defaultRoles: ["BROKER_ADMIN", "OWNER"] },
  { name: "client.assign_users", description: "Assign specialist users to client", category: "Client", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "OWNER", "ADMIN"] },
  { name: "client.manage_settings", description: "Configure client-specific workspace settings", category: "Client", defaultRoles: ["BROKER_ADMIN", "OWNER"] },

  // Users
  { name: "user.read", description: "View workspace users", category: "Users", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "BROKER_BILLING", "TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "TMS_BILLING", "TMS_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN", "MEMBER", "VIEWER"] },
  { name: "user.invite", description: "Invite new users to organization", category: "Users", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "TMS_ADMIN", "TMS_MANAGER", "OWNER", "ADMIN"] },
  { name: "user.update", description: "Update user role assignments", category: "Users", defaultRoles: ["BROKER_ADMIN", "TMS_ADMIN", "OWNER", "ADMIN"] },
  { name: "user.deactivate", description: "Deactivate user access", category: "Users", defaultRoles: ["BROKER_ADMIN", "TMS_ADMIN", "OWNER", "ADMIN"] },
  { name: "user.assign_client", description: "Assign client access to user", category: "Users", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "OWNER", "ADMIN"] },
  { name: "user.remove_client", description: "Remove client access from user", category: "Users", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "OWNER", "ADMIN"] },

  // Customs Shipments
  { name: "shipment.read", description: "View customs shipments", category: "Shipment", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "TMS_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "MEMBER", "VIEWER"] },
  { name: "shipment.create", description: "Create customs shipments", category: "Shipment", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "MEMBER"] },
  { name: "shipment.update", description: "Update customs shipments", category: "Shipment", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "MEMBER"] },
  { name: "shipment.delete", description: "Delete customs shipments", category: "Shipment", defaultRoles: ["BROKER_ADMIN", "TMS_ADMIN", "OWNER", "ADMIN"] },
  { name: "shipment.assign", description: "Assign shipment to broker/user", category: "Shipment", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "OWNER", "ADMIN"] },
  { name: "shipment.cancel", description: "Cancel active shipment", category: "Shipment", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "TMS_ADMIN", "TMS_MANAGER", "TMS_DISPATCHER", "OWNER", "ADMIN"] },
  { name: "shipment.reopen", description: "Reopen cancelled shipment", category: "Shipment", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "TMS_ADMIN", "TMS_MANAGER", "OWNER", "ADMIN"] },

  // Documents
  { name: "document.read", description: "View attached trade documents", category: "Document", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "TMS_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "MEMBER", "VIEWER"] },
  { name: "document.upload", description: "Upload trade documents", category: "Document", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "MEMBER"] },
  { name: "document.update", description: "Update trade document metadata", category: "Document", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "MEMBER"] },
  { name: "document.delete", description: "Delete trade document", category: "Document", defaultRoles: ["BROKER_ADMIN", "TMS_ADMIN", "OWNER", "ADMIN"] },
  { name: "document.download", description: "Download trade document file", category: "Document", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "TMS_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "MEMBER", "VIEWER"] },
  { name: "document.approve", description: "Approve extracted trade document", category: "Document", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "TMS_ADMIN", "TMS_MANAGER", "OWNER", "ADMIN"] },
  { name: "document.request", description: "Request missing document from client", category: "Document", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "OWNER", "ADMIN"] },

  // Customs Entries
  { name: "entry.read", description: "View entry summary and CBP details", category: "Entry", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "MEMBER", "VIEWER"] },
  { name: "entry.create", description: "Create entry summary draft", category: "Entry", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "OWNER", "ADMIN", "BROKER", "SPECIALIST"] },
  { name: "entry.update", description: "Update entry summary line items", category: "Entry", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "OWNER", "ADMIN", "BROKER", "SPECIALIST"] },
  { name: "entry.validate", description: "Validate entry against CATAIR rules", category: "Entry", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "OWNER", "ADMIN", "BROKER", "SPECIALIST"] },
  { name: "entry.approve", description: "Approve entry summary for transmission", category: "Entry", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "OWNER", "ADMIN"] },
  { name: "entry.submit", description: "Transmit entry summary to CBP ACE", category: "Entry", defaultRoles: ["BROKER_ADMIN", "OWNER", "ADMIN"] },
  { name: "entry.amend", description: "Amend transmitted entry (PSC/reconciliation)", category: "Entry", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "OWNER", "ADMIN"] },
  { name: "entry.cancel", description: "Cancel entry summary", category: "Entry", defaultRoles: ["BROKER_ADMIN", "OWNER", "ADMIN"] },
  { name: "entry.reopen", description: "Reopen closed entry summary", category: "Entry", defaultRoles: ["BROKER_ADMIN", "OWNER", "ADMIN"] },

  // Classification
  { name: "classification.read", description: "View HTS classification and AI rationale", category: "Classification", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "MEMBER", "VIEWER"] },
  { name: "classification.create", description: "Suggest HTS code for line item", category: "Classification", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "OWNER", "ADMIN", "BROKER", "SPECIALIST"] },
  { name: "classification.update", description: "Modify line item classification", category: "Classification", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "OWNER", "ADMIN", "BROKER", "SPECIALIST"] },
  { name: "classification.approve", description: "Approve HTS classification", category: "Classification", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "OWNER", "ADMIN"] },
  { name: "classification.override", description: "Override recommended classification", category: "Classification", defaultRoles: ["BROKER_ADMIN", "OWNER", "ADMIN"] },

  // Origin
  { name: "origin.read", description: "View country of origin determination", category: "Origin", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "VIEWER"] },
  { name: "origin.update", description: "Modify origin determination", category: "Origin", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "OWNER", "ADMIN", "BROKER", "SPECIALIST"] },
  { name: "origin.approve", description: "Approve trade agreement origin", category: "Origin", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "OWNER", "ADMIN"] },
  { name: "origin.override", description: "Override origin determination", category: "Origin", defaultRoles: ["BROKER_ADMIN", "OWNER", "ADMIN"] },

  // Valuation
  { name: "valuation.read", description: "View customs valuation and additions/deductions", category: "Valuation", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "VIEWER"] },
  { name: "valuation.update", description: "Modify entered values and assists", category: "Valuation", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "OWNER", "ADMIN", "BROKER", "SPECIALIST"] },
  { name: "valuation.approve", description: "Approve customs valuation methodology", category: "Valuation", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "OWNER", "ADMIN"] },
  { name: "valuation.override", description: "Override valuation calculations", category: "Valuation", defaultRoles: ["BROKER_ADMIN", "OWNER", "ADMIN"] },

  // Compliance
  { name: "compliance.read", description: "View compliance checks and risk scores", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "VIEWER"] },
  { name: "compliance.review", description: "Review compliance exceptions and warnings", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "OWNER", "ADMIN", "BROKER", "SPECIALIST"] },
  { name: "compliance.approve", description: "Approve compliance clearance", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "OWNER", "ADMIN"] },
  { name: "compliance.override", description: "Waive or override compliance exception", category: "Compliance", defaultRoles: ["BROKER_ADMIN", "OWNER", "ADMIN"] },

  // PGA
  { name: "pga.read", description: "View PGA message set requirements", category: "PGA", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "VIEWER"] },
  { name: "pga.update", description: "Update PGA program data", category: "PGA", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "OWNER", "ADMIN", "BROKER", "SPECIALIST"] },
  { name: "pga.review", description: "Review PGA validation warnings", category: "PGA", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "OWNER", "ADMIN", "BROKER"] },
  { name: "pga.approve", description: "Approve PGA message set for transmission", category: "PGA", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "OWNER", "ADMIN"] },

  // Filing
  { name: "filing.read", description: "View customs filing status", category: "Filing", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "VIEWER"] },
  { name: "filing.prepare", description: "Prepare filing package", category: "Filing", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "OWNER", "ADMIN", "BROKER", "SPECIALIST"] },
  { name: "filing.validate", description: "Run pre-filing validation checks", category: "Filing", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "OWNER", "ADMIN", "BROKER", "SPECIALIST"] },
  { name: "filing.submit", description: "Transmit filing package to customs API", category: "Filing", defaultRoles: ["BROKER_ADMIN", "OWNER", "ADMIN"] },
  { name: "filing.amend", description: "Submit post-summary amendment", category: "Filing", defaultRoles: ["BROKER_ADMIN", "OWNER", "ADMIN"] },
  { name: "filing.cancel", description: "Request filing cancellation", category: "Filing", defaultRoles: ["BROKER_ADMIN", "OWNER", "ADMIN"] },
  { name: "filing.view_responses", description: "View raw ACE/CBP electronic responses", category: "Filing", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "SUPER_ADMIN_READ", "OWNER", "ADMIN", "BROKER"] },

  // Reporting
  { name: "report.read", description: "View analytics reports and dashboards", category: "Reporting", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "BROKER_BILLING", "TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_BILLING", "TMS_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "VIEWER"] },
  { name: "report.export", description: "Export report datasets to CSV/Excel", category: "Reporting", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_BILLING", "TMS_ADMIN", "TMS_MANAGER", "TMS_BILLING", "OWNER", "ADMIN"] },
  { name: "dashboard.read", description: "Access operational command center dashboard", category: "Reporting", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "BROKER_BILLING", "TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "TMS_BILLING", "TMS_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN", "BROKER", "SPECIALIST", "VIEWER"] },

  // Billing
  { name: "billing.read", description: "View customs & freight invoices and rate cards", category: "Billing", defaultRoles: ["BROKER_ADMIN", "BROKER_BILLING", "TMS_ADMIN", "TMS_BILLING", "SUPER_ADMIN_READ", "OWNER", "ADMIN"] },
  { name: "billing.create", description: "Generate customer invoices", category: "Billing", defaultRoles: ["BROKER_ADMIN", "BROKER_BILLING", "TMS_ADMIN", "TMS_BILLING", "OWNER", "ADMIN"] },
  { name: "billing.update", description: "Update invoice line items", category: "Billing", defaultRoles: ["BROKER_ADMIN", "BROKER_BILLING", "TMS_ADMIN", "TMS_BILLING", "OWNER", "ADMIN"] },
  { name: "billing.approve", description: "Approve customer invoices for dispatch", category: "Billing", defaultRoles: ["BROKER_ADMIN", "BROKER_BILLING", "TMS_ADMIN", "TMS_BILLING", "OWNER", "ADMIN"] },
  { name: "billing.export", description: "Export billing and financial ledger data", category: "Billing", defaultRoles: ["BROKER_ADMIN", "BROKER_BILLING", "TMS_ADMIN", "TMS_BILLING", "OWNER", "ADMIN"] },

  // Settings
  { name: "settings.read", description: "View organization configuration", category: "Settings", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "TMS_ADMIN", "TMS_MANAGER", "SUPER_ADMIN_READ", "OWNER", "ADMIN"] },
  { name: "settings.update", description: "Update organization settings", category: "Settings", defaultRoles: ["BROKER_ADMIN", "TMS_ADMIN", "OWNER", "ADMIN"] },
  { name: "integration.read", description: "View API integrations", category: "Integration", defaultRoles: ["BROKER_ADMIN", "TMS_ADMIN", "SUPER_ADMIN_READ", "OWNER", "ADMIN"] },
  { name: "integration.configure", description: "Configure webhooks and API credentials", category: "Integration", defaultRoles: ["BROKER_ADMIN", "TMS_ADMIN", "OWNER"] },
  { name: "workflow.read", description: "View automation workflows", category: "Settings", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "TMS_ADMIN", "TMS_MANAGER", "SUPER_ADMIN_READ", "OWNER", "ADMIN"] },
  { name: "workflow.configure", description: "Configure AI auto-approval workflows", category: "Settings", defaultRoles: ["BROKER_ADMIN", "TMS_ADMIN", "OWNER"] },

  // Audit
  { name: "audit.read", description: "View workspace audit log trail", category: "Audit", defaultRoles: ["BROKER_ADMIN", "BROKER_MANAGER", "BROKER_SPECIALIST", "BROKER_VIEWER", "TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_BILLING", "TMS_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN"] },
  { name: "audit.export", description: "Export audit log records", category: "Audit", defaultRoles: ["BROKER_ADMIN", "TMS_ADMIN", "SUPER_ADMIN_READ", "OWNER", "ADMIN"] },

  // ─── QUBERE TMS PERMISSIONS ──────────────────────────────────────────────

  // Customer
  { name: "customer.read", description: "View TMS shipper/customer accounts", category: "Customer", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "TMS_BILLING", "TMS_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN"] },
  { name: "customer.create", description: "Create TMS customer profile", category: "Customer", defaultRoles: ["TMS_ADMIN", "OWNER", "ADMIN"] },
  { name: "customer.update", description: "Update TMS customer details", category: "Customer", defaultRoles: ["TMS_ADMIN", "OWNER", "ADMIN"] },
  { name: "customer.delete", description: "Delete TMS customer profile", category: "Customer", defaultRoles: ["TMS_ADMIN", "OWNER"] },
  { name: "customer.assign_users", description: "Assign operations team to customer", category: "Customer", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "OWNER", "ADMIN"] },
  { name: "customer.manage_settings", description: "Configure customer freight rules", category: "Customer", defaultRoles: ["TMS_ADMIN", "OWNER"] },

  // Orders
  { name: "order.read", description: "View transportation orders", category: "Order", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "TMS_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN"] },
  { name: "order.create", description: "Create transportation order from intake", category: "Order", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "OWNER", "ADMIN"] },
  { name: "order.update", description: "Update transportation order details", category: "Order", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "OWNER", "ADMIN"] },
  { name: "order.delete", description: "Delete draft transportation order", category: "Order", defaultRoles: ["TMS_ADMIN", "OWNER", "ADMIN"] },
  { name: "order.cancel", description: "Cancel transportation order", category: "Order", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "OWNER", "ADMIN"] },
  { name: "order.approve", description: "Promote order to execution shipment", category: "Order", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "OWNER", "ADMIN"] },
  { name: "order.assign", description: "Assign order to dispatcher", category: "Order", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "OWNER", "ADMIN"] },
  { name: "order.reopen", description: "Reopen cancelled order", category: "Order", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "OWNER", "ADMIN"] },

  // Loads
  { name: "load.read", description: "View load execution plan", category: "Load", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "TMS_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN"] },
  { name: "load.create", description: "Consolidate shipments into load", category: "Load", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "OWNER", "ADMIN"] },
  { name: "load.update", description: "Modify load composition and route", category: "Load", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "OWNER", "ADMIN"] },
  { name: "load.delete", description: "Delete planned load", category: "Load", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "OWNER", "ADMIN"] },
  { name: "load.assign", description: "Assign carrier/driver to load", category: "Load", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "OWNER", "ADMIN"] },
  { name: "load.dispatch", description: "Dispatch load to carrier", category: "Load", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_DISPATCHER", "OWNER", "ADMIN"] },
  { name: "load.cancel", description: "Cancel load execution", category: "Load", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_DISPATCHER", "OWNER", "ADMIN"] },
  { name: "load.reopen", description: "Reopen unassigned load", category: "Load", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "OWNER", "ADMIN"] },

  // Stops
  { name: "stop.read", description: "View load origin/intermediate/destination stops", category: "Stop", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "TMS_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN"] },
  { name: "stop.create", description: "Add pickup or delivery stop", category: "Stop", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "OWNER", "ADMIN"] },
  { name: "stop.update", description: "Update stop times and appointment windows", category: "Stop", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "OWNER", "ADMIN"] },
  { name: "stop.delete", description: "Remove stop from load", category: "Stop", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_DISPATCHER", "OWNER", "ADMIN"] },
  { name: "stop.resequence", description: "Resequence multi-stop load", category: "Stop", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_DISPATCHER", "OWNER", "ADMIN"] },

  // Carriers
  { name: "carrier.read", description: "View carrier master data and safety scores", category: "Carrier", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "TMS_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN"] },
  { name: "carrier.create", description: "Add new motor carrier entity", category: "Carrier", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "OWNER", "ADMIN"] },
  { name: "carrier.update", description: "Update carrier compliance & insurance info", category: "Carrier", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "OWNER", "ADMIN"] },
  { name: "carrier.delete", description: "Delete carrier profile", category: "Carrier", defaultRoles: ["TMS_ADMIN", "OWNER"] },
  { name: "carrier.assign", description: "Assign carrier to tender/load", category: "Carrier", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "OWNER", "ADMIN"] },
  { name: "carrier.approve", description: "Approve carrier for dispatch", category: "Carrier", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "OWNER", "ADMIN"] },

  // Rates & Quotes
  { name: "rate.read", description: "View spot and contract freight rates", category: "Rate", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "TMS_BILLING", "TMS_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN"] },
  { name: "rate.create", description: "Create freight rate card", category: "Rate", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "OWNER", "ADMIN"] },
  { name: "rate.update", description: "Modify rate benchmark", category: "Rate", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "OWNER", "ADMIN"] },
  { name: "rate.approve", description: "Approve tariff update", category: "Rate", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "OWNER", "ADMIN"] },
  { name: "rate.override", description: "Override system recommended spot rate", category: "Rate", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "OWNER", "ADMIN"] },
  { name: "quote.read", description: "View customer freight quotes", category: "Rate", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "TMS_BILLING", "TMS_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN"] },
  { name: "quote.create", description: "Calculate freight quote", category: "Rate", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "OWNER", "ADMIN"] },
  { name: "quote.update", description: "Update quote parameters", category: "Rate", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "OWNER", "ADMIN"] },
  { name: "quote.send", description: "Transmit quote to customer", category: "Rate", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "OWNER", "ADMIN"] },
  { name: "quote.approve", description: "Approve customer quote acceptance", category: "Rate", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "OWNER", "ADMIN"] },

  // Tender
  { name: "tender.read", description: "View load tender status", category: "Tender", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "TMS_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN"] },
  { name: "tender.create", description: "Create electronic tender offer", category: "Tender", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "OWNER", "ADMIN"] },
  { name: "tender.send", description: "Transmit tender to carrier", category: "Tender", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "OWNER", "ADMIN"] },
  { name: "tender.accept", description: "Record carrier tender acceptance", category: "Tender", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_DISPATCHER", "OWNER", "ADMIN"] },
  { name: "tender.reject", description: "Record carrier tender rejection", category: "Tender", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_DISPATCHER", "OWNER", "ADMIN"] },
  { name: "tender.cancel", description: "Recall/cancel pending tender", category: "Tender", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_DISPATCHER", "OWNER", "ADMIN"] },

  // Tracking
  { name: "tracking.read", description: "View real-time telematics & ETA observations", category: "Tracking", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "TMS_VIEWER", "SUPER_ADMIN_READ", "OWNER", "ADMIN"] },
  { name: "tracking.update", description: "Log manual tracking update / checkcall", category: "Tracking", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "OWNER", "ADMIN"] },
  { name: "tracking.manage", description: "Configure Project44 / Samsara telematics streams", category: "Tracking", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "OWNER", "ADMIN"] },

  // Invoices
  { name: "invoice.read", description: "View carrier and customer invoices", category: "Invoice", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_BILLING", "SUPER_ADMIN_READ", "OWNER", "ADMIN"] },
  { name: "invoice.create", description: "Create invoice record", category: "Invoice", defaultRoles: ["TMS_ADMIN", "TMS_BILLING", "OWNER", "ADMIN"] },
  { name: "invoice.update", description: "Update invoice charges", category: "Invoice", defaultRoles: ["TMS_ADMIN", "TMS_BILLING", "OWNER", "ADMIN"] },
  { name: "invoice.approve", description: "Approve carrier invoice payment", category: "Invoice", defaultRoles: ["TMS_ADMIN", "TMS_BILLING", "OWNER", "ADMIN"] },
  { name: "invoice.send", description: "Send customer invoice email", category: "Invoice", defaultRoles: ["TMS_ADMIN", "TMS_BILLING", "OWNER", "ADMIN"] },
  { name: "invoice.void", description: "Void invoice", category: "Invoice", defaultRoles: ["TMS_ADMIN", "TMS_BILLING", "OWNER"] },
  { name: "invoice.export", description: "Export invoice batch for ERP ingestion", category: "Invoice", defaultRoles: ["TMS_ADMIN", "TMS_BILLING", "OWNER", "ADMIN"] },

  // TMS Integration Testing & Extra
  { name: "integration.test", description: "Execute test payload against EDI/API integration", category: "Integration", defaultRoles: ["TMS_ADMIN", "BROKER_ADMIN", "OWNER"] },
  { name: "integration.disable", description: "Disable API integration stream", category: "Integration", defaultRoles: ["TMS_ADMIN", "BROKER_ADMIN", "OWNER"] },

  // TMS Access & General
  { name: "tms.access", description: "Access Qubere TMS Freight Execution System", category: "System", defaultRoles: ["TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "TMS_BILLING", "TMS_VIEWER", "SUPER_ADMIN_READ", "SUPER_ADMIN_WRITE", "INTERNAL_ADMIN", "OWNER", "ADMIN", "MEMBER", "BROKER_ADMIN", "BROKER_MANAGER"] },

  // Freight Execution
  { name: "transportationOrders.read", description: "View transportation orders", category: "Freight", defaultRoles: ["ADMIN", "MEMBER", "VIEWER", "OWNER", "TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER", "TMS_VIEWER", "SUPER_ADMIN_READ"] },
  { name: "transportationOrders.write", description: "Create and update transportation orders", category: "Freight", defaultRoles: ["ADMIN", "MEMBER", "OWNER", "TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS"] },
  { name: "carriers.manage", description: "Manage carriers and profiles", category: "Freight", defaultRoles: ["ADMIN", "OWNER", "TMS_ADMIN", "TMS_MANAGER"] },
  { name: "tenders.send", description: "Send load tenders to carriers", category: "Freight", defaultRoles: ["ADMIN", "MEMBER", "OWNER", "TMS_ADMIN", "TMS_MANAGER", "TMS_OPERATIONS", "TMS_DISPATCHER"] },
  { name: "carrierInvoices.match", description: "Perform freight audit and invoice matching", category: "Freight", defaultRoles: ["ADMIN", "MEMBER", "OWNER", "TMS_ADMIN", "TMS_BILLING"] },
  { name: "carrierInvoices.override", description: "Override invoice audit mismatch warnings", category: "Freight", defaultRoles: ["ADMIN", "OWNER", "TMS_ADMIN"] },

  // ─── QUBERE ADMIN / PLATFORM PERMISSIONS ─────────────────────────────────

  { name: "system.users.read", description: "Read all platform users across tenants", category: "System", defaultRoles: ["INTERNAL_ADMIN", "SUPER_ADMIN_READ", "SUPER_ADMIN_WRITE"] },
  { name: "system.users.manage", description: "Manage platform users across tenants", category: "System", defaultRoles: ["INTERNAL_ADMIN", "SUPER_ADMIN_WRITE"] },
  { name: "system.tenants.read", description: "Read platform tenants/organizations", category: "System", defaultRoles: ["INTERNAL_ADMIN", "SUPER_ADMIN_READ", "SUPER_ADMIN_WRITE"] },
  { name: "system.configuration.read", description: "View platform global configuration", category: "System", defaultRoles: ["INTERNAL_ADMIN", "SUPER_ADMIN_READ", "SUPER_ADMIN_WRITE"] },
  { name: "system.configuration.write", description: "Modify platform global configuration", category: "System", defaultRoles: ["INTERNAL_ADMIN", "SUPER_ADMIN_WRITE"] },
  { name: "system.audit.read", description: "Read global system audit log", category: "System", defaultRoles: ["INTERNAL_ADMIN", "SUPER_ADMIN_READ", "SUPER_ADMIN_WRITE"] },
  { name: "system.support.read", description: "View support tickets and diagnostics", category: "System", defaultRoles: ["INTERNAL_ADMIN", "SUPER_ADMIN_READ", "SUPER_ADMIN_WRITE"] },
  { name: "system.impersonate.write", description: "Impersonate customer user for troubleshooting", category: "System", defaultRoles: ["SUPER_ADMIN_WRITE"] },
] as const;

export const PERMISSION_NAMES = PERMISSION_CATALOGUE.map((p) => p.name);
export type PermissionName = (typeof PERMISSION_NAMES)[number];

export function findPermission(name: string): PermissionDefinition | null {
  return PERMISSION_CATALOGUE.find((p) => p.name === name) ?? null;
}

export function defaultPermissionsForRole(roleName: string): string[] {
  const role = roleName.toUpperCase() as SystemRole;
  return PERMISSION_CATALOGUE.filter((p) =>
    (p.defaultRoles as readonly string[]).includes(role)
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
