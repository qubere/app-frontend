import { db } from "@/lib/db";

// ─── Canonical dataset definitions ────────────────────────────────────────────
// readinessStatus distinguishes datasets with real ingestion wiring ("LIVE")
// from those that are planned but not yet implemented ("NOT_YET_IMPLEMENTED").
// "Run Now" is ONLY available for LIVE datasets. NOT_YET_IMPLEMENTED datasets
// show their roadmap status and never fake a success response.
export type ReadinessStatus = "LIVE" | "NOT_YET_IMPLEMENTED";

export interface DatasetDefinition {
  id: string;
  name: string;
  powers: string;
  source: string;
  sourceUrl: string;
  cost: string;
  refreshMethod: string;
  frequency: string;
  scheduledFrequencyHours: number; // used by dispatcher to determine if due
  staleThresholdHours: number; // staleness alert fires after this many hours without success
  category: "Public API" | "Structured Document";
  engineeringEffort: "Low" | "Medium" | "High" | "Very High";
  readinessStatus: ReadinessStatus;
  endpoint?: string; // only set for LIVE datasets with a real route
  // true only for datasets that schedule their own recurring runs via an
  // Inngest-native cron trigger (heavy/long-running ingestion that can't
  // run synchronously inside this dataset's `endpoint`). The dispatcher
  // must never auto-trigger these itself -- `endpoint` exists on them only
  // so admins can enqueue a manual "Run Now", which the endpoint fulfills
  // by sending an Inngest event rather than doing the work inline.
  selfScheduled?: boolean;
  // Runtime state loaded from DatasetRefreshLog — not hardcoded
  lastRun?: string | null;
  lastRunStatus?: "success" | "error" | "running" | null;
  lastRunDetails?: string | null;
}

