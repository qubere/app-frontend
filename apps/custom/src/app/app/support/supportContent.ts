import generatedProductHelp from "./generatedProductHelp.json";

export type SupportModuleId =
  | "start"
  | "shipments"
  | "documents"
  | "filing"
  | "classification"
  | "compliance"
  | "post-entry"
  | "trade-data"
  | "billing-admin";

export interface SupportModule {
  id: SupportModuleId;
  name: string;
  shortName: string;
  description: string;
  icon: "compass" | "shipments" | "documents" | "filing" | "classification" | "compliance" | "post-entry" | "trade-data" | "billing";
  accent: string;
}

export interface SupportArticle {
  id: string;
  moduleId: SupportModuleId;
  question: string;
  answer: string;
  steps: string[];
  href?: string;
  actionLabel?: string;
  tags: string[];
  popular?: boolean;
}

export const SUPPORT_MODULES: SupportModule[] = [
  {
    id: "start",
    name: "Start here",
    shortName: "Start here",
    description: "Prioritize today’s work, read the command center, and get around Qubere quickly.",
    icon: "compass",
    accent: "from-sky-500 to-blue-600",
  },
  {
    id: "shipments",
    name: "Shipments & workspace",
    shortName: "Shipments",
    description: "Create, assign, track, and move a shipment through the customs workflow.",
    icon: "shipments",
    accent: "from-blue-500 to-cyan-400",
  },
  {
    id: "documents",
    name: "Documents & intake",
    shortName: "Documents",
    description: "Bring documents in, attach them correctly, and review extracted data.",
    icon: "documents",
    accent: "from-violet-500 to-purple-500",
  },
  {
    id: "filing",
    name: "Customs filing",
    shortName: "Filing",
    description: "Prepare an entry, clear readiness gates, generate forms, and track responses.",
    icon: "filing",
    accent: "from-indigo-500 to-blue-600",
  },
  {
    id: "classification",
    name: "Classification & tariffs",
    shortName: "Classification",
    description: "Review HTS suggestions, research tariffs, and compare sourcing scenarios.",
    icon: "classification",
    accent: "from-fuchsia-500 to-violet-500",
  },
  {
    id: "compliance",
    name: "Compliance & licensing",
    shortName: "Compliance",
    description: "Screen parties, investigate hits, monitor changes, and manage licenses.",
    icon: "compliance",
    accent: "from-emerald-500 to-teal-500",
  },
  {
    id: "post-entry",
    name: "Post-entry & recovery",
    shortName: "Post-entry",
    description: "Handle reconciliation, PSCs, protests, drawback, and recovery deadlines.",
    icon: "post-entry",
    accent: "from-amber-500 to-orange-500",
  },
  {
    id: "trade-data",
    name: "Trade data & onboarding",
    shortName: "Trade data",
    description: "Maintain products, parties, clients, importers, bonds, POAs, and onboarding.",
    icon: "trade-data",
    accent: "from-cyan-500 to-teal-500",
  },
  {
    id: "billing-admin",
    name: "Billing & administration",
    shortName: "Billing & admin",
    description: "Manage charges, invoices, rate cards, users, policies, and integrations.",
    icon: "billing",
    accent: "from-slate-600 to-slate-800",
  },
];

