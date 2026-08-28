-- Data-only migration: populates CITATION_TEXT for the US -> Syria direct
-- embargo row per BIS/DOS guidance current as of the "Relaxing Export
-- Controls for Syria" rule (eff. Sept. 2, 2025, doc. 2025-16724). Scoped by
-- cycy_seq (the known legacy row for this pair, from
-- country_by_country_maps.sql) so this never touches any other row, and is
-- safe to re-run.
--
-- NOTE: the underlying CYCY_IND_EMBARGOED='Y' flag on this row is left
-- unchanged -- BIS still requires a license for most EAR items to Syria
-- (License Exception SPP only covers EAR99 + a subset under 15 CFR
-- 746.9(b)), so a direct-embargo HIT with citation context is the correct
-- behavior, not a CLEAR.

UPDATE "country_by_country_maps"
SET "CITATION_TEXT" = 'BIS (EAR): Syria is listed under Country Group E:1 (Terrorist-Supporting Countries; Supp. No. 1 to 15 CFR Part 740). A license is required for export/reexport of all EAR-subject items except EAR99 food and medicine. License Exception SPP (15 CFR 740.5) authorizes EAR99 items; limited additional exceptions under 15 CFR 746.9(b). Part 744 end-use/end-user/restricted-party controls still apply. See "Relaxing Export Controls for Syria," eff. Sept. 2, 2025 (doc. 2025-16724). DOS (ITAR): Syria is a proscribed destination (22 CFR 126.1) and a State Sponsor of Terrorism; export/reexport of defense articles and services requires DDTC license/approval, subject to a policy of denial. Imports: OFAC lifted country-level import sanctions via General License 25; a DOS import sanction on defense articles/services remains.'
WHERE "cycy_seq" = 58348
  AND "CITATION_TEXT" IS NULL;