export const DATASET_DEFINITIONS: DatasetDefinition[] = [
  // ─── Group A: Free — Public Government Sources (Machine-Readable APIs) ──────

  {
    id: "hts-schedule",
    name: "HTSUS Schedule (Full Tariff Schedule)",
    powers: "HTS classification, duty rates, tariff scenarios, landed cost calculation engine",
    source: "usitc.gov (USITC REST API)",
    sourceUrl: "https://hts.usitc.gov/reststop/exportList",
    cost: "Free",
    refreshMethod:
      "Automated JSON REST API fetcher (HtsUsitcFetcher). Node hash delta detection. Staged into HtsRelease (DRAFT) for admin review before publishing to production.",
    frequency: "Daily (02:00 UTC)",
    scheduledFrequencyHours: 24,
    staleThresholdHours: 36,
    category: "Public API",
    engineeringEffort: "Low",
    readinessStatus: "LIVE",
    endpoint: "/api/cron/hts-refresh",
    selfScheduled: true,
  },
  {
    id: "federal-register",
    name: "Federal Register (CBP Notices)",
    powers: "Regulatory monitoring, AD/CVD alerts, tariff changes, retroactive exclusion triggers",
    source: "federalregister.gov/api",
    sourceUrl:
      "https://www.federalregister.gov/api/v1/documents.json?conditions[agencies][]=u-s-customs-and-border-protection",
    cost: "Free",
    refreshMethod:
      "REST API document fetch + Gemini structured extraction (extractionSchema). Auto-creates RefundOpportunity records on exclusion notices.",
    frequency: "Daily (08:00 UTC)",
    scheduledFrequencyHours: 24,
    staleThresholdHours: 36,
    category: "Public API",
    engineeringEffort: "Low",
    readinessStatus: "LIVE",
    endpoint: "/api/cron/regulatory-ingest",
  },

  {
    id: "ofac-sdn",
    name: "OFAC SDN + Consolidated Non-SDN",
    powers: "Specially Designated Nationals (SDN) screening, sanctions enforcement, blocking checks",
    source: "ofac.treasury.gov (Streaming XML: sdn.xml + consolidated.xml)",
    sourceUrl: "https://www.treasury.gov/ofac/downloads/sdn.xml",
    cost: "Free",
    refreshMethod:
      "Streaming SAX (saxes) XML parser (OfacSdnIngestionService) reads Treasury's sdn.xml and consolidated.xml directly, extracting name, AKAs, addresses, and program codes per entry. Circuit breaker: parsed count must match the feed's own Record_Count header or nothing is written. Delisted entities are marked SUPERSEDED rather than deleted, preserving point-in-time screening history. Runs as a durable Inngest background function (own native cron trigger) to avoid request-handler timeout on the ~29MB SDN file.",
    frequency: "Daily (05:00 UTC)",
    scheduledFrequencyHours: 24,
    staleThresholdHours: 36,
    category: "Public API",
    engineeringEffort: "Low",
    readinessStatus: "LIVE",
    endpoint: "/api/cron/ofac-sdn-ingest",
    selfScheduled: true,
  },

  {
    id: "uflpa-entity-list",
    name: "UFLPA Entity List (DHS FLETF)",
    powers: "Forced Labor / UFLPA entity-level screening (Uyghur Forced Labor Prevention Act)",
    source: "dhs.gov/uflpa-entity-list (Static HTML tables, no structured API)",
    sourceUrl: "https://www.dhs.gov/uflpa-entity-list",
    cost: "Free",
    refreshMethod:
      "Cheerio DOM scraper (UflpaEntityListIngestionService) parses the four statutory-clause tables on the DHS FLETF page into name/alias/effective-date rows. Circuit breaker: fewer than 20 parsed rows aborts the run untouched, since the list only grows. Delisted entities are marked SUPERSEDED rather than deleted.",
    frequency: "Daily (06:00 UTC)",
    scheduledFrequencyHours: 24,
    staleThresholdHours: 48,
    category: "Structured Document",
    engineeringEffort: "Medium",
    readinessStatus: "LIVE",
    endpoint: "/api/cron/uflpa-entity-list-ingest",
  },
  {
    id: "fda-debarment",
    name: "FDA Debarment List (Drug Product Applications)",
    powers: "Pharma/life-sciences debarment screening (FDCA Section 306(a)/(b))",
    source: "fda.gov FDA Debarment List page (Static HTML tables, no structured API)",
    sourceUrl:
      "https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/compliance-actions-and-activities/fda-debarment-list-drug-product-applications",
    cost: "Free",
    refreshMethod:
      "Cheerio DOM scraper (FdaDebarmentIngestionService) parses the page's Firms and Persons tables into name/effective-date/citation rows. Circuit breaker: fewer than 20 parsed rows aborts the run untouched. Removed/expired debarments are marked SUPERSEDED rather than deleted. Note: fda.gov currently returns an Akamai bot-detection block for every path (including the homepage) from this environment's outbound IP, so a live fetch has not yet been verified end-to-end -- needs a smoke test from the deployed environment before the cron is relied upon.",
    frequency: "Daily",
    scheduledFrequencyHours: 24,
    staleThresholdHours: 48,
    category: "Structured Document",
    engineeringEffort: "Medium",
    readinessStatus: "LIVE",
    endpoint: "/api/cron/fda-debarment-ingest",
  },
  {
    id: "uk-sanctions-list",
    name: "UK Sanctions List (OFSI)",
    powers: "UK sanctions screening (asset freeze, travel ban, arms embargo, sectoral measures)",
    source: "sanctionslist.fcdo.gov.uk (static XML export, no API key required)",
    sourceUrl: "https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.xml",
    cost: "Free",
    refreshMethod:
      "Streaming SAX parser (UksSanctionsListIngestionService, saxes) reads the ~21MB <Designations> XML feed without buffering the whole file, mapping each <Designation> to a ScreeningEntity by primary/alias names, addresses, and OFSI Unique ID. Circuit breaker: fewer than 1,000 parsed designations aborts the run untouched (the feed carries no explicit reported-total element to check exactly, unlike OFAC's XML). Delisted designations are marked SUPERSEDED rather than deleted. URL confirmed live (HTTP 200, application/xml) and root element verified against the published SanctionsListSchema-4.33.3.xsd.",
    frequency: "Daily",
    scheduledFrequencyHours: 24,
    staleThresholdHours: 48,
    category: "Structured Document",
    engineeringEffort: "Medium",
    readinessStatus: "LIVE",
    endpoint: "/api/cron/uk-sanctions-list-ingest",
  },
  {
    id: "eu-consolidated-sanctions",
    name: "EU Consolidated Financial Sanctions List",
    powers: "EU financial sanctions screening (asset freeze, restrictive measures)",
    source: "webgate.ec.europa.eu FSD full sanctions export (static CSV, token-scoped public download)",
    sourceUrl: "https://webgate.ec.europa.eu/fsd/fsf/public/files/csvFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw",
    cost: "Free",
    refreshMethod:
      "Buffered CSV parse (EuConsolidatedSanctionsIngestionService, csv-parse, semicolon-delimited, one row per NameAlias record) groups rows by Entity_LogicalId and deduplicates NameAlias/Address/BirthDate sub-records by their own LogicalId columns to reconstruct each entity, then maps to a ScreeningEntity by first-populated name, address, EU reference number, and sanctions programme. Circuit breaker: fewer than 1,000 parsed entities aborts the run untouched. Delisted entities are marked SUPERSEDED rather than deleted. Note: the base webgate.ec.europa.eu path session-gates unauthenticated requests (302 + Set-Cookie); the token query param published on this dataset's data.europa.eu landing page is required and was confirmed live (HTTP 200, text/csv) via direct fetch.",
    frequency: "Daily",
    scheduledFrequencyHours: 24,
    staleThresholdHours: 48,
    category: "Structured Document",
    engineeringEffort: "Medium",
    readinessStatus: "LIVE",
    endpoint: "/api/cron/eu-consolidated-sanctions-ingest",
  },
  {
    id: "un-security-council-sanctions",
    name: "UN Security Council Consolidated List",
    powers: "UN Security Council sanctions screening (all UNSC sanctions regimes)",
    source: "scsanctions.un.org consolidated list (static XML export, no API key required)",
    sourceUrl: "https://scsanctions.un.org/resources/xml/en/consolidated.xml",
    cost: "Free",
    refreshMethod:
      "Streaming SAX parser (UnSecurityCouncilSanctionsIngestionService, saxes) reads the <CONSOLIDATED_LIST><INDIVIDUALS>/<ENTITIES> XML feed, mapping each record to a ScreeningEntity by name parts, aliases, addresses, and UN reference number. Circuit breaker: fewer than 500 parsed records aborts the run untouched. Delisted records are marked SUPERSEDED rather than deleted. Note: scsanctions.un.org (fronted by CloudFront) returned transient 302/404 responses on isolated single requests during verification; the fetcher retries up to 3 times with redirect-following before failing the run, and confirmed live content (root element <CONSOLIDATED_LIST>) on a successful attempt.",
    frequency: "Daily",
    scheduledFrequencyHours: 24,
    staleThresholdHours: 48,
    category: "Structured Document",
    engineeringEffort: "Medium",
    readinessStatus: "LIVE",
    endpoint: "/api/cron/un-security-council-sanctions-ingest",
  },
  {
    id: "meti-foreign-end-user-list",
    name: "METI Foreign End User List (Japan)",
    powers: "Japan Foreign End User (WMD/conventional-weapons proliferation concern) screening",
    source: "meti.go.jp Foreign End User List (外国ユーザーリスト) -- periodically-reissued PDF, no stable per-revision URL",
    sourceUrl: "https://www.meti.go.jp/files/900018298.pdf",
    cost: "Free",
    refreshMethod:
      "pdfjs-dist text extraction (MetiForeignEndUserListIngestionService) parses METI's PDF table (Country/Region, Company/Organization, Also Known As aliases, WMD concern codes B/C/M/N, Conventional Weapons/CW flag) into ScreeningEntity, deduped by name+country (no stable external id -- the PDF's row number is positional and changes across reissues). Download is timeout-bounded with retry-with-backoff and a SHA-256 checksum of the fetched bytes recorded on every run for integrity/health monitoring. Circuit breaker: fewer than 500 parsed entries aborts the run untouched -- previously PUBLISHED rows are never superseded by a failed or suspiciously small run (last-known-good retention). Note: the PDF's path changes every time METI reissues the list (configurable via METI_EUL_PDF_URL, not hardcoded), and meti.go.jp is unreachable from some sandboxed environments -- verify the endpoint from the deployed environment before relying on the cron.",
    frequency: "Daily",
    scheduledFrequencyHours: 24,
    staleThresholdHours: 48,
    category: "Structured Document",
    engineeringEffort: "Medium",
    readinessStatus: "LIVE",
    endpoint: "/api/cron/meti-end-user-list-ingest",
  },
  {
    id: "seco-sanctions-list",
    name: "SECO Sanctions List (Switzerland)",
    powers: "Swiss sanctions screening (all SECO-administered sanctions ordinances -- individuals, entities, and vessels)",
    source: "sesam.search.admin.ch consolidated sanctions export (static XML, no API key required)",
    sourceUrl:
      "https://www.sesam.search.admin.ch/sesam-search-web/pages/downloadXmlGesamtliste.xhtml?lang=de&action=downloadXmlGesamtlisteAction",
    cost: "Free",
    refreshMethod:
      "SAX-streaming XML parser (SecoSanctionsListIngestionService, saxes) reads the ~35MB <swiss-sanctions-list> feed in a single pass into ScreeningEntity. All <sanctions-program> header blocks precede every <target> in document order, so the sanctions-set-id -> program-key lookup used for programCodes is fully built before any target needs it. Each target's current status is its most-recent (first-listed) <modification modification-type=\"listed|amended|de-listed\">; a target whose current status is de-listed is excluded from the upsert loop and falls into the standard not-touched-this-run supersede pass. A generic depth-counting skip mechanism ignores all nested historical <modification><added>/<removed> content (which re-embeds full historical target/individual/entity copies under the same tag names) without ever needing to pattern-match on tag identity. Circuit breaker: fewer than 8,000 parsed active targets aborts the run untouched -- previously PUBLISHED rows are never superseded by a failed or suspiciously small run (last-known-good retention).",
    frequency: "Daily",
    scheduledFrequencyHours: 24,
    staleThresholdHours: 48,
    category: "Structured Document",
    engineeringEffort: "Medium",
    readinessStatus: "LIVE",
    endpoint: "/api/cron/seco-sanctions-ingest",
  },
  {
    id: "dfat-consolidated-list",
    name: "DFAT Consolidated List (Australia)",
    powers: "Australian sanctions screening (all DFAT/Australian Sanctions Office-administered measures -- individuals, entities, and vessels)",
    source: "dfat.gov.au Consolidated List (static XLSX export, no API key required)",
    sourceUrl: "https://www.dfat.gov.au/sites/default/files/Australian_Sanctions_Consolidated_List.xlsx",
    cost: "Free",
    refreshMethod:
      "ExcelJS buffer-load parse (DfatConsolidatedListIngestionService) of the single \"Consolidated List\" worksheet (~11,000 rows for ~3,900 listed parties). Rows sharing a numeric Reference prefix (\"3\", \"3a\", \"3b\", ...) are grouped into one entity -- the \"Primary Name\" row supplies the canonical name and shared fields (DOB, citizenship, address, listing information, control date, sanction-measure flags), while sibling \"Alias\"/\"Original Script\" rows fold into alternateNames. The workbook (~1.3MB) is small enough to buffer directly rather than stream, unlike SECO/UKSL/EUC's larger XML feeds. Circuit breaker: fewer than 2,500 parsed entities aborts the run untouched -- previously PUBLISHED rows are never superseded by a failed or suspiciously small run (last-known-good retention). Note: dfat.gov.au's HTML search/listing pages have been unreachable (connection timeout) from this sandbox -- only the direct XLSX file URL was confirmed reachable; verify from the deployed environment before relying on the cron.",
    frequency: "Daily",
    scheduledFrequencyHours: 24,
    staleThresholdHours: 48,
    category: "Structured Document",
    engineeringEffort: "Medium",
    readinessStatus: "LIVE",
    endpoint: "/api/cron/dfat-consolidated-list-ingest",
  },
  {
    id: "canada-consolidated-sanctions-list",
    name: "Consolidated Canadian Autonomous Sanctions List",
    powers: "Canadian sanctions screening (Special Economic Measures Act regulations by country, plus JVCFOR -- individuals, entities, and vessels)",
    source: "international.gc.ca Consolidated Sanctions List (static XML export, no API key required)",
    sourceUrl:
      "https://www.international.gc.ca/world-monde/assets/office_docs/international_relations-relations_internationales/sanctions/sema-lmes.xml",
    cost: "Free",
    refreshMethod:
      "Streaming SAX parser (CanadaConsolidatedSanctionsListIngestionService, saxes, flat <data-set>/<record> schema with bilingual EN/FR text in every element) maps each record to a ScreeningEntity by name, sole alias, and the Country-Pays field (doubling as this feed's only regulation/programme identifier). Circuit breaker: fewer than 3,500 parsed records aborts the run untouched. Delisted records are marked SUPERSEDED rather than deleted. Note: this source has no address, nationality, or remarks fields at all, and no globally unique per-record ID -- Schedule/Item numbers reset per country and are used only for a descriptive citation, not as the dedup key (entityHash covers that).",
    frequency: "Daily",
    scheduledFrequencyHours: 24,
    staleThresholdHours: 48,
    category: "Structured Document",
    engineeringEffort: "Medium",
    readinessStatus: "LIVE",
    endpoint: "/api/cron/canada-consolidated-sanctions-ingest",
  },
  {
    id: "world-bank-debarred-firms",
    name: "World Bank Ineligible Firms and Individuals",
    powers: "Multilateral development-finance debarment screening (World Bank Group sanctions/cross-debarment)",
    source:
      "worldbank.org Debarred Firms & Individuals page -- the visible table is a Kendo UI grid populated client-side " +
      "from a JSON REST endpoint, not server-rendered HTML. Ingestion calls that JSON endpoint directly instead of " +
      "scraping the rendered table -- more reliable than an HTML-table parser and returns the full dataset " +
      "(no pagination) in one call.",
    sourceUrl: "https://apigwext.worldbank.org/dvsvc/v1.0/json/APPLICATION/ADOBE_EXPRNCE_MGR/FIRM/SANCTIONED_FIRM",
    cost: "Free",
    refreshMethod:
      "Direct JSON fetch (WorldBankDebarredFirmsIngestionService) with an `apikey` header -- a public, " +
      "client-exposed key hardcoded in the World Bank page's own JS, not a secret, but it may be rotated or " +
      "restricted without notice. Maps each response.response.ZPROCSUPP row to a ScreeningEntity by SUPP_NAME, " +
      "using SUPP_TYPE_CODE for entityType (I -> INDIVIDUAL, else ENTITY) and SUPP_ID (a genuine per-record World " +
      "Bank supplier ID) as citation. DEBAR_TO_DATE's 2999-12-31 sentinel for permanent/indefinite debarment is " +
      "normalized to a null expirationDate. Circuit breaker: fewer than 1,000 parsed records (live count is " +
      "~1,515) aborts the run untouched. Delisted records are marked SUPERSEDED rather than deleted. Out of scope: " +
      "the page's separate, much smaller 'Table 2: Other Sanctions' list (letters of reprimand etc.), which is " +
      "genuinely static HTML and a distinct dataset from the main debarment table.",
    frequency: "Daily",
    scheduledFrequencyHours: 24,
    staleThresholdHours: 48,
    category: "Structured Document",
    engineeringEffort: "Medium",
    readinessStatus: "LIVE",
    endpoint: "/api/cron/world-bank-debarred-firms-ingest",
  },

  {
    id: "public-safety-canada-terrorist-entities",
    name: "Public Safety Canada — Listed Terrorist Entities",
    powers: "Criminal Code of Canada, s.83.05 (Listed Terrorist Entities)",
    source:
      "publicsafety.gc.ca's 'Currently listed entities' page is backed by a clean structured Atom XML feed -- " +
      "ingestion reads that feed directly rather than scraping the HTML page.",
    sourceUrl: "https://www.publicsafety.gc.ca/cnt/_xml/lstd-ntts-eng.xml",
    cost: "Free",
    refreshMethod:
      "Direct XML fetch (PublicSafetyCanadaTerroristEntitiesIngestionService), parsed with cheerio in xmlMode. " +
      "Each <entry> maps to a ScreeningEntity keyed on name only (this source has no country/nationality field, " +
      "same convention as Canada's SEMA/JVCFOR list): title -> name (parenthetical acronym kept in the name and " +
      "also surfaced standalone in alternateNames), summary's semicolon/comma-separated aliases -> alternateNames, " +
      "content -> remarks, id -> citation. entityType defaults uniformly to ENTITY -- the live feed currently " +
      "lists no individually-named persons, only groups. Circuit breaker: fewer than 70 parsed entries (live " +
      "count is ~90) aborts the run untouched. Delisted entities are marked SUPERSEDED rather than deleted.",
    frequency: "Daily",
    scheduledFrequencyHours: 24,
    staleThresholdHours: 48,
    category: "Structured Document",
    engineeringEffort: "Low",
    readinessStatus: "LIVE",
    endpoint: "/api/cron/public-safety-canada-terrorist-entities-ingest",
  },

  {
    id: "eu-air-safety-list",
    name: "EU Air Safety List",
    powers: "Regulation (EC) No 474/2006 -- air carriers banned or restricted within the EU",
    source:
      "The European Commission publishes the Air Safety List primarily as a PDF, but transport.ec.europa.eu also " +
      "hosts a stable-URL XLSX export of the same list (Annex A: full ban, Annex B: operational restrictions) -- " +
      "ingestion reads that XLSX directly instead of parsing the PDF, mirroring the DFAT/EUC pattern of preferring " +
      "a structured export over the primary document format where one exists.",
    sourceUrl:
      "https://transport.ec.europa.eu/document/download/67b75752-d144-4366-9f4a-c04157840211_en?filename=air-safety-list.xlsx",
    cost: "Free",
    refreshMethod:
      "Direct XLSX fetch (EuAirSafetyListIngestionService) buffered and loaded with ExcelJS. Parses both the " +
      "'Annex A' and 'Annex B' worksheets; each data row maps to a ScreeningEntity (entityType ENTITY, keyed on " +
      "name + State of the Operator). Some Annex A rows are descriptive 'All air carriers certified by the " +
      "authorities with responsibility for regulatory oversight of <State>' blanket-ban rows rather than " +
      "individually named carriers -- these are ingested as their own screenable record, since the ban applies " +
      "to the whole state's carrier population rather than a specific legal entity. Bold exception clauses in " +
      "some blanket-ban cells use ExcelJS richText, handled via the same cellToString() helper used for DFAT. " +
      "The EC's own published workbook repeats a block of Annex A rows verbatim near the end of the sheet -- " +
      "collapsed by entityHash before upserting so a duplicated source row can't race itself. Circuit breaker: " +
      "fewer than 100 parsed records aborts the run untouched. Delisted carriers are marked SUPERSEDED rather " +
      "than deleted.",
    frequency: "Daily",
    scheduledFrequencyHours: 24,
    staleThresholdHours: 48,
    category: "Structured Document",
    engineeringEffort: "Medium",
    readinessStatus: "LIVE",
    endpoint: "/api/cron/eu-air-safety-list-ingest",
  },

  {
    id: "mas-domestic-designations",
    name: "MAS Domestic Designations (Terrorism (Suppression of Financing) Act 2002)",
    powers: "Terrorism (Suppression of Financing) Act 2002, First Schedule, para 2 -- Singapore's own domestic terrorist-designation list",
    source:
      "MAS itself doesn't host this list directly -- Singapore Statutes Online (sso.agc.gov.sg) publishes the " +
      "authoritative, continuously-updated text of the First Schedule to the TSFA2002, which is the better " +
      "underlying source (structured HTML, versioned, no PDF re-parsing) -- mirroring this session's established " +
      "pattern of preferring the better structured source over the literally-named agency's own site where they " +
      "diverge. The First Schedule's para 1 (UN Taliban/ISIL-Al-Qaida incorporation-by-reference) is deliberately " +
      "skipped since it's already covered by the UN Security Council pipeline; only para 2's lettered list of " +
      "individually-designated persons is ingested. The Second Schedule shares the same 'Terrorists and terrorist " +
      "entities' caption in the page's table of contents but its actual body is a list of offence categories that " +
      "also constitute terrorist acts (confirmed live 2026-09-03) -- not a list of designated persons/entities -- " +
      "so it's out of scope.",
    sourceUrl: "https://sso.agc.gov.sg/Act/TSFA2002?ProvIds=Sc1-",
    cost: "Free",
    refreshMethod:
      "Direct HTML fetch (MasDomesticDesignationsIngestionService) with a realistic browser User-Agent -- the " +
      "site's own ?ViewType=Print URL returns only an interactive print-selector shell with no real content, so " +
      "the plain URL is used instead. Extracts the First Schedule's para 2 lettered list "+
      "((a) through (zzb) as of the 2026-09-03 fetch) via a targeted regex over the raw HTML between the para 2 " +
      "and para 3 anchors. Each entry maps to a ScreeningEntity (entityType INDIVIDUAL, keyed on name + " +
      "nationality). Handles: '@' alias notation; Passport No. / Work Permit No. identifiers, each potentially " +
      "carrying its own 'stating Date of Birth' claim (a conflicting secondary DOB is recorded in remarks rather " +
      "than discarded); the inconsistent nbsp-vs-plain-space formatting before ID numbers; and " +
      "'[Deleted by S NNN/YYYY wef DD/MM/YYYY]' entries, which are skipped entirely. Circuit breaker: fewer than " +
      "20 parsed records aborts the run untouched. Delisted individuals are marked SUPERSEDED rather than deleted.",
    frequency: "Weekly",
    scheduledFrequencyHours: 168,
    staleThresholdHours: 336,
    category: "Structured Document",
    engineeringEffort: "Medium",
    readinessStatus: "LIVE",
    endpoint: "/api/cron/mas-domestic-designations-ingest",
  },

  // ─── NOT_YET_IMPLEMENTED — ingestion pipelines planned, not yet wired ────────
  // Do NOT add fake details, entity counts, or success indicators below.

  {
    id: "fatf-jurisdiction-risk",
    name: "FATF High-Risk and Increased-Monitoring Jurisdictions",
    powers: "Country-level AML/CFT risk screening (FATF 'black list' call-for-action jurisdictions and 'grey list' increased-monitoring jurisdictions)",
    source:
      "fatf-gafi.org's black-and-grey-lists index page always links to the current dated statement pages, but " +
      "every fetch attempt against fatf-gafi.org -- plain fetch and curl with a full realistic browser header set " +
      "(User-Agent, Accept, Accept-Language) alike -- returns HTTP 403 with `Cf-Mitigated: challenge`: a " +
      "Cloudflare JS-execution challenge, not a simple User-Agent gate like MAS/SSO's. There is no header or " +
      "request-shape workaround for this; the only way through would be a JS-executing headless browser solving " +
      "the challenge, which is bot-detection evasion and out of scope to build. This is a confirmed hard blocker, " +
      "not a 'needs a smoke test from the deployed environment' caveat like fda.gov's Akamai block.",
    sourceUrl: "https://www.fatf-gafi.org/en/publications/High-risk-and-other-monitored-jurisdictions/Call-for-action-black-and-grey-lists.html",
    cost: "Free",
    refreshMethod:
      "Not automatable server-side given the confirmed Cloudflare JS-challenge block. If this source is needed, " +
      "the realistic path is a manual quarterly upload after each FATF plenary (mirroring the Dow Jones " +
      "manual-trigger precedent), not a cron job. Also architecturally distinct from every other dataset in this " +
      "registry: FATF designates jurisdictions (countries), not named parties, so it doesn't fit ScreeningEntity " +
      "(matched by name) -- it would need a small country-risk table checked against the screened Party " +
      "Country/Ultimate Destination fields directly, as its own screening step alongside name matching.",
    frequency: "Quarterly (manual, if built)",
    scheduledFrequencyHours: 2160,
    staleThresholdHours: 2400,
    category: "Structured Document",
    engineeringEffort: "Medium",
    readinessStatus: "NOT_YET_IMPLEMENTED",
  },

  {
    id: "cbp-cross-rulings",
    name: "CBP CROSS Rulings",
    powers: "Ruling retrieval, classification evidence matching, AI legal precedent analysis",
    source: "rulings.cbp.gov/api (REST API, 1,000 req/day)",
    sourceUrl: "https://rulings.cbp.gov/api/search",
    cost: "Free",
    refreshMethod:
      "Incremental date-window REST API query extracting ruling number, HTS code, subject text, and ruling body. Indexed into pgvector for semantic similarity retrieval.",
    frequency: "Daily",
    scheduledFrequencyHours: 24,
    staleThresholdHours: 48,
    category: "Public API",
    engineeringEffort: "Low",
    readinessStatus: "LIVE",
    endpoint: "/api/cron/cbp-cross-rulings-ingest",
  },
  {
    id: "bis-csl",
    name: "BIS Consolidated Screening List (CSL)",
    powers: "Denied party screening, restricted entity checks, sanctions compliance",
    source: "api.trade.gov (Combines 10 lists: SDN, DPL, Entity List, UVL, ISN, SSI, FSE, PLC, NS-MBS)",
    sourceUrl: "https://api.trade.gov/v1/consolidated_screening_list/search",
    cost: "Free",
    refreshMethod:
      "REST API fetcher normalizing 10 agency lists into ScreeningEntity schema. Atomic table swap with soft-deletes. DRAFT → admin review → PUBLISHED versioning for point-in-time audit defensibility.",
    frequency: "Daily (04:00 UTC)",
    scheduledFrequencyHours: 24,
    staleThresholdHours: 36,
    category: "Public API",
    engineeringEffort: "Low",
    readinessStatus: "LIVE",
    endpoint: "/api/cron/bis-csl-ingest",
  },
  {
    id: "fbi-wanted",
    name: "FBI Wanted",
    powers: "Law-enforcement watchlist screening (fugitives, terrorism, seeking-information subjects)",
    source: "api.fbi.gov (Public REST/JSON API, no key required)",
    sourceUrl: "https://api.fbi.gov/wanted/v1/list",
    cost: "Free",
    refreshMethod:
      "Paginated JSON REST fetcher (FbiWantedIngestionService) reads api.fbi.gov's wanted list (fixed 50-per-page cap) into ScreeningEntity, deduped on the (provider, providerRecordId) key by the source's own uid. Postings with no named subject (public tip requests) are skipped. Subjects removed from the FBI's list since the last run are marked SUPERSEDED rather than deleted.",
    frequency: "Daily (07:00 UTC)",
    scheduledFrequencyHours: 24,
    staleThresholdHours: 36,
    category: "Public API",
    engineeringEffort: "Low",
    readinessStatus: "LIVE",
    endpoint: "/api/cron/fbi-wanted-ingest",
  },
  {
    id: "sam-gov-exclusions",
    name: "SAM.gov Exclusions",
    powers: "Debarment/suspension screening for federal award exclusions",
    source: "api.sam.gov Data Services bulk extract (requires API key; paginated JSON API's daily quota is too low for a full sync)",
    sourceUrl: "https://api.sam.gov/data-services/v1/extracts",
    cost: "Free (API key required, ~10 requests/day quota on a personal key)",
    refreshMethod:
      "Two-call bulk extract flow (SamGovExclusionsIngestionService): locates the daily EXCLUSION extract ZIP, downloads it, and parses its delimited data file into ScreeningEntity, deduped on the (provider, providerRecordId) key. The extract's exact column names have not yet been confirmed against a live response (the key's quota was exhausted during development) -- field mapping reads a flexible set of likely header aliases and should be re-verified once a live extract can be pulled.",
    frequency: "Daily",
    scheduledFrequencyHours: 24,
    staleThresholdHours: 48,
    category: "Public API",
    engineeringEffort: "Medium",
    readinessStatus: "LIVE",
    endpoint: "/api/cron/sam-gov-exclusions-ingest",
  },
  {
    id: "usitc-trade-remedy",
    name: "USITC Trade Remedy Database (AD/CVD Orders)",
    powers: "AD/CVD scope screening, duty stack calculations",
    source: "usitc.gov/trade_remedy (HTML/CSV)",
    sourceUrl: "https://usitc.gov/trade_remedy",
    cost: "Free",
    refreshMethod:
      "Automated DOM scraper (Cheerio) and CSV stream parser. Lands in AdcvdOrder table. LLM-extracted rows staged as PENDING pending admin review before affecting duty stack.",
    frequency: "Weekly",
    scheduledFrequencyHours: 168,
    staleThresholdHours: 216,
    category: "Public API",
    engineeringEffort: "Medium",
    readinessStatus: "NOT_YET_IMPLEMENTED",
  },
  {
    id: "ace-port-codes",
    name: "ACE Port Codes",
    powers: "Pre-filing entry validation (valid port codes for ISF 10+2 and CBP Form 7501)",
    source: "CBP ACE Portal (Quarterly CSV)",
    sourceUrl: "https://www.cbp.gov/document/guidance/ace-port-codes",
    cost: "Free",
    refreshMethod:
      "Automated CSV downloader mapping 4-digit port codes, port names, transport modes, and field offices into AcePortCode reference table.",
    frequency: "Quarterly",
    scheduledFrequencyHours: 2160,
    staleThresholdHours: 2400,
    category: "Public API",
    engineeringEffort: "Low",
    readinessStatus: "NOT_YET_IMPLEMENTED",
  },
  {
    id: "cbp-import-statistics",
    name: "CBP Import Trade Trend Statistics",
    powers: "Audit population analytics benchmarks, macro volume profiling for risk scoring",
    source: "cbp.gov/trade/trade-community/import-statistics (Monthly XLSX)",
    sourceUrl: "https://www.cbp.gov/trade/trade-community/import-statistics",
    cost: "Free",
    refreshMethod:
      "Monthly XLSX report stream parser extracting entry counts, customs values, and duty totals into CbpImportTrend time-series table.",
    frequency: "Monthly",
    scheduledFrequencyHours: 720,
    staleThresholdHours: 800,
    category: "Public API",
    engineeringEffort: "Low",
    readinessStatus: "NOT_YET_IMPLEMENTED",
  },
  {
    id: "usitc-dataweb",
    name: "USITC DataWeb (Import Statistics)",
    powers: "Duty opportunity benchmarking, landed cost optimization",
    source: "dataweb.usitc.gov (REST API)",
    sourceUrl: "https://dataweb.usitc.gov/api/v1/imports",
    cost: "Free",
    refreshMethod:
      "REST API query transformer mapping HTS 10-digit code, country of origin, customs value, and calculated duties paid into WtoTariffRate/benchmark table.",
    frequency: "Monthly",
    scheduledFrequencyHours: 720,
    staleThresholdHours: 800,
    category: "Public API",
    engineeringEffort: "Low",
    readinessStatus: "NOT_YET_IMPLEMENTED",
  },
  {
    id: "wto-tariff-facility",
    name: "WTO Tariff Download Facility",
    powers: "Tariff scenario modeling (non-US sourcing alternatives, global trade agreement comparison)",
    source: "tariffdata.wto.org (Bulk CSV / API)",
    sourceUrl: "https://tariffdata.wto.org",
    cost: "Free",
    refreshMethod:
      "Bulk CSV converter mapping 6-digit HS subheadings, MFN bound/applied rates, and preferential rates for 160+ WTO members into WtoTariffRate table.",
    frequency: "Semi-Annually",
    scheduledFrequencyHours: 4380,
    staleThresholdHours: 5000,
    category: "Public API",
    engineeringEffort: "Medium",
    readinessStatus: "NOT_YET_IMPLEMENTED",
  },
  {
    id: "census-schedule-b",
    name: "Census Schedule B (Export Codes)",
    powers: "Export document intake, AES filing validation, duty drawback matching",
    source: "census.gov/foreign-trade/scheduleB (Annual text/CSV)",
    sourceUrl: "https://www.census.gov/foreign-trade/scheduleB",
    cost: "Free",
    refreshMethod:
      "Fixed-width text parser extracting 10-digit Schedule B numbers, descriptions, quantity units, and HTS concordance map into ScheduleBCode table.",
    frequency: "Annually (Jan + mid-year)",
    scheduledFrequencyHours: 8760,
    staleThresholdHours: 9500,
    category: "Public API",
    engineeringEffort: "Low",
    readinessStatus: "NOT_YET_IMPLEMENTED",
  },

  // ─── Group B: Free Public Documents — Custom Parsing Required ────────────────

  {
    id: "section-301-rates",
    name: "Section 301 Tariff Rates (Lists 1, 2, 3, 4A, 4B)",
    powers: "Duty stack (section301 layer), duty opportunity detection",
    source: "USTR Federal Register Annexes (PDF/HTML)",
    sourceUrl: "https://ustr.gov/issue-areas/enforcement/section-301-investigations",
    cost: "Free",
    refreshMethod:
      "PDF table extractor (Gemini OCR) parsing ~7,500 8/10-digit HTS codes mapped to Lists 1-4B and duty rates. Runs as Inngest background function. LLM-extracted rows staged as PENDING for admin review before affecting duty stack.",
    frequency: "Notice-Based / Weekly verification",
    scheduledFrequencyHours: 168,
    staleThresholdHours: 240,
    category: "Structured Document",
    engineeringEffort: "High",
    readinessStatus: "NOT_YET_IMPLEMENTED",
  },
  {
    id: "section-301-exclusions",
    name: "Section 301 Exclusions (Granted & Expired)",
    powers: "Duty opportunity detection, refund readiness, retroactive claim identification",
    source: "USTR + Federal Register Notices",
    sourceUrl: "https://ustr.gov/issue-areas/enforcement/section-301-investigations/section-301-exclusions",
    cost: "Free",
    refreshMethod:
      "Gemini LLM structured text parser extracting HTS codes, product description regex rules, and validity windows. Staged as PENDING for admin review. Auto-flags RefundOpportunity on approval.",
    frequency: "Real-Time / Daily",
    scheduledFrequencyHours: 24,
    staleThresholdHours: 48,
    category: "Structured Document",
    engineeringEffort: "High",
    readinessStatus: "NOT_YET_IMPLEMENTED",
  },
  {
    id: "section-232-rates",
    name: "Section 232 (Steel/Aluminum) Rates & Exclusions",
    powers: "Duty stack (section232 layer), steel/aluminum tariff compliance",
    source: "Department of Commerce BIS & Federal Register Notices",
    sourceUrl: "https://www.bis.doc.gov/index.php/232-auto",
    cost: "Free",
    refreshMethod:
      "HTML/CSV parser mapping 10-digit Steel (25%) and Aluminum (10%) HTS codes, country TRQs, and General Approved Exclusions into Section232Rate table.",
    frequency: "Weekly",
    scheduledFrequencyHours: 168,
    staleThresholdHours: 240,
    category: "Structured Document",
    engineeringEffort: "Medium",
    readinessStatus: "NOT_YET_IMPLEMENTED",
  },
  {
    id: "usmca-rules-origin",
    name: "USMCA Rules of Origin (Annex 4-B Tariff Shift Rules)",
    powers: "Trade agreement qualification engine (USMCA preference determination)",
    source: "USTR Published Agreement Text",
    sourceUrl: "https://ustr.gov/trade-agreements/free-trade-agreements/united-states-mexico-canada-agreement",
    cost: "Free",
    refreshMethod:
      "Complex text/regex parser extracting ~2,000 Product-Specific Rules (CC, CTH, CTSH, RVC %) into TradeAgreementRule table powering qualify/route.ts.",
    frequency: "Static Baseline / Annual Review",
    scheduledFrequencyHours: 8760,
    staleThresholdHours: 10000,
    category: "Structured Document",
    engineeringEffort: "Very High",
    readinessStatus: "NOT_YET_IMPLEMENTED",
  },
  {
    id: "cafta-dr-rules-origin",
    name: "CAFTA-DR Rules of Origin",
    powers: "Central America FTA qualification engine, duty-free preference validation",
    source: "USTR Agreement Text (Annex 4.1)",
    sourceUrl:
      "https://ustr.gov/trade-agreements/free-trade-agreements/cafta-dr-dominican-republic-central-america-fta",
    cost: "Free",
    refreshMethod:
      "Structured text parser converting tariff shift rules and RVC rules into decision trees stored in TradeAgreementRule table.",
    frequency: "Static Baseline / Annual Review",
    scheduledFrequencyHours: 8760,
    staleThresholdHours: 10000,
    category: "Structured Document",
    engineeringEffort: "High",
    readinessStatus: "NOT_YET_IMPLEMENTED",
  },
  {
    id: "ad-cvd-company-rates",
    name: "AD/CVD Company-Specific Rates",
    powers: "Duty stack calculation (adcvd layer, manufacturer-specific matching)",
    source: "Commerce ITAD Federal Register Annual Review Notices",
    sourceUrl: "https://access.trade.gov",
    cost: "Free",
    refreshMethod:
      "Gemini LLM tabular parser extracting Case Number, Manufacturer Name, Individual Rate %, and Period of Review. LLM-extracted rows staged as PENDING for admin review before flowing into duty calculations.",
    frequency: "Notice-Based / Weekly",
    scheduledFrequencyHours: 168,
    staleThresholdHours: 240,
    category: "Structured Document",
    engineeringEffort: "Very High",
    readinessStatus: "NOT_YET_IMPLEMENTED",
  },
  {
    id: "pga-requirements",
    name: "PGA Requirements by HTS",
    powers: "PGA screening, pre-filing document completeness checks (FDA, EPA, DOT, USDA, TTB)",
    source: "CBP ACE Reference Files (CATAIR Appendix PGA)",
    sourceUrl: "https://www.cbp.gov/trade/automated/catair",
    cost: "Free",
    refreshMethod:
      "Fixed-width text parser mapping 10-digit HTS codes to PGA agency flags and required form codes. Lands in reference table powering filingValidator.ts pre-checks.",
    frequency: "Quarterly",
    scheduledFrequencyHours: 2160,
    staleThresholdHours: 2400,
    category: "Structured Document",
    engineeringEffort: "Medium",
    readinessStatus: "NOT_YET_IMPLEMENTED",
  },

];