export const BASE_SUPPORT_ARTICLES: SupportArticle[] = [
  {
    id: "work-today",
    moduleId: "start",
    question: "What should I work on first today?",
    answer: "Use Today as your operational queue. It brings blocked work, items needing human review, deadlines, document issues, filing exceptions, compliance tasks, and billing exceptions into one prioritized view.",
    steps: [
      "Open Today from the pinned navigation at the top of the sidebar.",
      "Start with Blocked, then Needs Review; use the owner and task filters to narrow the queue.",
      "Open a card to see what is wrong, the expected action, and the underlying shipment or document.",
      "Resolve, assign, approve, or upload from the action panel, then confirm the item leaves the queue.",
    ],
    href: "/app/actions",
    actionLabel: "Open Today",
    tags: ["today", "actions", "queue", "priority", "blocked", "review", "assignment", "work"],
    popular: true,
  },
  {
    id: "command-center",
    moduleId: "start",
    question: "What is the Command Center for?",
    answer: "The Command Center is the management view of customs operations. Use it to understand volume, clearance progress, risk, deadlines, team workload, and exceptions; use Today when you need to act on individual items.",
    steps: [
      "Open Command Center from the pinned navigation.",
      "Review the high-level operational and compliance signals first.",
      "Use My Work and other available views to move from a trend or count into the underlying records.",
      "Return to Today for item-by-item disposition work.",
    ],
    href: "/app/dashboard",
    actionLabel: "Open Command Center",
    tags: ["dashboard", "command center", "metrics", "workload", "operations", "management"],
  },
  {
    id: "ask-qubere",
    moduleId: "start",
    question: "When should I use Ask Qubere?",
    answer: "Use Ask Qubere for account-specific operational questions such as what needs attention, why a compliance check failed, whether a shipment has been screened, or what changed on a record. The assistant respects your account and permissions and links supported answers back to Qubere records.",
    steps: [
      "Open Ask Qubere from the blue button in the sidebar.",
      "Ask one specific question and name the shipment, party, product, or client when possible.",
      "Open the record links in the answer to verify the source data before taking a regulated action.",
      "If the answer says data is missing or unavailable, use the named workspace to correct it rather than assuming a clear result.",
    ],
    href: "/chat",
    actionLabel: "Open Ask Qubere",
    tags: ["chat", "assistant", "copilot", "ai", "question", "why", "ask qubere"],
    popular: true,
  },
  {
    id: "account-switching",
    moduleId: "start",
    question: "How do I switch accounts or know which data I am viewing?",
    answer: "Use the account switcher in the sidebar. The header shows the active account, and Qubere isolates work by account and data mode so customer records do not mix.",
    steps: [
      "Check the account name in the header before starting work.",
      "Use the account switcher below Ask Qubere to choose another permitted account.",
      "Confirm the account name and data-mode indicator changed before editing records.",
      "If the account is missing, ask an account administrator to add your membership or role.",
    ],
    tags: ["account", "tenant", "switch", "data mode", "demo", "sandbox", "production"],
  },

  {
    id: "create-shipment",
    moduleId: "shipments",
    question: "How do I create a new shipment?",
    answer: "Create a shipment from the Shipments workspace, then add the commercial and transport context needed for Qubere to assemble the entry and run the agent pipeline.",
    steps: [
      "Open Shipments and choose Create New Shipment.",
      "Enter the reference, client or importer, origin, destination, mode, and available transport details.",
      "Save the shipment, then upload or attach the supporting documents.",
      "Open the shipment workspace and review missing facts, agent progress, readiness, and exceptions.",
    ],
    href: "/app/shipments/new",
    actionLabel: "Create shipment",
    tags: ["shipment", "create", "new", "importer", "destination", "mode"],
    popular: true,
  },
  {
    id: "shipment-owner",
    moduleId: "shipments",
    question: "How do I assign a shipment owner?",
    answer: "Assign the shipment from the Shipments workbench. Ownership is used by Today and team filters so the right broker sees the work and deadlines.",
    steps: [
      "Open Shipments and locate the record.",
      "Use the Owner control on the shipment row or available bulk action.",
      "Select the team member and save the assignment.",
      "Filter Today by that assignee to confirm the work appears in the correct queue.",
    ],
    href: "/app/shipments",
    actionLabel: "Open Shipments",
    tags: ["shipment", "owner", "assign", "assignee", "team", "queue"],
  },
  {
    id: "shipment-progress",
    moduleId: "shipments",
    question: "How do I know what is blocking a shipment?",
    answer: "Open the shipment workspace and read the journey, pre-filing readiness, action cards, document status, and compliance checks together. A blocked or review state should identify the missing fact, document, decision, or failed check that must be handled.",
    steps: [
      "Open the shipment from Shipments or Today.",
      "Review the journey ribbon and pipeline progress for the current stage.",
      "Open Pre-filing Readiness and the action or exception area for the exact blocker.",
      "Correct the source fact, attach the missing document, resolve the exception, or complete the required review; then rerun only where the screen offers that action.",
    ],
    href: "/app/shipments",
    actionLabel: "Find a shipment",
    tags: ["shipment", "blocked", "pipeline", "journey", "readiness", "exception", "missing"],
  },
  {
    id: "track-shipment",
    moduleId: "shipments",
    question: "Where do I see shipment legs and tracking events?",
    answer: "The shipment workspace includes transport legs and tracking. Use it to see planned and actual milestones without treating logistics progress as customs clearance status.",
    steps: [
      "Open the shipment detail page.",
      "Go to the tracking or transport section and review the route and leg sequence.",
      "Add a transport leg if the move is incomplete and your role permits it.",
      "Use customs readiness and filing response areas separately to confirm clearance status.",
    ],
    href: "/app/shipments",
    actionLabel: "Open Shipments",
    tags: ["tracking", "leg", "transport", "milestone", "route", "multileg", "shipment status"],
  },

  {
    id: "upload-document",
    moduleId: "documents",
    question: "How do I upload and attach a document?",
    answer: "Upload the file in Documents or from a shipment workspace. If Qubere cannot confidently match it, the document stays unattached until a person selects the shipment.",
    steps: [
      "Open Documents and upload the file, or upload from the shipment’s document area.",
      "Wait for malware scanning, classification, extraction, and matching to finish.",
      "If the document is unattached, open it and select the correct shipment.",
      "Review the extracted fields and exceptions before relying on them for filing.",
    ],
    href: "/app/documents",
    actionLabel: "Open Documents",
    tags: ["document", "upload", "attach", "unattached", "invoice", "packing list", "bill of lading"],
    popular: true,
  },
  {
    id: "email-document",
    moduleId: "documents",
    question: "How do emailed documents get into Qubere?",
    answer: "Account administrators configure approved inbound senders and the account’s document email routing. Known senders can enter document processing; unknown or untrusted mail is held for review rather than silently attached.",
    steps: [
      "Open Manage Account from the profile menu, then Document Email.",
      "Confirm the inbound address, sender rule, client mapping, and default assignee.",
      "Send or forward the trade document with the shipment reference in the subject or message when available.",
      "Check Documents for the processed file or the Quarantine view if the sender was not recognized.",
    ],
    href: "/app/admin/settings",
    actionLabel: "Open document settings",
    tags: ["email", "inbound", "sender", "mailbox", "routing", "document", "forward"],
  },
  {
    id: "quarantine-document",
    moduleId: "documents",
    question: "What do I do with a quarantined email or attachment?",
    answer: "Quarantine protects the account from unknown or incorrectly routed inbound mail. Review the sender, subject, client, attachment, and destination before releasing; discard or block items that should not enter processing.",
    steps: [
      "Open Documents and switch to the Quarantine view.",
      "Verify the sender, subject, account or client, attachment name, and timestamp.",
      "Release valid items so they can enter normal document processing.",
      "Discard unwanted items, or block the sender when future mail should be refused.",
    ],
    href: "/app/documents",
    actionLabel: "Review quarantine",
    tags: ["quarantine", "unknown sender", "email", "release", "discard", "block", "attachment"],
  },
  {
    id: "review-extraction",
    moduleId: "documents",
    question: "How do I review or correct extracted document fields?",
    answer: "Open the document review experience from Documents, Today, or the shipment. Compare the extracted value with the source page and provenance, then approve or correct the field so downstream shipment and filing facts use reviewed data.",
    steps: [
      "Open the document or its review task.",
      "Compare each flagged value with the rendered source and confidence or evidence shown.",
      "Approve correct values; edit incorrect values and provide the requested review note when required.",
      "Confirm conflicts or missing-field actions clear after the reviewed value is applied.",
    ],
    href: "/app/documents",
    actionLabel: "Open document review",
    tags: ["extraction", "field", "correct", "approve", "confidence", "evidence", "review"],
  },
  {
    id: "detach-document",
    moduleId: "documents",
    question: "A document is attached to the wrong shipment. How do I fix it?",
    answer: "Detach the document from the incorrect shipment, then attach it to the correct one. This preserves the audit trail and lets Qubere rebuild the relevant context instead of copying the file.",
    steps: [
      "Open the document from the shipment or Documents workspace.",
      "Choose Detach and confirm the affected shipment.",
      "Return to the unattached document and select the correct shipment.",
      "Review any new extraction conflicts or pipeline actions created by the corrected context.",
    ],
    href: "/app/documents",
    actionLabel: "Open Documents",
    tags: ["detach", "wrong shipment", "reattach", "document", "audit"],
  },
  {
    id: "trade-repository-overview",
    moduleId: "documents",
    question: "What is the Trade Repository and what does it show?",
    answer: "Trade Repository links documents to the shipments, parties, products, or licenses they support, so you can find every document tied to a given entity instead of searching shipment by shipment.",
    steps: [
      "Open Trade Repository from the main navigation.",
      "Filter by entity type and id, or search across linked documents.",
      "Open a linked document to review its extraction or attach it to another entity.",
    ],
    href: "/app/trade-repository",
    actionLabel: "Open Trade Repository",
    tags: ["trade repository", "linked document", "entity", "party", "product", "license"],
  },

  {
    id: "create-filing",
    moduleId: "filing",
    question: "How do I create a customs filing from a shipment?",
    answer: "Start the filing from a shipment after its destination and procedure can be determined. Qubere maps reviewed shipment facts into the country-specific declaration and preserves field provenance.",
    steps: [
      "Open the shipment and confirm the destination country and entry context.",
      "Review Pre-filing Readiness and resolve blocking documents, facts, classifications, or compliance checks.",
      "Choose the filing action and select the configured procedure or entry type.",
      "Review the generated declaration before saving or submitting it.",
    ],
    href: "/app/filing",
    actionLabel: "Open Filing Center",
    tags: ["filing", "entry", "create", "procedure", "entry type", "shipment", "declaration"],
    popular: true,
  },
  {
    id: "filing-not-ready",
    moduleId: "filing",
    question: "Why is a filing not ready to transmit?",
    answer: "Transmission is gated when required declaration data, documents, classifications, compliance results, approvals, or filing configuration are missing or invalid. The readiness panel should name each blocking and warning condition.",
    steps: [
      "Open the filing or its shipment and review readiness.",
      "Handle blockers first; warnings may still require professional judgment even when they do not stop transmission.",
      "Correct the source record rather than repeatedly editing a derived value when the issue began in a document, product, party, or shipment.",
      "Recheck readiness and confirm the declaration snapshot reflects the corrected data.",
    ],
    href: "/app/filing",
    actionLabel: "Review filing readiness",
    tags: ["not ready", "transmit", "blocker", "validation", "missing field", "readiness", "error"],
  },
  {
    id: "form-7501",
    moduleId: "filing",
    question: "Where do I generate or download the CBP Form 7501 draft?",
    answer: "The 7501 draft is generated from the filing’s reviewed declaration data. Open the filing and use its document or export actions only after checking totals, parties, classification, origin, valuation, and entry identifiers.",
    steps: [
      "Open the filing detail record.",
      "Review the declaration tabs, line items, duties and fees, and filing snapshot.",
      "Use the available export or Form 7501 action to generate the draft.",
      "Download and review the form before transmission; return to the source field if a correction is needed.",
    ],
    href: "/app/filing",
    actionLabel: "Open filings",
    tags: ["7501", "form", "draft", "download", "export", "cbp", "entry summary"],
    popular: true,
  },
  {
    id: "transmit-filing",
    moduleId: "filing",
    question: "How do I transmit an entry and read the response?",
    answer: "Transmit only from a ready filing and with the required authority. Qubere records outbound and inbound messages, response status, validation errors, and retry history on the filing for auditability.",
    steps: [
      "Open a filing that has passed readiness and required approvals.",
      "Review the immutable filing snapshot and choose Transmit.",
      "Watch the response area for accepted, rejected, warning, or pending status.",
      "Open any returned message, correct the named source data or configuration, and resubmit through the offered action rather than creating a duplicate filing.",
    ],
    href: "/app/filing",
    actionLabel: "Open Filing Center",
    tags: ["transmit", "ace", "abi", "response", "reject", "accepted", "resubmit", "message"],
  },

  {
    id: "classification-inbox",
    moduleId: "classification",
    question: "How do I review an HTS classification suggestion?",
    answer: "Use the Classification Inbox for cases requiring human review. Inspect the proposed code, rationale, evidence, confidence, alternatives, and any verification questionnaire before approving or rejecting it.",
    steps: [
      "Open Classification Inbox and filter for Needs Review.",
      "Open a case and compare the description, attributes, evidence, and candidate codes.",
      "Answer the verification questions and research the tariff hierarchy or ruling support as needed.",
      "Approve, reject, or correct the classification so the decision and reviewer are written to the audit trail.",
    ],
    href: "/app/classification",
    actionLabel: "Open Classification Inbox",
    tags: ["hts", "classification", "review", "approve", "code", "rationale", "evidence"],
    popular: true,
  },
  {
    id: "hts-lookup",
    moduleId: "classification",
    question: "How do I look up an HTS code or tariff rate?",
    answer: "Use HTS Lookup to search the tariff hierarchy and inspect code descriptions and available rate details. A lookup supports research; it does not by itself approve the classification for a product or entry.",
    steps: [
      "Open HTS Lookup from Data & Intelligence.",
      "Search by code or a specific product description.",
      "Navigate the hierarchy and review the complete provision and rate context.",
      "Record the final, supported decision in the product or classification case rather than relying on search history.",
    ],
    href: "/app/hts",
    actionLabel: "Open HTS Lookup",
    tags: ["hts lookup", "tariff", "rate", "search", "code", "hierarchy"],
  },
  {
    id: "product-classification",
    moduleId: "classification",
    question: "How do I save a reusable classification on a product?",
    answer: "Open the product in Trade Data and add or review a jurisdiction-specific classification with its evidence. Approved product decisions can be reused while still remaining distinct from shipment-specific facts.",
    steps: [
      "Open Trade Data, Products, and select the SKU or item.",
      "Open the Trade & Customs or classification area.",
      "Add the jurisdiction, code, effective context, rationale, and supporting evidence.",
      "Complete the required review or approval instead of importing an unreviewed spreadsheet value as approved.",
    ],
    href: "/app/products",
    actionLabel: "Open Products",
    tags: ["product", "sku", "classification", "reuse", "approve", "evidence", "master data"],
  },
  {
    id: "tariff-simulator",
    moduleId: "classification",
    question: "How do I compare duties across sourcing scenarios?",
    answer: "Use the Tariff & Sourcing Simulator to compare landed-duty scenarios by product, classification, origin, value, and destination. Treat the result as a scenario until the underlying classification and origin are verified for the actual shipment.",
    steps: [
      "Open Tariff Simulator from Data & Intelligence.",
      "Enter the product or HTS code, origin, destination, customs value, and quantity.",
      "Compare the duty and available sourcing scenarios.",
      "Open the relevant product or shipment to formalize any decision used in an entry.",
    ],
    href: "/app/simulator",
    actionLabel: "Open Tariff Simulator",
    tags: ["simulator", "landed cost", "duty", "sourcing", "origin", "what if", "tariff"],
  },

  {
    id: "screen-party",
    moduleId: "compliance",
    question: "How do I screen a party against restricted-party lists?",
    answer: "Run restricted-party screening from the Compliance workspace or a party record. Review candidate matches and evidence; a name similarity is not automatically proof that the party is the listed entity.",
    steps: [
      "Open Compliance and choose Party Screening, or open the party’s screening area.",
      "Enter or confirm the party’s current legal name, country, address, and identifiers.",
      "Run screening and inspect each candidate’s matched fields, list source, score, and status.",
      "Disposition the result with the required authority and supporting note; do not treat an unavailable dataset as a clear result.",
    ],
    href: "/app/compliance",
    actionLabel: "Open Compliance",
    tags: ["restricted party", "denied party", "screen", "sanctions", "hit", "match", "rps"],
    popular: true,
  },
  {
    id: "bulk-screening",
    moduleId: "compliance",
    question: "How do I screen many parties or transaction lines at once?",
    answer: "Use Bulk Compliance Screening to upload a supported transaction file and choose the checks to run. The batch keeps row-level outcomes and requires review where a result is not safely deterministic.",
    steps: [
      "Open Compliance, then Bulk Screening.",
      "Choose Upload batch and select the file.",
      "Enable at least one applicable check: party, license, embargo, or product classification.",
      "Open the completed batch, filter exceptions, review the affected rows, and export results if needed.",
    ],
    href: "/app/compliance/bulk-screening",
    actionLabel: "Open Bulk Screening",
    tags: ["bulk", "batch", "upload", "screening", "csv", "xlsx", "xml", "license", "embargo"],
  },
  {
    id: "continuous-monitoring",
    moduleId: "compliance",
    question: "How does continuous party monitoring work?",
    answer: "Continuous monitoring re-screens eligible parties when reference data changes and records what changed, who may be affected, and how alerts were handled. It does not replace review of shipment-specific parties at the time of filing.",
    steps: [
      "Open Compliance and review monitoring, execution history, and alerts.",
      "Open an alert to see the reference-data change and impacted party or prior result.",
      "Preview impact, run the permitted re-screen action when needed, and review the new evidence.",
      "Disposition the alert so the reason and reviewer remain in audit history.",
    ],
    href: "/app/compliance",
    actionLabel: "Review monitoring",
    tags: ["continuous monitoring", "rdps", "rescreen", "alert", "list update", "reference data"],
  },
  {
    id: "manage-license",
    moduleId: "compliance",
    question: "How do I add and manage a trade license?",
    answer: "Use License Management to maintain license numbers, parties, covered classifications or lines, effective dates, quantities or values, documents, notes, and utilization.",
    steps: [
      "Open License Management and create or open the license record.",
      "Add its issuing authority, effective period, covered parties and goods, and limits.",
      "Upload the license document and confirm any conditions or exclusions.",
      "Monitor allocation and utilization; close, renew, or replace the record when its legal status changes.",
    ],
    href: "/app/license-management",
    actionLabel: "Open License Management",
    tags: ["license", "permit", "utilization", "allocation", "expiry", "conditions"],
  },
  {
    id: "regulatory-update",
    moduleId: "compliance",
    question: "Where do I see regulatory changes that may affect my entries?",
    answer: "Regulatory Intelligence organizes updates by jurisdiction, category, impact, effective date, and affected shipments. Use it to identify operational impact, then review the source and affected records before changing a filing decision.",
    steps: [
      "Open Regulatory Updates from Compliance & Licensing.",
      "Filter by jurisdiction, category, effective date, or impact level.",
      "Open an update to read the published text and affected-shipment context.",
      "Review impacted products, parties, or shipments and document any resulting decision.",
    ],
    href: "/app/regulatory",
    actionLabel: "Open Regulatory Updates",
    tags: ["regulatory", "update", "effective date", "impact", "rule", "tariff change"],
  },

  {
    id: "create-psc",
    moduleId: "post-entry",
    question: "How do I create a Post-Summary Correction?",
    answer: "Create a PSC from Post-Entry or convert an eligible reconciliation issue. Qubere tracks the original entry, changed data, recalculated duties, filing window, status, and transmission history.",
    steps: [
      "Open Post-Entry and choose Post-Summary Corrections.",
      "Create a PSC or convert an eligible issue from Reconciliation.",
      "Select the original filing and enter the corrected facts and explanation.",
      "Review duty impact, deadlines, supporting documents, and approvals before transmission.",
    ],
    href: "/app/post-entry/psc",
    actionLabel: "Open PSCs",
    tags: ["psc", "post summary correction", "correct", "entry", "270 day", "recalculate"],
    popular: true,
  },
  {
    id: "reconciliation",
    moduleId: "post-entry",
    question: "How do I review an entry reconciliation issue?",
    answer: "The Reconciliation Control Center compares source and entry data to surface discrepancies. Review the evidence and either resolve the issue or convert an eligible discrepancy into a PSC.",
    steps: [
      "Open Post-Entry, then ACE Reconciliation.",
      "Filter open issues and inspect the entry, source documents, fields, and amounts involved.",
      "Confirm whether the difference is a data issue, expected variance, or filing correction.",
      "Resolve with a note or convert to PSC; verify the issue status and audit history update.",
    ],
    href: "/app/reconciliation",
    actionLabel: "Open Reconciliation",
    tags: ["reconciliation", "discrepancy", "difference", "convert", "psc", "source documents"],
  },
  {
    id: "create-protest",
    moduleId: "post-entry",
    question: "How do I draft and track a CBP Form 19 protest?",
    answer: "Use Protests in Post-Entry to draft the challenged decision, legal basis, affected entries, relief requested, supporting exhibits, deadlines, and later status. Qubere helps organize the record; licensed legal or customs judgment remains required.",
    steps: [
      "Open Post-Entry and choose Protests (Form 19).",
      "Create a protest and identify the protested decision and entry or entries.",
      "Add the facts, legal argument, requested relief, exhibits, and accelerated-disposition or further-review details when applicable.",
      "Review the filing deadline and approval, then track CBP status and any deemed-denial or appeal date.",
    ],
    href: "/app/post-entry/protests",
    actionLabel: "Open Protests",
    tags: ["protest", "form 19", "180 day", "cbp", "liquidation", "further review", "frp"],
  },
  {
    id: "duty-drawback",
    moduleId: "post-entry",
    question: "How do I find potential duty drawback recovery?",
    answer: "The Recovery & Drawback Control Center identifies potential import-to-export matches, estimated recovery, eligibility issues, lot evidence, and claim deadlines. Review the legal basis and evidence before treating an estimate as recoverable cash.",
    steps: [
      "Open Post-Entry and choose Duty Drawback.",
      "Review potential recovery opportunities and their deadline or evidence status.",
      "Open a candidate to verify imported merchandise, export or destruction evidence, quantities, and substitutions.",
      "Resolve gaps and advance only supported claims through review and filing.",
    ],
    href: "/app/vault",
    actionLabel: "Open Duty Recovery",
    tags: ["drawback", "recovery", "refund", "export", "deadline", "claim", "duty"],
  },

  {
    id: "import-products",
    moduleId: "trade-data",
    question: "How do I import products without creating duplicates?",
    answer: "Use the Products import workflow to download the template, preview the file, review exact and possible matches, and commit only accepted rows. Imported classifications remain candidates until reviewed.",
    steps: [
      "Open Trade Data, Products, then Import products.",
      "Use the template and keep identifiers, descriptions, origin, and classification evidence in the correct columns.",
      "Upload and review invalid rows, already-present items, and possible matches.",
      "Commit only the intended new records, then complete any classification or origin review.",
    ],
    href: "/app/products/import",
    actionLabel: "Import products",
    tags: ["product", "import", "csv", "duplicate", "sku", "item master", "template"],
  },
  {
    id: "manage-parties",
    moduleId: "trade-data",
    question: "How do I add or verify a party and its registrations?",
    answer: "Party Master separates identity, roles, addresses, identifiers, registrations, evidence, screening, and review status. Verify each registration with evidence rather than treating the entire party as globally verified.",
    steps: [
      "Open Trade Data, Parties, and add or select the party.",
      "Maintain legal and trade names, identifiers, addresses, contacts, sites, roles, and relationships.",
      "Add jurisdiction-specific registrations and attach evidence.",
      "Move the party and each registration through the permitted review steps, then resolve any revalidation flags after material changes.",
    ],
    href: "/app/parties",
    actionLabel: "Open Parties",
    tags: ["party", "supplier", "manufacturer", "registration", "eori", "verify", "address"],
  },
  {
    id: "onboard-client",
    moduleId: "trade-data",
    question: "How do I onboard a new customs client?",
    answer: "Use Onboarding to collect and review the legal entity, importer information, screening, CBP Form 5106 data, POA, bond, billing, and activation steps as one case.",
    steps: [
      "Open Onboarding and create a case for the client and primary importer.",
      "Complete legal entity and importer details, then review screening results.",
      "Collect or verify Form 5106, POA, bond coverage, billing setup, and any ERP-import review.",
      "Review the activation checklist and close only after required evidence and approvals are complete.",
    ],
    href: "/app/onboarding",
    actionLabel: "Open Onboarding",
    tags: ["onboarding", "client", "customer", "5106", "poa", "bond", "activate", "erp"],
    popular: true,
  },
  {
    id: "bonds-poa",
    moduleId: "trade-data",
    question: "Where do I manage importer bonds and powers of attorney?",
    answer: "Use the dedicated Bonds and POA workspaces under Management. Keep effective dates, importer or client relationships, coverage or authority, documents, and status current so filing readiness can evaluate them.",
    steps: [
      "Open Bonds to review coverage, sufficiency, surety, effective dates, and status.",
      "Open POA to review the grantor, broker authority, execution details, signers, and document.",
      "Correct expired, missing, or insufficient records and attach the supporting evidence.",
      "Return to the client, importer, onboarding case, or shipment to confirm the requirement is satisfied.",
    ],
    href: "/app/bonds",
    actionLabel: "Open Bonds",
    tags: ["bond", "poa", "power of attorney", "surety", "coverage", "importer", "authority"],
  },

  {
    id: "billing-exception",
    moduleId: "billing-admin",
    question: "Why is a shipment charge missing or in a billing exception?",
    answer: "Billing exceptions identify unmapped events, missing or zero rates, configuration gaps, or other rating problems. Resolve the underlying event or rate-card mapping, then disposition the exception with an auditable note.",
    steps: [
      "Open Billing Exceptions from the Billing workspace or Today.",
      "Open the exception and inspect the client, shipment, event, applicable rate card, and failure reason.",
      "Correct the mapping or rate configuration, or waive the exception only with the required authority and reason.",
      "Confirm the charge is rated correctly and no longer appears as unresolved leakage.",
    ],
    href: "/app/billing/exceptions",
    actionLabel: "Open Billing Exceptions",
    tags: ["billing", "exception", "missing charge", "zero rate", "revenue leakage", "waive", "resolve"],
    popular: true,
  },
  {
    id: "rate-card",
    moduleId: "billing-admin",
    question: "How do I create or update a client rate card?",
    answer: "Rate cards are versioned. Build or import a draft, map operational events to rules, simulate representative shipments, and activate the new version rather than editing an active historical rate basis in place.",
    steps: [
      "Open Billing, then Rate Card Management.",
      "Create a draft, import a supported spreadsheet, or create a new version of an existing card.",
      "Configure units, included quantities, tiers, conditions, client or importer scope, and event mappings.",
      "Run Rate Card Simulation, review the output, and activate with the required permission.",
    ],
    href: "/app/billing/rate-cards",
    actionLabel: "Open Rate Cards",
    tags: ["rate card", "rate", "pricing", "version", "simulate", "import", "billing"],
  },
  {
    id: "create-invoice",
    moduleId: "billing-admin",
    question: "How do I create and send a customer invoice?",
    answer: "Create an invoice from eligible unbilled charges, review the customer and line details, then move it through approval and sending. Payment and void rules preserve the financial audit trail.",
    steps: [
      "Open Billing, then Invoices, and choose Create Invoice.",
      "Select the client and eligible unbilled charges for the period.",
      "Review taxes, pass-through amounts, adjustments, currency, totals, and supporting shipment detail.",
      "Submit for approval, approve with the required checker role, send, and record partial or full payments as received.",
    ],
    href: "/app/billing/invoices",
    actionLabel: "Open Invoices",
    tags: ["invoice", "unbilled", "approve", "send", "payment", "accounts receivable", "billing"],
  },
  {
    id: "users-roles",
    moduleId: "billing-admin",
    question: "How do I invite a user or change their permissions?",
    answer: "Account administrators manage members, account memberships, roles, and granular permissions from Manage Account. Give users the least access needed and keep regulated approvals separated where maker-checker controls apply.",
    steps: [
      "Open the profile menu and choose Manage Account.",
      "Use Users to invite the person and assign an account role.",
      "Use Roles & Permissions to review or create the permission set.",
      "Confirm the user can access the required workspace without granting unrelated admin, compliance, filing, or billing authority.",
    ],
    href: "/app/admin/users",
    actionLabel: "Open User Management",
    tags: ["user", "invite", "role", "permission", "access", "admin", "maker checker"],
  },
  {
    id: "settings-integrations",
    moduleId: "billing-admin",
    question: "Where do I configure workflow rules, document email, APIs, and integrations?",
    answer: "Use Manage Account and Settings for escalation rules, stage gates, agent policies, private embargo rules, inbound document email, API keys, webhooks, audit history, and connected services such as accounting integrations.",
    steps: [
      "Open the profile menu and choose Manage Account.",
      "Choose Settings, Document Email, or Integrations & APIs for the configuration you need.",
      "Make the smallest scoped change and review its account, role, event, or workflow coverage.",
      "Verify the settings audit trail and test the affected workflow with a non-production or controlled record when available.",
    ],
    href: "/app/admin/settings",
    actionLabel: "Open Settings",
    tags: ["settings", "integration", "quickbooks", "api key", "webhook", "stage gate", "escalation", "agent policy"],
  },
  {
    id: "filing-configuration",
    moduleId: "billing-admin",
    question: "Where do I manage platform-wide customs filing configuration?",
    answer: "Filing Configuration is a platform-admin-only workspace under Management for cross-tenant customs filing rules. It is separate from a single account's Settings and only appears in the sidebar for platform administrators.",
    steps: [
      "Open the Management section of the sidebar (visible to platform admins only).",
      "Select Filing Configuration.",
      "Review or update the platform-global filing rules, then confirm the change applies to the intended tenants.",
    ],
    href: "/app/filing-config",
    actionLabel: "Open Filing Configuration",
    tags: ["filing configuration", "platform admin", "cross-tenant", "customs rules", "management"],
  },
  {
    id: "notification-center",
    moduleId: "start",
    question: "How do I use notifications without losing my place?",
    answer: "The notification bell collects assignment, SLA, filing, document, license, regulatory, and workflow alerts. Each notification links to the record or queue that raised it; Today remains the complete prioritized work list.",
    steps: [
      "Open the bell beside Help and scan unread items by category and timestamp.",
      "Select a notification to open its shipment, filing, compliance, license, billing, or Today destination.",
      "Complete or route the underlying work in that destination.",
      "Return to Today to verify there are no related blockers or SLA items still open.",
    ],
    href: "/app/actions",
    actionLabel: "Open Today",
    tags: ["notification", "bell", "alert", "unread", "sla", "assignment", "deadline"],
  },
  {
    id: "manage-clients-importers",
    moduleId: "trade-data",
    question: "How do I add a client or importer of record?",
    answer: "Clients represent the brokerage relationship and billing scope; importers of record represent the legal importing entity used by customs workflows. Create the client first, then add or associate the importer and verify identifiers before using it on shipments.",
    steps: [
      "Open Clients & Legal Entities and create or select the brokerage client.",
      "Open Importers of Record and add the legal name, identifiers, address, contacts, and client relationship.",
      "Review bonds and powers of attorney for the importing entity.",
      "Create a controlled shipment and confirm the correct client and importer are available for selection.",
    ],
    href: "/app/clients",
    actionLabel: "Open Clients",
    tags: ["client", "legal entity", "importer", "ior", "customer", "ein", "relationship"],
  },
  {
    id: "product-record-evidence",
    moduleId: "trade-data",
    question: "How do I review or update a Product Master record?",
    answer: "The Product Master keeps reusable commercial facts separate from governed customs decisions. Review descriptions, part numbers, manufacturer and evidence, then use the dedicated classification and origin workflows for legal determinations.",
    steps: [
      "Open Trade Data, then Products, and search by part number, SKU, or description.",
      "Open the product and review commercial attributes, history, evidence, and linked parties.",
      "Use the classification or origin workflow for a customs decision; do not overwrite a governed decision with a commercial attribute.",
      "Save the change with supporting evidence and verify the audit history.",
    ],
    href: "/app/products",
    actionLabel: "Open Products",
    tags: ["product master", "sku", "part number", "manufacturer", "evidence", "history", "origin"],
  },
  {
    id: "party-preapproval",
    moduleId: "compliance",
    question: "How do I pre-approve a known party safely?",
    answer: "Pre-approval records a reviewed party identity so screening can recognize the same verified entity later. It is not a blanket sanctions waiver: changes to identity or worsening reference data can still require review.",
    steps: [
      "Open the party in Trade Data and review its active name, address, country, identifiers, and screening evidence.",
      "Confirm the match belongs to the intended legal entity and that your role permits pre-approval.",
      "Create the pre-approval with a clear reason and supporting evidence.",
      "Revoke it when the identity changes or the approval is no longer justified, and review the audit trail.",
    ],
    href: "/app/parties",
    actionLabel: "Open Parties",
    tags: ["party", "preapprove", "pre-approved", "pal", "allowlist", "screening", "identity"],
  },
  {
    id: "community-screening",
    moduleId: "compliance",
    question: "How do I review a community screening run?",
    answer: "Community Screening runs restricted-party and embargo checks across a group of parties and preserves per-party outcomes. Review failed or incomplete parties individually; a completed batch is not the same as every party being clear.",
    steps: [
      "Open Compliance and choose Community or Bulk Screening.",
      "Open the run and compare completed, hit, review-required, skipped, and failed outcomes.",
      "Open each non-clear party to inspect the match evidence or missing input.",
      "Correct the source party data and re-screen only the affected records, then export the run when needed.",
    ],
    href: "/app/compliance",
    actionLabel: "Open Compliance",
    tags: ["community screening", "batch", "bulk", "party", "failed", "rescreen", "export"],
  },
  {
    id: "embargo-screening",
    moduleId: "compliance",
    question: "How do I run and interpret an embargo screening?",
    answer: "Embargo screening evaluates the configured country movement and records CLEAR, HIT, SKIPPED, or ERROR. Only CLEAR is clear; the result does not replace party, goods, classification, end-use, license, or other admissibility checks.",
    steps: [
      "Open the shipment and find Compliance Checks beneath filing readiness.",
      "Run or re-run Embargo screening when the origin or destination context is complete.",
      "Read the exact status and rule evidence; investigate HIT, SKIPPED, and ERROR rather than treating them as clear.",
      "Continue with restricted-party, product, PGA, license, and filing-readiness checks separately.",
    ],
    href: "/app/shipments",
    actionLabel: "Open Shipments",
    tags: ["embargo", "country", "clear", "hit", "skipped", "error", "screening"],
  },
  {
    id: "compliance-reports-audit",
    moduleId: "compliance",
    question: "Where do I find compliance reports and audit history?",
    answer: "The Reports tab in Compliance brings together screening, license, override, execution, service-usage, and audit views available to your role. Use record-level history when you need the evidence behind one decision.",
    steps: [
      "Open Compliance and choose Reports.",
      "Select the report type, date range, client, status, or other available scope.",
      "Open underlying executions or findings before relying on an aggregate count.",
      "Export only when your permission and data-handling policy allow it.",
    ],
    href: "/app/compliance?tab=reports",
    actionLabel: "Open Compliance Reports",
    tags: ["compliance report", "audit", "history", "execution", "override", "usage", "export"],
  },
  {
    id: "trade-intelligence",
    moduleId: "trade-data",
    question: "How do I use Trade Intelligence?",
    answer: "Trade Intelligence combines HTS benchmarks, broker scorecards, and supplier-risk views. Use it to find patterns and records worth reviewing, not as a replacement for the governed classification, valuation, origin, or screening workflow.",
    steps: [
      "Open Trade Intelligence from Data & Intelligence.",
      "Choose HTS Benchmarks, Broker Scorecard, or Supplier Risk for the question you are investigating.",
      "Use the available filters and compare the metric with its underlying volume and time period.",
      "Open the relevant product, broker work, supplier, or shipment workflow before making a regulated decision.",
    ],
    href: "/app/intelligence",
    actionLabel: "Open Trade Intelligence",
    tags: ["trade intelligence", "benchmark", "broker scorecard", "supplier risk", "accuracy", "override"],
  },
  {
    id: "billing-workspace",
    moduleId: "billing-admin",
    question: "What can I do in the Billing Workspace?",
    answer: "Billing connects operational usage to client charges, internal costs, margin, invoices, exceptions, and reports. Start with exceptions for broken mappings, then use the workspace tabs for clients, rate cards, usage, economics, invoices, and settings.",
    steps: [
      "Open Billing and review the overview for unbilled work, margin, invoice, and exception signals.",
      "Open Exceptions first when a charge is missing, zero-rated, duplicated, or unexpectedly negative-margin.",
      "Use Usage and shipment economics to trace an operational event through its rate rule, cost, and charge.",
      "Generate invoices only after the underlying charges and client scope are correct.",
    ],
    href: "/app/billing",
    actionLabel: "Open Billing",
    tags: ["billing", "overview", "usage", "economics", "cost", "margin", "charge", "workspace"],
    popular: true,
  },
  {
    id: "record-invoice-payment",
    moduleId: "billing-admin",
    question: "How do I record a client invoice payment?",
    answer: "Record payments from the invoice so Qubere can preserve the invoice lifecycle and remaining balance. Partial payments are supported; the payment cannot exceed the outstanding amount.",
    steps: [
      "Open Billing, choose Invoices, and open the sent invoice.",
      "Verify the client, currency, total, existing payments, and outstanding balance.",
      "Record the payment amount, date, method, and reference.",
      "Confirm the invoice moves to Partially Paid or Paid and that the audit history names the actor.",
    ],
    href: "/app/billing/invoices",
    actionLabel: "Open Invoices",
    tags: ["invoice", "payment", "partial", "paid", "balance", "accounts receivable"],
  },
  {
    id: "rate-simulation",
    moduleId: "billing-admin",
    question: "How do I test a rate-card change before activating it?",
    answer: "Rate simulation applies a draft rate-card version to historical usage so you can compare revenue and margin before making the version active. It does not rewrite existing charges.",
    steps: [
      "Open Billing, choose Rate Cards, and open the draft version.",
      "Choose Simulate and set the historical period and available scope.",
      "Compare current and proposed revenue, cost, margin, and exceptions.",
      "Resolve mapping gaps and complete the maker-checker review before activation.",
    ],
    href: "/app/billing/rate-cards",
    actionLabel: "Open Rate Cards",
    tags: ["rate simulation", "rate card", "draft", "historical", "margin", "activate"],
  },
  {
    id: "onboarding-import-review",
    moduleId: "trade-data",
    question: "How do I review an onboarding import or ERP data mapping?",
    answer: "Customer Onboarding stages imported clients, importers, products, parties, and related records for review before activation. Resolve mapping, duplicate, and validation issues in the case instead of silently accepting incomplete source data.",
    steps: [
      "Open Customer Onboarding and select the case or start an authorized import.",
      "Review source columns, proposed mappings, validation results, duplicates, and unresolved relationships.",
      "Correct the mapping or source record and re-run validation.",
      "Activate only when the case summary and reviewer checks show the intended records are ready.",
    ],
    href: "/app/onboarding",
    actionLabel: "Open Customer Onboarding",
    tags: ["onboarding", "import", "erp", "mapping", "duplicate", "validation", "activate"],
  },
  {
    id: "admin-audit-governance",
    moduleId: "billing-admin",
    question: "How do administrators review governance and audit activity?",
    answer: "Manage Account exposes account profile, members, roles, settings, integrations, and audit history according to permission. Platform-wide configuration remains separate and is visible only to platform administrators.",
    steps: [
      "Open the profile menu and choose Manage Account.",
      "Choose the account, user, role, setting, integration, or audit area you need to review.",
      "Filter history by actor, action, record, and date where available, then open the underlying record.",
      "Make changes with the least privilege required and confirm the resulting audit entry.",
    ],
    href: "/app/admin",
    actionLabel: "Manage Account",
    tags: ["admin", "audit", "governance", "account", "role", "history", "platform admin"],
  },
  {
    id: "trade-data-hub",
    moduleId: "trade-data",
    question: "Where should I start when maintaining product and party data?",
    answer: "Trade Data is the front door to the Product and Party masters. Start there when you need to search, import, create, or review reusable commercial and identity data before it enters a shipment or compliance workflow.",
    steps: [
      "Open Trade Data and choose Products or Parties.",
      "Search for an existing record before creating one to avoid duplicates.",
      "Review evidence and change history before editing a governed or reused field.",
      "Return to the shipment, classification, origin, or compliance workflow that needs the data.",
    ],
    href: "/app/trade-data",
    actionLabel: "Open Trade Data",
    tags: ["trade data", "product", "party", "master data", "search", "duplicate"],
  },
  {
    id: "importer-record",
    moduleId: "trade-data",
    question: "How do I maintain an importer-of-record profile?",
    answer: "The importer profile holds the legal entity details and relationships used by shipment, bond, POA, filing, and billing workflows. Keep legal identifiers and addresses distinct from the brokerage client record.",
    steps: [
      "Open Importers of Record and search by legal name or identifier.",
      "Create or open the profile and verify its client relationship, identifiers, addresses, and contacts.",
      "Review active bonds and powers of attorney before using the importer in filing work.",
      "Save the change and confirm it appears on the intended shipment or onboarding case.",
    ],
    href: "/app/importers-of-record",
    actionLabel: "Open Importers of Record",
    tags: ["importer of record", "ior", "legal entity", "identifier", "address", "client"],
  },
  {
    id: "power-of-attorney",
    moduleId: "trade-data",
    question: "How do I review a power of attorney?",
    answer: "Use Powers of Attorney to confirm that the brokerage has current authority for the importer and covered activities. A stored POA still needs the correct entity, dates, scope, and supporting document.",
    steps: [
      "Open Powers of Attorney and find the importer or client.",
      "Verify the legal names, grantor and grantee, effective dates, status, scope, and attached document.",
      "Correct or replace an expired, revoked, mismatched, or incomplete authority record according to your process.",
      "Return to the shipment or filing and verify the authority check reflects the current record.",
    ],
    href: "/app/poa",
    actionLabel: "Open Powers of Attorney",
    tags: ["poa", "power of attorney", "authority", "importer", "grantor", "grantee", "expiry"],
  },
];

