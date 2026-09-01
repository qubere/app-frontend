## Automated product-help review

This PR was drafted from the exact product diff of a merge to `main`.

Review the release note in `docs/product-help/releases/` and verify every proposed Q&A against the merged application. The generated corpus is not published to users until this PR is approved and merged.

### Review checklist

- [ ] Questions describe real customer tasks, not implementation details or planned work.
- [ ] Answers and steps match the current UI.
- [ ] Links land on the correct workspace.
- [ ] Compliance, filing, classification, and other regulated actions retain human review boundaries.
- [ ] Removed guides correspond to capabilities that were actually removed.

After merge, the release workflow validates the corpus and republishes it to PostgreSQL/pgvector.
