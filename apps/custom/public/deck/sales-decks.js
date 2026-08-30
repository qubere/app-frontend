(function () {
  "use strict";

  var S = "/deck/screenshots/";

  window.QUBERE_SALES_DECKS = {
    customs: {
      name: "Customs",
      icon: "▣",
      promise: "Move an entry from shipment intake to filing readiness in one connected workspace.",
      audience: "Customs brokers · import operations",
      features: [
        {
          title: "Shipment Workbench",
          pain: "Entry writers lose time reconstructing a shipment across email, shared drives, and disconnected filing screens.",
          benefit: "Qubere brings documents, parties, line items, exceptions, agent progress, tracking, and readiness into one shipment record.",
          demo: "Operations → Shipments → open a shipment → move through Overview, Documents, Line Items, Compliance, Filing, and Audit.",
          screen: ["Shipment Workbench", "One record from intake through entry readiness", ["Readiness|87%|blue", "Documents|6 / 6|green", "Open blockers|2|amber"], ["Object", "Status", "Next action"], [["Commercial invoice", "Extracted", "Review values"], ["Packing list", "Matched", "None"], ["Entry summary", "Draft", "Resolve 2 blockers"]]],
          screenshot: S + "shipment-workbench.png"
        },
        {
          title: "Filing Readiness",
          pain: "Teams discover missing data late—after someone has already started an entry or attempted submission.",
          benefit: "A dependency-aware readiness gate shows what is missing, why it matters, and which action unlocks filing.",
          demo: "Open a shipment → Pre-filing readiness → click a blocker → complete the linked action → show the score update.",
          screen: ["Pre-filing Readiness", "Dependencies are visible before submission", ["Overall|87%|blue", "Critical blockers|1|amber", "Checks passed|13|green"], ["Requirement", "Evidence", "Result"], [["Importer & bond", "IOR-10028 / continuous", "Passed"], ["HTS classification", "2 lines reviewed", "Passed"], ["Reasonable care audit", "Origin evidence missing", "Blocked"]]]
        },
        {
          title: "Dynamic Entry Workspace",
          pain: "Rigid forms make new countries, procedures, and PGA requirements slow and expensive to support.",
          benefit: "Schema-driven filing screens render the correct sections, validations, and line-item structures for the destination and procedure.",
          demo: "Customs Filing → New filing → select shipment and procedure → show dynamic tabs, validations, auto-save, and line items.",
          screen: ["Entry Workspace", "Destination-aware fields and validation", ["Sections|12|blue", "Fields hydrated|94%|green", "Errors|3|amber"], ["Section", "Completion", "Source"], [["Header & references", "Complete", "Shipment"], ["Parties", "Complete", "Party Master"], ["Line items", "3 warnings", "Documents + AI"]]],
          screenshot: S + "customs-filing.png"
        },
        {
          title: "ABI / ACE Messaging",
          pain: "Submission responses are scattered across a separate ABI tool, making rejects and follow-up hard to coordinate.",
          benefit: "Qubere centralizes outbound filing messages, CBP acknowledgements, rejects, holds, and the work they create.",
          demo: "Customs Filing → open an entry → Messages → show outbound batch, response timeline, reject details, and resulting action.",
          screen: ["Filing Messages", "Outbound and inbound messages stay attached to the entry", ["Messages|8|blue", "Accepted|6|green", "Needs action|2|amber"], ["Time", "Message", "Outcome"], [["10:14", "Entry summary create", "Accepted"], ["10:15", "Cargo release response", "Hold"], ["10:16", "Error dictionary match", "Owner assigned"]]]
        },
        {
          title: "Post-Entry Management",
          pain: "PSC, protest, drawback, and reconciliation deadlines sit in spreadsheets until a statutory clock is missed.",
          benefit: "One post-entry hub tracks eligible recovery work, case status, evidence, owners, and deadlines.",
          demo: "Operations → Post Entry → open PSC or Protest → show deadline rail, linked filing, evidence, workflow state, and audit.",
          screen: ["Post-Entry Management", "Every recovery workflow and statutory clock in one place", ["Open cases|18|blue", "Due this month|5|amber", "Potential recovery|$284K|green"], ["Case", "Type", "Deadline"], [["PSC-2026-104", "PSC", "Sep 18"], ["PRO-2026-022", "Protest", "Oct 02"], ["REC-2026-008", "Reconciliation", "Dec 15"]]],
          screenshot: S + "post-entry-hub.png"
        }
      ]
    },

    compliance: {
      name: "Compliance",
      icon: "✓",
      promise: "Turn screening from a filing-time checkbox into continuous, defensible risk control.",
      audience: "Compliance leaders · brokers · importers",
      features: [
        {
          title: "Restricted Party Screening",
          pain: "Name-only searches create false positives, inconsistent review, and weak evidence for why a party was cleared.",
          benefit: "Multi-source candidate generation, normalization, phonetic matching, scoring, and reviewer outcomes create a defensible decision record.",
          demo: "Compliance → Screen → enter a party and country → run screening → expand candidate reasoning → record the outcome.",
          screen: ["Restricted Party Screening", "Explainable candidates, not a black-box score", ["Candidates|7|blue", "High risk|1|amber", "Cleared|6|green"], ["Candidate", "Score", "Reason"], [["Acme Export GmbH", "92", "Name + address"], ["ACM Exports", "68", "Phonetic name"], ["Acme Global Ltd", "41", "Weak token match"]]]
        },
        {
          title: "Continuous Party Monitoring",
          pain: "A party cleared at onboarding can become restricted weeks later, while active shipments continue moving.",
          benefit: "Qubere re-screens the party population against reference-data changes and creates focused review work only for impacted records.",
          demo: "Compliance → Monitoring → show last run, reference changes, impacted parties, and the resulting review queue.",
          screen: ["Continuous Party Monitoring", "Changes are checked against the full population", ["Monitored|18,420|blue", "Changed lists|3|amber", "Impacted parties|12|amber"], ["Party", "Change source", "Action"], [["Northstar Metals", "BIS CSL delta", "Review"], ["Arctic Components", "OFAC update", "Hold"], ["Solis Trading", "Dow Jones delta", "Re-screen"]]],
          screenshot: S + "compliance-monitor.png"
        },
        {
          title: "Community Screening",
          pain: "Bulk screening programs depend on brittle spreadsheets and manual collation of thousands of outcomes.",
          benefit: "Upload CSV, XLSX, or JSON populations, validate columns, screen at scale, review exceptions, and export a single run record.",
          demo: "Compliance → Community Screening → upload a sample → map columns → run → open the run → export results.",
          screen: ["Community Screening Run", "Bulk populations with run-level traceability", ["Rows|5,000|blue", "Clear|4,962|green", "Review|38|amber"], ["Batch", "Progress", "Outcome"], [["Suppliers — Aug", "100%", "31 review"], ["Customers — Aug", "100%", "7 review"], ["Ad hoc acquisition", "64%", "Running"]]]
        },
        {
          title: "Trade-Risk Controls",
          pain: "Embargo, end-use, end-user, military-use, anti-boycott, and forced-labor checks live in separate procedures.",
          benefit: "Specialized agents apply account policies and reference data as a coordinated compliance layer on every shipment.",
          demo: "Open shipment → Compliance → expand each check → show evidence, policy version, result, and linked exception.",
          screen: ["Shipment Compliance", "Specialized controls share one decision envelope", ["Controls|8|blue", "Passed|6|green", "Review|2|amber"], ["Control", "Result", "Evidence"], [["Country embargo", "Passed", "Route + policy v14"], ["Forced labor", "Review", "Entity proximity"], ["Military end use", "Passed", "Goods + end user"]]]
        },
        {
          title: "Audit, Overrides & Notifications",
          pain: "Overrides are often buried in email, and alerts either expose sensitive details or arrive without enough context.",
          benefit: "Formal overrides, immutable execution history, secure review links, recipient policies, and notification settings preserve control.",
          demo: "Compliance → Audit & History → open an execution → show policy version and evidence → open override and notification history.",
          screen: ["Compliance Audit & History", "Every decision can be reconstructed", ["Executions|1,284|blue", "Overrides|9|amber", "Notifications sent|46|green"], ["Event", "Actor", "Evidence"], [["RPS completed", "Qubere agent", "Policy v21"], ["Formal override", "A. Chen", "Reason + expiry"], ["Review notification", "System", "Secure link"]]]
        }
      ]
    },

    security: {
      name: "Security",
      icon: "◆",
      promise: "Protect tenant data and sensitive trade actions without slowing operators down.",
      audience: "Security · IT · compliance buyers",
      features: [
        {
          title: "Granular Role-Based Access",
          pain: "Broad admin/member roles let too many people approve, file, export, or change high-risk settings.",
          benefit: "Atomic permissions and configurable roles separate operators, reviewers, approvers, billing, and administrators.",
          demo: "Manage Account → Roles & Permissions → open a role → filter by domain → show explicit permissions and category grants.",
          screen: ["Roles & Permissions", "Least privilege across operational domains", ["Roles|9|blue", "Permissions|180+|blue", "Custom roles|3|green"], ["Role", "Scope", "Sensitive actions"], [["Entry Writer", "Customs", "Draft only"], ["Reviewer", "Compliance", "Override + approve"], ["Billing Checker", "Billing", "Approve invoices"]]]
        },
        {
          title: "Tenant Isolation",
          pain: "Multi-client brokerage systems become unacceptable if one account can see another account's parties, documents, or filings.",
          benefit: "Account-scoped queries, tenant-owned evidence, and fail-closed service checks keep data boundaries explicit throughout the stack.",
          demo: "Show account switcher → open the same module in two accounts → demonstrate separate data and unavailable cross-account IDs.",
          screen: ["Account Data Boundary", "Every operational query is scoped to the active account", ["Accounts|12|blue", "Cross-tenant reads|0|green", "Guarded domains|All|green"], ["Domain", "Boundary", "Behavior"], [["Documents", "accountId", "Not found cross-account"], ["Shipments", "accountId", "Fail closed"], ["AI evidence", "account + object", "Re-resolved server-side"]]]
        },
        {
          title: "Immutable Audit Trails",
          pain: "When regulators or customers ask who changed what, teams reconstruct the answer from inboxes and database timestamps.",
          benefit: "Administrative, compliance, filing, billing, and AI actions record actor, effective actor, time, source, and bounded metadata.",
          demo: "Manage Account → Settings & Audit → search an action → open details → connect it to the underlying record.",
          screen: ["Settings & Audit", "Administrative changes stay attributable", ["Events|8,412|blue", "Actors|34|blue", "Unattributed|0|green"], ["Time", "Action", "Actor"], [["14:06", "ROLE_UPDATED", "M. Rivera"], ["13:42", "INTEGRATION_CHANGED", "S. Patel"], ["11:18", "RATE_CARD_ACTIVATED", "J. Wu"]]]
        },
        {
          title: "Secure Document Intake",
          pain: "Inbound email and uploads can introduce malware, spoofed senders, duplicate files, and documents routed to the wrong client.",
          benefit: "Authorized-sender routing, quarantine, malware policy, duplicate detection, and controlled release protect the document pipeline.",
          demo: "Docs → Quarantine → open an unknown-sender email → inspect attachments → release, discard, or block sender → show audit.",
          screen: ["Inbound Quarantine", "Unknown or risky content stops before processing", ["Quarantined|7|amber", "Malware blocked|1|amber", "Released today|12|green"], ["Sender", "Reason", "Decision"], [["unknown@vendor.co", "Sender not authorized", "Review"], ["docs@newclient.com", "No account route", "Attach"], ["billing@spoof.tld", "Malware policy", "Blocked"]]]
        },
        {
          title: "API & Integration Controls",
          pain: "Integration credentials and API access sprawl without a tenant-specific control plane.",
          benefit: "Per-account integration configuration, encrypted credentials, API key controls, and audit history reduce shared-secret risk.",
          demo: "Manage Account → Settings → Integrations & APIs → show enabled connectors, credential state, scopes, and audit.",
          screen: ["Integrations & APIs", "Tenant-specific connectivity with controlled scope", ["Connected|6|green", "Keys active|4|blue", "Attention|1|amber"], ["Integration", "Scope", "Status"], [["Google Cloud Storage", "Documents", "Connected"], ["ABI provider", "Filing", "Connected"], ["ERP webhook", "Read events", "Rotate key"]]]
        }
      ]
    },

    partner: {
      name: "Partner Portal",
      icon: "↗",
      promise: "Collect clean inputs from clients and partners without turning every request into an email chase.",
      audience: "Brokerage customers · partners · operations",
      features: [
        {
          title: "Secure Document Requests",
          pain: "Clients send documents to individual inboxes, omit shipment references, and ask whether files were received.",
          benefit: "Tokenized upload links let an external partner submit documents directly into the correct controlled workflow.",
          demo: "Create or open a request → copy secure upload link → open in a private window → upload a sample → show it arrive in Docs.",
          screen: ["Secure Document Request", "The partner sees only the request they were given", ["Requested|4|blue", "Received|3|green", "Missing|1|amber"], ["Document", "Requested from", "Status"], [["Commercial invoice", "Acme Imports", "Received"], ["Packing list", "Acme Imports", "Received"], ["Certificate of origin", "Supplier", "Missing"]]]
        },
        {
          title: "Questions & Missing Information",
          availability: "Partial — controlled requests",
          pain: "Entry writers ask follow-up questions in email threads that are disconnected from the shipment and hard to audit.",
          benefit: "Structured requests tie the question, response, evidence, and responsible partner to the underlying shipment.",
          demo: "Open shipment → Documents / Actions → create a controlled document request → show the secure upload response → explain that structured free-text answers remain partial.",
          screen: ["Partner Questions", "Responses return to the shipment context", ["Open questions|6|amber", "Answered today|14|green", "Average response|3.2h|blue"], ["Question", "Partner", "Status"], [["Confirm assists", "Importer", "Answered"], ["Provide MID", "Supplier", "Waiting"], ["Confirm incoterm", "Forwarder", "Answered"]]]
        },
        {
          title: "Status Visibility",
          availability: "Roadmap — do not demo as live",
          pain: "Clients repeatedly ask whether documents were received, the entry was filed, or a hold is blocking release.",
          benefit: "A controlled external status view reduces calls while keeping internal notes and sensitive compliance reasoning private.",
          demo: "Use this product-faithful slide only → explain the planned external milestone view → do not navigate to or claim a live status portal.",
          screen: ["Shipment Status", "External milestones without exposing internal work", ["Milestone|Customs review|blue", "Documents|Complete|green", "Next update|Today|blue"], ["Milestone", "Status", "Updated"], [["Documents received", "Complete", "Aug 29"], ["Customs review", "In progress", "Aug 29"], ["Filed with CBP", "Pending", "—"]]]
        },
        {
          title: "Invitation & Workspace Access",
          pain: "Onboarding users through one-off admin work leads to wrong roles, stale access, and confusing first sessions.",
          benefit: "Email-bound invitations connect the intended user to the intended account and role before access is accepted.",
          demo: "Manage Account → Users → invite user with role → open invitation state → explain email-match protection and acceptance.",
          screen: ["Workspace Invitations", "Invite the right person into the right role", ["Pending|4|amber", "Accepted|28|green", "Expired|2|amber"], ["Invitee", "Role", "Status"], [["ops@acme.com", "Client Operator", "Pending"], ["trade@northstar.com", "Viewer", "Accepted"], ["docs@solis.co", "Uploader", "Expired"]]]
        }
      ]
    },

    ai: {
      name: "AI & Agents",
      icon: "✦",
      promise: "Use AI to do the repetitive trade work while keeping evidence, confidence, and human control visible.",
      audience: "Operations · product · technology buyers",
      features: [
        {
          title: "Ask Qubere",
          pain: "Operational answers require jumping across shipments, documents, exceptions, tariffs, and audit records.",
          benefit: "A permission-aware assistant retrieves grounded account data, cites the records it used, and navigates users to action.",
          demo: "Ask Qubere → ask what is blocking a shipment → expand sources → follow a suggested navigation action.",
          screen: ["Ask Qubere", "Grounded answers across the active account", ["Sources used|7|blue", "Open blockers|2|amber", "Suggested actions|3|green"], ["Finding", "Evidence", "Action"], [["Origin evidence missing", "Invoice line 3", "Open document"], ["Party review pending", "RPS run 842", "Open finding"], ["Entry otherwise ready", "Readiness 87%", "Open filing"]]],
          screenshot: S + "ask-qubere-chat.png"
        },
        {
          title: "Document Intelligence",
          pain: "Teams re-key the same invoice, packing-list, and transport data into multiple systems.",
          benefit: "Qubere classifies, parses, chunks, extracts, and quality-checks trade documents before proposing field-level facts.",
          demo: "Docs → open processed document → show classification, extracted fields, confidence, evidence location, and review state.",
          screen: ["Document Intelligence", "Every extracted value stays tied to evidence", ["Fields found|86|blue", "Auto-verified|73|green", "Review|13|amber"], ["Field", "Value", "Confidence"], [["Invoice total", "$48,230.00", "99%"], ["Incoterm", "FOB", "97%"], ["Country of origin", "Vietnam", "82%"]]],
          screenshot: S + "trade-documents.png"
        },
        {
          title: "Universal Field Hydration",
          pain: "Hand-maintained key mappings break whenever a new document field or destination schema appears.",
          benefit: "A candidate-and-evidence engine maps extracted facts to canonical and filing fields, validates them, and records lineage.",
          demo: "Open shipment → Canonical Facts → select a hydrated field → show source extraction, mapping decision, confidence, and corrections.",
          screen: ["Canonical Facts", "Facts hydrate once and flow to every authorized consumer", ["Hydrated|94%|green", "Evidence-linked|100%|green", "Conflicts|4|amber"], ["Target field", "Source", "Decision"], [["consignee.name", "Invoice consignee", "Accepted"], ["lineItems[0].value", "Invoice line 1", "Accepted"], ["origin.country", "Invoice + COO", "Review conflict"]]]
        },
        {
          title: "Agentic Shipment Pipeline",
          pain: "Automation scripts run as isolated black boxes, leaving operators unsure what ran, what failed, and what is next.",
          benefit: "An orchestrated sequence coordinates intake, document, product, classification, origin, compliance, readiness, and filing agents.",
          demo: "Open shipment → pipeline ribbon / agent timeline → expand an invocation → show inputs, outputs, status, duration, and next dependency.",
          screen: ["Agent Execution Timeline", "A visible chain of specialized work", ["Agents|8|blue", "Complete|6|green", "Waiting|2|amber"], ["Agent", "Status", "Output"], [["Document intelligence", "Complete", "86 fields"], ["HTS classification", "Complete", "2 codes"], ["Filing readiness", "Waiting", "Origin review"]]]
        },
        {
          title: "Explainable Classification",
          pain: "A bare HTS code gives reviewers no confidence and creates weak reasonable-care evidence.",
          benefit: "Classification cases combine candidates, GRI reasoning, supporting evidence, confidence, and explicit human decisions.",
          demo: "Trade Data → Products → open product → Classification Case → compare candidates → accept or override with reason.",
          screen: ["Classification Case", "Candidates, rationale, and human decision in one record", ["Top confidence|93%|green", "Candidates|5|blue", "Evidence|8|blue"], ["HTS candidate", "Confidence", "Reason"], [["8471.30.0100", "93%", "Portable processing unit"], ["8471.41.0150", "68%", "Includes display"], ["8543.70.9860", "31%", "Residual electrical"]]]
        }
      ]
    },

    documents: {
      name: "Document Management",
      icon: "▤",
      promise: "Turn every inbound trade document into trusted, linked, searchable operational data.",
      audience: "Document operations · brokers · shared services",
      features: [
        {
          title: "Multi-Channel Intake",
          pain: "Files arrive through email, upload, portal, API, and shared drives with inconsistent naming and context.",
          benefit: "Qubere normalizes every intake channel into one tenant-scoped document record with source and processing history.",
          demo: "Docs → upload a document or show inbound email → open the resulting record → show source, timestamps, and processing run.",
          screen: ["Trade Documents", "One queue for every intake channel", ["Received today|148|blue", "Processing|11|amber", "Ready|132|green"], ["Document", "Source", "Status"], [["INV-88214.pdf", "Inbound email", "Ready"], ["PackingList.xlsx", "Portal upload", "Ready"], ["BOL-1209.pdf", "API", "Processing"]]],
          screenshot: S + "trade-documents.png"
        },
        {
          title: "Classification & Extraction",
          pain: "Operators must open every attachment just to determine its type and what data it contains.",
          benefit: "Document type classification and field extraction convert files into evidence-backed facts for downstream work.",
          demo: "Open a processed document → show detected type → extracted fields → confidence → page/region evidence.",
          screen: ["Document Review", "Detected structure, fields, and evidence", ["Type confidence|98%|green", "Fields|64|blue", "Needs review|7|amber"], ["Field", "Extracted value", "Evidence"], [["Invoice number", "INV-88214", "Page 1"], ["Supplier", "Solis Components", "Page 1"], ["Net weight", "1,184 kg", "Page 2"]]]
        },
        {
          title: "Shipment Linking & Missing Docs",
          pain: "Documents exist, but staff still spend time asking which shipment they belong to and what is absent.",
          benefit: "Automatic matching proposes shipment links, while required-document checks expose gaps before filing.",
          demo: "Docs → filter Unattached → attach one document → open shipment → show missing-document state update.",
          screen: ["Document Matching", "Attach evidence to the right shipment", ["Unattached|9|amber", "Auto-matched|116|green", "Missing docs|14|amber"], ["Document", "Suggested shipment", "Confidence"], [["INV-88214.pdf", "SHP-2026-0842", "97%"], ["COO-4201.pdf", "SHP-2026-0839", "82%"], ["Unknown.pdf", "No match", "—"]]]
        },
        {
          title: "Field Review & Corrections",
          pain: "Silent extraction errors can propagate into classification, valuation, compliance, and filing.",
          benefit: "Reviewers see low-confidence or conflicting fields, correct them in context, and preserve both original evidence and final decision.",
          demo: "Open document → Review fields → correct a value → save → show audit and downstream canonical fact.",
          screen: ["Field Review", "Humans focus only on uncertain or conflicting facts", ["Review queue|13|amber", "High confidence|73|green", "Corrected|4|blue"], ["Field", "Proposed", "Decision"], [["Country of origin", "VN", "Accept"], ["Freight amount", "$1,200", "Correct"], ["Manufacturer", "Solis Co.", "Resolve conflict"]]]
        },
        {
          title: "Quarantine, Duplicates & Vault",
          pain: "Unknown senders, repeated attachments, and risky files pollute the queue and weaken record control.",
          benefit: "Quarantine review, content hashing, malware status, retention, and a searchable vault protect the source record.",
          demo: "Docs → Quarantine → release or discard → open Vault → search by filename, party, or shipment → show duplicate signal.",
          screen: ["Document Vault", "Trusted source files with lifecycle history", ["Stored|48,219|blue", "Duplicates|286|amber", "Quarantined|7|amber"], ["File", "Linked object", "Integrity"], [["INV-88214.pdf", "SHP-2026-0842", "Verified"], ["COO-4201.pdf", "SHP-2026-0839", "Verified"], ["invoice-copy.pdf", "Duplicate of INV-88214", "Flagged"]]]
        }
      ]
    },

    billing: {
      name: "Billing",
      icon: "$",
      promise: "Convert operational work into explainable charges, protected margin, and controlled invoices.",
      audience: "Broker owners · finance · billing operations",
      features: [
        {
          title: "Versioned Rate Cards",
          pain: "Rates live in conflicting spreadsheets, and nobody can prove which version applied to a shipment.",
          benefit: "Importable, versioned rate cards have draft, active, expired, and retired lifecycles with auditable rule detail.",
          demo: "Billing → Rate Cards → import sample CSV → map events → open version history → activate the draft.",
          screen: ["Rate Cards", "Govern pricing without losing spreadsheet onboarding", ["Active|18|green", "Draft|4|blue", "Expiring soon|3|amber"], ["Client", "Version", "Status"], [["Acme Manufacturing", "v2", "Draft"], ["Northstar Retail", "v4", "Active"], ["Solis Imports", "v1", "Expiring"]]]
        },
        {
          title: "Usage-to-Charge Automation",
          pain: "Completed work never reaches billing because operations and finance rely on memory and manual entry.",
          benefit: "Operational events emit idempotent usage records that rate automatically into explainable shipment charges.",
          demo: "Billing → Usage Ledger → open an event → trace event → rule → calculation → charge.",
          screen: ["Usage Ledger", "Real work becomes billable without re-keying", ["Events today|482|blue", "Rated|471|green", "Exceptions|11|amber"], ["Event", "Rate rule", "Charge"], [["ENTRY_PROCESSING", "Base entry fee", "$125.00"], ["ADDL_LINES × 6", "$4 per line", "$24.00"], ["HTS_REVIEW", "Human review", "$20.00"]]]
        },
        {
          title: "Shipment Economics",
          pain: "Duty and pass-throughs are mixed with broker revenue, hiding what the brokerage actually earned.",
          benefit: "A three-layer shipment ledger separates customs economics, broker revenue/cost, and client receivables.",
          demo: "Billing → Shipments → open a shipment → show customs, broker, and AR sections → drill into a charge.",
          screen: ["Shipment Economics", "Every dollar stays in its correct economic layer", ["Customer charge|$654|blue", "Broker cost|$248|amber", "Margin|$406|green"], ["Layer", "Amount", "Meaning"], [["Customs economics", "$8,422", "Duty / MPF / HMF"], ["Broker economics", "$406", "Gross margin"], ["Accounts receivable", "$654", "Client balance"]]]
        },
        {
          title: "Exceptions & Revenue Leakage",
          pain: "Unmapped rates, unbilled work, and negative-margin files are discovered long after the invoice cycle.",
          benefit: "Billing exceptions identify leakage as it happens and provide resolve/waive actions with reasons and audit.",
          demo: "Billing → Exceptions & Leakage → filter Open → open a negative-margin item → resolve or waive → show audit.",
          screen: ["Exceptions & Leakage", "Find lost revenue before the invoice goes out", ["Open|11|amber", "At risk|$7,840|amber", "Recovered MTD|$18,240|green"], ["Exception", "Exposure", "Action"], [["Unmapped HTS review", "$320", "Map rate"], ["Negative-margin shipment", "$1,420", "Review pricing"], ["Unbilled filing event", "$125", "Create charge"]]]
        },
        {
          title: "Invoices, Approval & AR",
          pain: "Invoice creation, approval, and payment tracking happen outside the operational evidence that created the charge.",
          benefit: "Qubere builds invoices from eligible charges, enforces maker-checker permissions, exports artifacts, and records payments.",
          demo: "Billing → Invoices → create from unbilled charges → submit for approval → show distinct approver permission → record payment.",
          screen: ["Invoices & AR", "Controlled invoice lifecycle tied to real work", ["Draft|6|blue", "Pending approval|3|amber", "Outstanding|$142K|amber"], ["Invoice", "Client", "Status"], [["INV-202608-6314", "Acme", "Pending approval"], ["INV-202608-6288", "Northstar", "Sent"], ["INV-202608-6201", "Solis", "Partially paid"]]]
        },
        {
          title: "Rate Simulation & Reporting",
          pain: "Rate renewal and profitability analysis require days of spreadsheet reconstruction.",
          benefit: "Simulate proposed pricing against historical usage and compare revenue, margin, and service-level deltas without touching production charges.",
          demo: "Rate Cards → open draft → Simulate → select historical period → run → compare current and proposed results.",
          screen: ["Rate Card Simulation", "Test a commercial decision before changing pricing", ["Proposed revenue|$670.5K|blue", "Delta|+2.5%|green", "Events matched|14,208|green"], ["Service", "Current", "Proposed"], [["Entry processing", "$500K", "$500K"], ["Additional lines", "$44K", "$60.5K"], ["Manual review", "$110K", "$110K"]]]
        }
      ]
    },

    work: {
      name: "Work Management",
      icon: "☰",
      promise: "Give every operator a prioritized queue with a clear owner, deadline, context, and next action.",
      audience: "Operations leaders · entry teams · reviewers",
      features: [
        {
          title: "Unified Action Inbox",
          pain: "Work is spread across email, shipment notes, filing rejects, compliance findings, and billing exceptions.",
          benefit: "One inbox normalizes operational work from every Qubere domain and links each item to the record where it can be resolved.",
          demo: "Operations → Actions → scan queue → open one item → show the underlying shipment/document/finding and action controls.",
          screen: ["Action Inbox", "Every exception becomes actionable work", ["Due today|18|amber", "Critical|4|amber", "Unassigned|7|blue"], ["Action", "Owner", "Due"], [["Review origin conflict", "M. Rivera", "Today"], ["Attach commercial invoice", "Unassigned", "Today"], ["Resolve party match", "A. Chen", "2h"]]],
          screenshot: S + "actions-queue.png"
        },
        {
          title: "Ownership, Priority & Queues",
          pain: "Managers cannot see who owns an issue or whether the right person is working the highest-risk file.",
          benefit: "Assignment, priority, queue filters, sorting, and role-aware views make workload explicit and transferable.",
          demo: "Actions → filter by owner and priority → assign an unowned item → sort by due time → switch to another queue.",
          screen: ["Team Queue", "Workload is visible before it becomes a bottleneck", ["Assigned|42|blue", "Unassigned|7|amber", "Over capacity|2|amber"], ["Owner", "Open", "Critical"], [["M. Rivera", "14", "2"], ["A. Chen", "11", "1"], ["Unassigned", "7", "1"]]]
        },
        {
          title: "SLA & Deadline Control",
          pain: "Statutory and client deadlines are tracked manually, so urgency depends on who remembers the date.",
          benefit: "Due times, breach states, deadline rails, and escalation context keep filing, post-entry, and customer commitments visible.",
          demo: "Actions → Due today → open a deadline item → show SLA clock and linked statutory date → reassign or escalate.",
          screen: ["Deadlines", "Urgency is calculated, not remembered", ["Breached|3|amber", "Due < 4h|9|amber", "On track|48|green"], ["Work item", "Clock", "State"], [["Resolve CBP reject", "00:42", "At risk"], ["File PSC", "3 days", "On track"], ["Answer client request", "-00:18", "Breached"]]]
        },
        {
          title: "Exception Resolution",
          pain: "Teams fix problems but fail to capture the reason, evidence, or pattern that caused them.",
          benefit: "Structured resolution reasons, notes, evidence, and outcome transitions turn one-off fixes into audit and analytics data.",
          demo: "Open an exception → choose resolution reason → add evidence → resolve → show the activity timeline.",
          screen: ["Resolve Exception", "Capture why the decision was made", ["Open|27|amber", "Resolved today|18|green", "Reopened|2|amber"], ["Exception", "Resolution", "Outcome"], [["Origin conflict", "COO supersedes invoice", "Resolved"], ["Missing MID", "Supplier provided MID", "Resolved"], ["Low HTS confidence", "Escalated to reviewer", "In review"]]]
        },
        {
          title: "Manager Command Center",
          pain: "Leaders learn about backlog, blockers, and team capacity after service levels have already slipped.",
          benefit: "Command-center metrics connect queue health, shipment readiness, compliance, and deadlines to the underlying work.",
          demo: "Operations → Command Center → click a KPI → show filtered actions → drill to the affected shipment.",
          screen: ["Command Center", "Operational metrics lead directly to action", ["Shipments at risk|12|amber", "Actions due today|18|amber", "Ready to file|34|green"], ["Signal", "Trend", "Drill-down"], [["Unassigned actions", "+3", "Open queue"], ["Readiness blockers", "-8%", "Open shipments"], ["Compliance review", "+4", "Open findings"]]],
          screenshot: S + "command-center.png"
        }
      ]
    },

    multileg: {
      name: "Multi-Leg Shipments",
      icon: "⇢",
      promise: "Keep master/house relationships, transport legs, tracking events, and customs context connected.",
      audience: "Forwarders · brokers · multimodal operations",
      features: [
        {
          title: "Master / House Relationships",
          pain: "Consolidations create separate master and house records that drift apart across operations and customs.",
          benefit: "Qubere links house shipments to the correct master while preserving tenant validation and each house's own customs work.",
          demo: "Create shipment → select master shipment → open master → show house relationships → open one house record.",
          screen: ["Master Shipment", "One consolidation with distinct house-level customs context", ["House shipments|8|blue", "Ready|6|green", "Blocked|2|amber"], ["House", "Importer", "Readiness"], [["HBL-88219", "Acme Imports", "92%"], ["HBL-88220", "Northstar", "78%"], ["HBL-88221", "Solis Retail", "100%"]]]
        },
        {
          title: "Sequenced Transport Legs",
          pain: "A multimodal shipment becomes a flat list of events with no clear connection between origin pickup, port, air/ocean, and delivery.",
          benefit: "Ordered transport legs capture mode, origin, destination, schedule, actuals, carrier references, and status.",
          demo: "Open shipment → Tracking → expand legs → compare scheduled vs actual milestones and carrier references.",
          screen: ["Transport Legs", "Every movement has sequence and context", ["Legs|4|blue", "Complete|2|green", "In transit|1|blue"], ["Leg", "Route", "Status"], [["1 · Truck", "Bac Ninh → Hai Phong", "Complete"], ["2 · Ocean", "Hai Phong → Oakland", "In transit"], ["3 · Rail", "Oakland → Roseville", "Scheduled"]]]
        },
        {
          title: "Unified Tracking Timeline",
          pain: "Carrier events use inconsistent names and timestamps, making it hard to explain where a shipment is now.",
          benefit: "Normalized tracking events produce a single movement status, next stop, latest event, and projected route.",
          demo: "Open shipment → Tracking → show latest event, next stop, normalized timeline, and source references.",
          screen: ["Shipment Tracking", "Carrier events become one operational story", ["Movement|In transit|blue", "Latest|Vessel departed|green", "Next stop|Oakland|blue"], ["Time", "Event", "Source"], [["Aug 27 18:40", "Vessel departed", "Carrier"], ["Aug 28 07:10", "Customs data received", "Qubere"], ["Sep 08 06:00", "Estimated arrival", "Carrier"]]]
        },
        {
          title: "Shared Documents, Separate Decisions",
          availability: "Architecture — seed required",
          pain: "Teams either duplicate consolidation documents across houses or accidentally share house-specific data too broadly.",
          benefit: "Documents can stay linked to the correct operational object while each house retains its own parties, line items, compliance, and filing decisions.",
          demo: "Open master and house records side by side → compare document lists → show house-specific extracted facts and filing readiness.",
          screen: ["Consolidation Documents", "Reuse shared evidence without collapsing house-level control", ["Master docs|4|blue", "House docs|18|blue", "Unresolved links|2|amber"], ["Document", "Scope", "Consumers"], [["Master B/L", "Master", "8 houses"], ["Commercial invoice", "House HBL-88219", "1 house"], ["Packing list", "House HBL-88220", "1 house"]]]
        }
      ]
    },

    users: {
      name: "User Management",
      icon: "♙",
      promise: "Onboard the right people into the right accounts and roles—then keep access understandable.",
      audience: "Account owners · IT administrators",
      features: [
        {
          title: "Email-Bound Invitations",
          pain: "Manual provisioning creates the wrong membership or lets invitation links be used by the wrong signed-in identity.",
          benefit: "Invitations bind email, account, and role, and verify the signed-in email before acceptance.",
          demo: "Manage Account → Users → invite a user → show pending invitation → explain acceptance and email-match guard.",
          screen: ["Invite User", "Membership begins with verified intent", ["Pending|4|amber", "Accepted|28|green", "Expired|2|amber"], ["Email", "Role", "Status"], [["broker@acme.com", "Entry Writer", "Pending"], ["review@acme.com", "Reviewer", "Accepted"], ["finance@acme.com", "Billing Checker", "Accepted"]]]
        },
        {
          title: "Role & Permission Administration",
          pain: "Teams cannot explain what a role can actually do until someone encounters a denied or over-permitted action.",
          benefit: "Searchable permission catalogues and domain grouping make role behavior explicit before assignment.",
          demo: "Manage Account → Roles & Permissions → open role → search filing or billing → add/remove permission → save.",
          screen: ["Role Editor", "Understand access before granting it", ["Role|Reviewer|blue", "Permissions|42|blue", "Domains|6|green"], ["Domain", "Permission", "Granted"], [["Compliance", "compliance.override", "Yes"], ["Filing", "filing.approve", "Yes"], ["Billing", "billing.invoices.approve", "No"]]]
        },
        {
          title: "Membership Lifecycle",
          pain: "Departed users and role changes linger because access reviews happen outside the product.",
          benefit: "Admins can review membership status, role assignments, invitations, and administrative history in one place.",
          demo: "Manage Account → Users → filter by status → open a member → change role or deactivate → show audit entry.",
          screen: ["User Management", "Access stays current as responsibilities change", ["Active|32|green", "Pending|4|amber", "Inactive|3|blue"], ["User", "Role", "Status"], [["Maya Rivera", "Broker Manager", "Active"], ["Alex Chen", "Reviewer", "Active"], ["Former User", "Viewer", "Inactive"]]]
        },
        {
          title: "Multi-Account Access",
          pain: "Brokerage groups and shared-service teams need to work across accounts without mixing customer data.",
          benefit: "A user can hold memberships across accounts while every active session keeps an explicit account context and scoped permissions.",
          demo: "Use account switcher → move between two accounts → show different role, data, and navigation in each.",
          screen: ["Account Switcher", "One identity, explicit context per account", ["Memberships|5|blue", "Active account|ABC Brokers|blue", "Role|Owner|green"], ["Account", "Role", "Access"], [["ABC Customs Brokers", "Owner", "Full"], ["Acme Importer", "Viewer", "Read only"], ["Northstar Freight", "Billing", "Billing only"]]]
        }
      ]
    },

    platform: {
      name: "Platform",
      icon: "⬡",
      promise: "Configure countries, workflows, integrations, reference data, and tenant operations on one extensible foundation.",
      audience: "Technology leaders · platform admins · implementation teams",
      features: [
        {
          title: "Tenant & Account Administration",
          pain: "Enterprise groups, brokerages, and importer clients need distinct commercial and data boundaries without separate deployments.",
          benefit: "Tenant and account configuration supports profiles, domains, memberships, statuses, and shared platform services.",
          demo: "Manage Account → Account Profile → show account identifiers, profile, memberships, and controlled settings.",
          screen: ["Account Profile", "A clear operating boundary for every customer", ["Accounts|12|blue", "Active|11|green", "Configuration health|96%|green"], ["Account", "Type", "Status"], [["ABC Customs Brokers", "Broker", "Active"], ["Acme Manufacturing", "Importer", "Active"], ["Demo Sandbox", "Test", "Restricted"]]]
        },
        {
          title: "Filing Configuration",
          pain: "Supporting a new destination or procedure usually requires hard-coded forms and a new release.",
          benefit: "Platform admins configure schema trees, tabs, panels, grids, visibility, ordering, and country/procedure mappings.",
          demo: "Platform → Filing Configuration → select country/procedure → edit layout → preview → save → open filing screen.",
          screen: ["Filing Configuration", "Country and procedure behavior is configurable", ["Countries|3|blue", "Procedures|11|blue", "Schema coverage|94%|green"], ["Configuration", "Version", "Status"], [["US Consumption Entry", "v18", "Published"], ["US Warehouse Entry", "v6", "Draft"], ["Canada B3", "v2", "Pilot"]]]
        },
        {
          title: "Integrations & APIs",
          pain: "Documents, ERP data, ABI messages, storage, and notification channels require separate one-off connections.",
          benefit: "Per-account integration settings and API surfaces connect intake, storage, trade systems, and downstream workflows.",
          demo: "Manage Account → Integrations & APIs → show connectors and scopes → Platform Admin → API Explorer → open endpoint docs.",
          screen: ["Integration Control Plane", "Connected systems share tenant context and audit", ["Connectors|9|blue", "Healthy|8|green", "Attention|1|amber"], ["Connector", "Domain", "Health"], [["GCS", "Documents", "Healthy"], ["ABI provider", "Filing", "Healthy"], ["ERP webhook", "Master data", "Attention"]]]
        },
        {
          title: "Reference Data Operations",
          pain: "Tariffs, restricted-party lists, rates, and compliance rules change independently and must remain reproducible over time.",
          benefit: "Versioned ingestion, publication status, change tracking, impact previews, and review workflows preserve point-in-time evidence.",
          demo: "Platform Admin → Data Admin / HTS / Rate Review → open a source update → preview impact → publish or reject.",
          screen: ["Reference Data", "Every update has version, review, and impact", ["Sources|14|blue", "Current|13|green", "Review pending|1|amber"], ["Dataset", "Version", "Status"], [["HTSUS", "2026 Rev 12", "Current"], ["OFAC SDN", "Aug 29 delta", "Current"], ["Trade rates", "Sep proposal", "Review"]]]
        },
        {
          title: "Agent & Job Operations",
          pain: "Background agents, document workers, and scheduled jobs become invisible production dependencies.",
          benefit: "Platform views expose agent analytics, deployments, cron health, processing queues, and quarantined inbound work.",
          demo: "Platform Admin → Agents Analytics / Cron / Deployments → show health and recent runs → open failed item.",
          screen: ["Platform Operations", "Agents and jobs are operated, not merely deployed", ["Healthy agents|12|green", "Jobs running|4|blue", "Failures 24h|2|amber"], ["Service", "Last run", "Health"], [["Document worker", "2 min ago", "Healthy"], ["Screening delta", "14 min ago", "Healthy"], ["Rate ingestion", "1h ago", "Review"]]]
        }
      ]
    },

    trade: {
      name: "Trade Data & Intelligence",
      icon: "◎",
      promise: "Reuse trusted product, party, tariff, and regulatory knowledge across every shipment and decision.",
      audience: "Trade advisory · classification · procurement",
      features: [
        {
          title: "Product Master",
          pain: "The same product is reclassified and re-researched on every shipment because prior knowledge is trapped in entry files.",
          benefit: "A tenant-scoped product master preserves identifiers, attributes, classifications, evidence, decisions, and change history.",
          demo: "Trade Data → Products → open a product → show identifiers, attributes, classification history, evidence, and shipment use.",
          screen: ["Product Master", "Classify once, reuse with evidence", ["Products|18,240|blue", "Classified|17,814|green", "Review|426|amber"], ["Product", "HTS", "Confidence"], [["Portable workstation X2", "8471.30.0100", "93%"], ["Lithium pack LP-4", "8507.60.0020", "98%"], ["Steel bracket B7", "7326.90.8688", "Review"]]],
          screenshot: S + "product-master.png"
        },
        {
          title: "Party Master",
          pain: "Supplier, manufacturer, importer, consignee, and contact data is duplicated with inconsistent names and screening history.",
          benefit: "A party master centralizes legal identity, addresses, roles, identifiers, relationships, screening, and approval history.",
          demo: "Trade Data → Parties → open a party → show identity, addresses, identifiers, screening history, and linked shipments.",
          screen: ["Party Master", "One defensible identity across trade workflows", ["Parties|6,842|blue", "Pre-approved|5,910|green", "Monitoring|6,842|blue"], ["Party", "Role", "Screening"], [["Solis Components Ltd", "Manufacturer", "Clear"], ["Acme Manufacturing", "Importer", "Clear"], ["Northstar Metals", "Supplier", "Review"]]],
          screenshot: S + "party-master.png"
        },
        {
          title: "Tariff & Sourcing Simulator",
          pain: "Teams commit to sourcing decisions without understanding the full duty stack or alternative-country exposure.",
          benefit: "Model base duty, special tariffs, fees, and sourcing scenarios before the purchase order is signed.",
          demo: "Trade Data → Tariff Simulator → enter product, origin, destination, and value → compare scenarios.",
          screen: ["Tariff & Sourcing Simulator", "See landed-duty exposure before committing", ["Current duty|$84K|amber", "Best alternative|$31K|green", "Savings|$53K|green"], ["Scenario", "Duty", "Delta"], [["China → US", "$84,230", "Baseline"], ["Vietnam → US", "$38,410", "-$45,820"], ["Mexico → USMCA", "$31,020", "-$53,210"]]],
          screenshot: S + "tariff-simulator.png"
        },
        {
          title: "Regulatory Intelligence",
          pain: "Policy updates arrive as long publications, leaving teams to determine which products and shipments are affected.",
          benefit: "Qubere captures regulatory changes, summarizes operational meaning, and connects them to impacted trade data.",
          demo: "Trade Data → Tariffs & Regulations → open an update → show summary, effective date, affected codes, and impacted products.",
          screen: ["Regulatory Intelligence", "Move from publication to impact", ["Updates this week|18|blue", "Impacted products|286|amber", "Actions created|42|amber"], ["Update", "Effective", "Impact"], [["Section 301 revision", "Sep 15", "184 products"], ["AD/CVD scope note", "Oct 01", "7 suppliers"], ["FDA message-set change", "Nov 06", "95 products"]]],
          screenshot: S + "regulatory-intel.png"
        },
        {
          title: "Trade Data Workspace",
          pain: "Classification, party, tariff, and shipment insights are stored in separate systems and cannot be explored together.",
          benefit: "A shared data workspace connects product and party masters, tariffs, import activity, and reusable reporting.",
          demo: "Trade Data → Overview → filter by product, party, country, or HTS → open the linked master record or shipment.",
          screen: ["Trade Data", "Reusable intelligence across the book of business", ["Import value|$84.2M|blue", "HTS codes|1,284|blue", "Countries|42|green"], ["Dimension", "Top value", "Exposure"], [["Country", "Vietnam", "$18.4M"], ["HTS chapter", "84 Machinery", "$22.1M"], ["Supplier", "Solis Components", "$6.8M"]]]
        }
      ]
    }
  };
})();