type GeneratedProductHelp = {
  version: number;
  sourceCommit: string | null;
  articles: SupportArticle[];
  archivedArticleIds: string[];
};

const generated = generatedProductHelp as GeneratedProductHelp;
export function mergeSupportArticles(
  baseArticles: SupportArticle[],
  generatedArticles: SupportArticle[],
  archivedIds: string[]
): SupportArticle[] {
  const archivedArticleIds = new Set(archivedIds);
  const articlesById = new Map<string, SupportArticle>();
  for (const article of baseArticles) {
    if (!archivedArticleIds.has(article.id)) articlesById.set(article.id, article);
  }
  for (const article of generatedArticles) {
    if (!archivedArticleIds.has(article.id)) articlesById.set(article.id, article);
  }
  return [...articlesById.values()];
}

/**
 * The reviewed product-help corpus. Hand-authored guides remain the baseline;
 * release-generated guides form a reviewable overlay keyed by stable article
 * id. An automated draft reaches this array only after its documentation PR is
 * approved and merged.
 */
export const SUPPORT_ARTICLES: SupportArticle[] = mergeSupportArticles(
  BASE_SUPPORT_ARTICLES,
  generated.articles,
  generated.archivedArticleIds
);

export function getSupportModule(moduleId: SupportModuleId): SupportModule {
  return SUPPORT_MODULES.find((supportModule) => supportModule.id === moduleId) ?? SUPPORT_MODULES[0];
}