// ─── Runtime state from DB ────────────────────────────────────────────────────

export interface DatasetWithStatus extends DatasetDefinition {
  lastRun: string | null;
  lastRunStatus: "success" | "error" | "running" | null;
  lastRunDetails: string | null;
}

/**
 * Returns all dataset definitions merged with real last-run state from the
 * DatasetRefreshLog table. No hardcoded status strings.
 *
 * Gracefully degrades: if the DB query fails (e.g. table not yet migrated on
 * production), returns all static definitions with null last-run state so the
 * panel renders with dataset info rather than crashing with a 500.
 */
export async function getAllDatasetsWithStatus(): Promise<DatasetWithStatus[]> {
  let logByDatasetId = new Map<string, { completedAt: Date | null; status: string; errorMessage: string | null; summary: string | null }>();

  try {
    const logs = await db.datasetRefreshLog.findMany({
      where: {
        datasetId: { in: DATASET_DEFINITIONS.map((d) => d.id) },
      },
      orderBy: { startedAt: "desc" },
      distinct: ["datasetId"],
    });
    logByDatasetId = new Map(logs.map((l) => [l.datasetId, l]));
  } catch (err: any) {
    // Log but do not throw — the static registry is still useful even without
    // last-run history. This prevents a missing/not-yet-migrated
    // DatasetRefreshLog table from causing a 500 on the datasets endpoint.
    console.error(
      "[datasetRegistry] Failed to query DatasetRefreshLog — returning static definitions without last-run state.",
      err?.code ?? err?.message ?? err
    );
  }

  return DATASET_DEFINITIONS.map((def) => {
    const log = logByDatasetId.get(def.id);
    return {
      ...def,
      lastRun: log?.completedAt?.toISOString() ?? null,
      lastRunStatus: log
        ? log.status === "SUCCESS"
          ? "success"
          : log.status === "RUNNING"
          ? "running"
          : "error"
        : null,
      lastRunDetails: log?.errorMessage ?? log?.summary ?? null,
    };
  });
}

