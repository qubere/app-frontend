# From an inbound email to a transmitted customs filing

Run this in a DEMO or SANDBOX workspace. It does not depend on any specific
seed script — bring your own sample documents and it will work against
whatever shipments/workspace state already exists. Never run the live send
against a production inbound address.

Story arc: a document lands in an inbox no human is watching, the platform
reads it and shows its work, compliance screens it automatically before a
human ever sees it, a broker signs off, and the filing goes out — with a
full audit trail at every step.

## Sales conversation

**Open with:** "Nobody on your team should have to notice that an email
arrived. Show me the invoice, and I'll show you how it becomes a filed
entry without anyone re-typing a single field."

Ask where the team loses time today: watching a shared inbox, re-keying
invoice data into the filing, chasing a screening decision, or waiting on a
broker sign-off. Then demonstrate that specific handoff rather than the
whole tour.

| Customer question | What to demonstrate and say |
| --- | --- |
| "Do we lose the original document?" | Open the shipment's Documents tab — the source PDF is attached and stays the system of record; every extracted field links back to it. |
| "What stops a bad filing from going out automatically?" | Show the filing state machine: a filing cannot reach `Transmitted` without passing `ReadyForBrokerReview` → `BrokerApproved` first, and the preparer cannot be the approver. |
| "How do you catch restricted parties and controlled end-uses, not just sanctioned names?" | Open Compliance and show the keyword-rule categories (military end-use, nuclear/missile/chem-bio end-use, anti-boycott requests) running alongside restricted-party screening — not just a denied-party list match. |
| "Who is accountable if a filing is wrong?" | Point to `preparedByUserId`, `approvedByUserId`, and `transmittedByUserId` on the filing, and the execution/audit history panels in Compliance. |
| "Can this run per-client, not just per-company?" | Show that each client gets its own inbound address under Admin → Settings, so routing and later approvals are already scoped correctly. |

## Prepare

1. Pick (or create) one client/workspace to demo with, and have a sample
   commercial invoice or packing list PDF ready to send from your own email
   client.
2. Make sure you have two demo user logins available — one to prepare the
   filing, one to approve it. The approval step deliberately blocks a single
   user from doing both.
3. Note the client's inbound address in advance (Admin → Settings →
   Inbound email addresses) so you're not searching for it live.

## Walkthrough

1. **Show the front door.** Go to `/app/admin/settings` and open the
   inbound-email configuration. Copy the client's dedicated inbound address.
   Say: "This is the only thing your client-facing team needs to give a
   forwarder or customer — one address per client."

2. **Send the document.** From your own email client, send the sample
   invoice to that address. Narrate that behind the scenes it lands on a
   webhook, gets scanned before anything else touches it, and is routed to
   the right client/shipment context — nothing unscanned is ever accepted.

3. **Show it arrive.** Open `/app/documents` (or `/app/documents/inbound-review`
   if the match is ambiguous). Point out the document is tagged as received
   by email, with the sender visible. If the shipment match is clear it
   attaches automatically; if not, the reviewer explicitly picks the
   shipment rather than the system guessing.

4. **Show extraction with evidence, not a black box.** Open the matched
   shipment (`/app/shipments/[id]`) and the document field review panel.
   Each extracted field (HS code, value, weight, parties, etc.) shows the
   source document it came from. A reviewer approves fields here — approval
   is recorded per field, not just "document processed."

5. **Show compliance screening happen without anyone asking for it.** Open
   `/app/compliance`. Show that the shipment's parties and description were
   already screened: restricted-party matches, plus keyword-based gating for
   controlled end-uses (military, nuclear/missile/chem-bio/rocket-UAV) and
   anti-boycott language. If something needs a human, it surfaces as a
   review item — it does not silently pass or silently block. Point to
   Execution History / Audit History if asked about defensibility.

6. **Create or open the filing.** Go to `/app/filing/new` (or open an
   existing draft at `/app/filing/[id]`) built from that reviewed shipment.
   Walk through the filing detail screen showing it in `Draft`/`Preparing`
   status, with the extracted, approved data already populated.

7. **Move it to broker review.** Advance the filing to `ReadyForBrokerReview`.
   Explain this is the gate: nothing reaches a broker until preparation and
   screening are both satisfied.

8. **Switch users and approve.** Log in as the second demo user (the
   broker) and approve the filing from `/app/filing/[id]`. Call out that the
   system enforces maker/checker segregation — the same account that
   prepared it cannot approve it — and the approval is stamped with
   `approvedByUserId`.

9. **Transmit.** From the same filing detail screen, transmit the filing.
   Show the status move from `BrokerApproved` → `TransmissionPending` →
   `Transmitted`, and mention the later states (`Accepted`, `CustomsHold`,
   `Released`, etc.) that the same screen will reflect once customs
   responds.

10. **Close on the audit trail.** Scroll back through the filing detail and
    Compliance's audit history to show the unbroken chain: which email came
    in, which fields were approved and by whom, which screening rules ran,
    who approved the filing, who transmitted it, and when.

## If asked about the parts that aren't live-clickable

- **Restricted-party list refreshes** (including the Dow Jones feed) are a
  backend/data-admin operation (`/platform-admin`), not something a filer
  triggers per shipment — screening always runs against whatever list
  version is currently loaded. Frame it as "the list update is invisible
  infrastructure; the screening result is what your team sees."
- **Malware scanning and quarantine** happen before a document is even
  visible in the app. If a document doesn't show up, that's the place to
  check (`/platform-admin` quarantine panel), not the inbound-review queue.

## Recovering if a step doesn't go as expected

- If the emailed document doesn't appear within a minute or two, don't
  stall on it live — the inbound worker runs on a short poll, not
  instantly. Have a fallback: a document already sitting in
  `/app/documents/inbound-review` from earlier in the day.
- If the shipment match is ambiguous when you didn't intend it to be, use
  that as the ambiguous-match story instead of treating it as a failure —
  it's the same feature.
- If you don't have a second user handy for the broker step, narrate the
  maker/checker rule against the single-user session rather than skipping
  it silently — customers ask about this rule specifically.