function normalizeSearch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function articleScore(article: SupportArticle, tokens: string[]): number {
  const question = normalizeSearch(article.question);
  const answer = normalizeSearch(article.answer);
  const steps = normalizeSearch(article.steps.join(" "));
  const tags = normalizeSearch(article.tags.join(" "));
  const moduleName = normalizeSearch(getSupportModule(article.moduleId).name);

  return tokens.reduce((score, token) => {
    if (question.includes(token)) return score + 8;
    if (tags.includes(token)) return score + 5;
    if (moduleName.includes(token)) return score + 3;
    if (answer.includes(token)) return score + 2;
    if (steps.includes(token)) return score + 1;
    return score;
  }, 0);
}

export function searchSupportArticleList(
  articles: SupportArticle[],
  query: string,
  moduleId: SupportModuleId | "all" = "all"
): SupportArticle[] {
  const normalizedQuery = normalizeSearch(query);
  const tokens = normalizedQuery ? normalizedQuery.split(/\s+/).filter(Boolean) : [];

  return articles.filter((article) => moduleId === "all" || article.moduleId === moduleId)
    .filter((article) => {
      if (tokens.length === 0) return true;
      const haystack = normalizeSearch(
        [
          article.question,
          article.answer,
          article.steps.join(" "),
          article.tags.join(" "),
          getSupportModule(article.moduleId).name,
        ].join(" ")
      );
      return tokens.every((token) => haystack.includes(token));
    })
    .sort((a, b) => {
      if (tokens.length > 0) return articleScore(b, tokens) - articleScore(a, tokens);
      if (a.popular !== b.popular) return a.popular ? -1 : 1;
      return a.question.localeCompare(b.question);
    });
}

export function searchSupportArticles(
  query: string,
  moduleId: SupportModuleId | "all" = "all"
): SupportArticle[] {
  return searchSupportArticleList(SUPPORT_ARTICLES, query, moduleId);
}