export function getDatasetById(id: string): DatasetDefinition | undefined {
  return DATASET_DEFINITIONS.find((d) => d.id === id);
}

/**
 * Triggers a real ingestion run for a LIVE dataset by calling its endpoint.
 * Writes a DatasetRefreshLog row for audit/staleness tracking.
 * Returns an error for NOT_YET_IMPLEMENTED datasets — never fakes success.
 */
export async function triggerDatasetRefresh(id: string): Promise<{
  success: boolean;
  message: string;
  logId?: string;
}> {
  const def = getDatasetById(id);
  if (!def) {
    return { success: false, message: `Dataset "${id}" not found in registry.` };
  }

  if (def.readinessStatus === "NOT_YET_IMPLEMENTED") {
    return {
      success: false,
      message: `Dataset "${def.name}" ingestion pipeline is not yet implemented. No data was fetched or written.`,
    };
  }

  if (!def.endpoint) {
    return {
      success: false,
      message: `Dataset "${def.name}" has no configured ingestion endpoint.`,
    };
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return {
      success: false,
      message: "CRON_SECRET is not configured on the server; ingestion endpoints cannot be triggered.",
    };
  }

  const alreadyRunning = await db.datasetRefreshLog.findFirst({
    where: { datasetId: id, status: "RUNNING" },
  });
  if (alreadyRunning) {
    return {
      success: false,
      message: `Dataset "${def.name}" already has a run in progress (started ${alreadyRunning.startedAt.toISOString()}).`,
    };
  }

  // Self-scheduled datasets (e.g. ofac-sdn) run as durable Inngest
  // background functions that own their own DatasetRefreshLog lifecycle.
  // Their endpoint only enqueues the job and returns immediately, so this
  // function must not create/close a RUNNING row around that call — doing
  // so would mark the row SUCCESS the instant the enqueue HTTP call
  // returns, long before the actual ingestion (which can take minutes)
  // has even started.
  if (def.selfScheduled) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const fullUrl = def.endpoint!.startsWith("http") ? def.endpoint! : `${baseUrl}${def.endpoint}`;
      const res = await fetch(fullUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${cronSecret}` },
      });
      const responseData = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorMsg = responseData.note || responseData.error?.message || `Endpoint returned HTTP ${res.status}`;
        return { success: false, message: errorMsg };
      }
      return { success: true, message: responseData.note || "Ingestion enqueued." };
    } catch (err: any) {
      return { success: false, message: err.message || "Failed to enqueue dataset refresh" };
    }
  }

  // Create a RUNNING log row
  const log = await db.datasetRefreshLog.create({
    data: {
      datasetId: id,
      datasetName: def.name,
      triggeredBy: "MANUAL",
      status: "RUNNING",
      startedAt: new Date(),
    },
  });

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const fullUrl = def.endpoint.startsWith("http") ? def.endpoint : `${baseUrl}${def.endpoint}`;

    const res = await fetch(fullUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${cronSecret}`,
      },
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || errorData.reason || `Endpoint returned HTTP ${res.status}`;
      await db.datasetRefreshLog.update({
        where: { id: log.id },
        data: { status: "FAILED", errorMessage: errorMsg, completedAt: new Date() },
      });
      return { success: false, message: errorMsg, logId: log.id };
    }

    const responseData = await res.json().catch(() => ({}));
    const summary = responseData.note || responseData.message || `Execution completed via ${def.endpoint}`;

    await db.datasetRefreshLog.update({
      where: { id: log.id },
      data: { status: "SUCCESS", summary, completedAt: new Date() },
    });

    return { success: true, message: summary, logId: log.id };
  } catch (err: any) {
    const errorMsg = err.message || "Unexpected error during dataset refresh";
    await db.datasetRefreshLog.update({
      where: { id: log.id },
      data: { status: "FAILED", errorMessage: errorMsg, completedAt: new Date() },
    });
    return { success: false, message: errorMsg, logId: log.id };
  }
}
