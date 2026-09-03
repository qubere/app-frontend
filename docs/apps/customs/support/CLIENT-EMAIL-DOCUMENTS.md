# Send and review client documents by email

Each client has a document email address when the feature is enabled for the
workspace. The destination identifies the client. Clean attachments enter document
processing, and a single confident shipment match can attach automatically.
Unknown senders and uncertain matches require a broker decision.

## Send documents as a customer

1. Open **Setup** or **Documents** in the portal. Copy the address labeled with the
   correct client. If you have access to several clients, choose that client's
   address each time. If no address appears, ask your broker for the current one.
2. Send or forward the document as an attachment. Include the shipment number in
   the subject or message when you have it. Send to one client destination per email.
3. Open **Documents** to check the emailed file and its status. Processing is
   asynchronous; sending an email does not mean its contents are approved for filing.

| Status | Meaning | Your next step |
| --- | --- | --- |
| Processing | The received file is not yet attached and has no open broker review item. | Check again after processing; contact your broker if it remains there. |
| With your broker | The file needs a broker decision, such as checking the sender or shipment. | Let your broker verify it; provide the shipment reference if requested. |
| Attached to a shipment | The file has a shipment link. Extraction and filing review are separate. | Check the shipment number and tell your broker if it is incorrect. |

Only customer-visible files for your assigned clients appear. A sender held under
**Approved senders only** has no downloaded attachment to show until the broker
approves the email and scanning succeeds. Internal and discarded inbound files
are hidden. An optional email receipt is not a guarantee of successful attachment
or filing approval; receipt emails may be disabled or suppressed.

## Review an email as a broker

Open **Documents → Email review** (`/app/documents/inbound-review`), or use
**Open email review** on a client's document address card to start with that client.
Reading the queue requires document read access; decisions require document update
access.

1. Select an item. Check its client, sender and received time before acting.
2. Use **Preview document** when a file is available. Compare the actual document
   with **Matching evidence**, including the shipment number and matched identifiers.
3. Follow the action for the reason below. Shipment selection starts empty. Search
   by shipment number if necessary; only shipments for the current client are offered.
4. Select the verified shipment and choose **Attach document**. Continue the normal
   extraction and filing review; attachment alone does not approve the contents.

| Queue reason | What to check and do |
| --- | --- |
| Check sender — file available | Verify the sender and preview the clean file. Select the shipment and attach only after verifying both. The decision applies to this item. |
| Check sender — email held | Verify the sender and email context. **Approve email and scan attachments** releases this email for scanning. There is no file preview yet. Approval does not bypass scanning or guarantee a shipment match. |
| Multiple shipment matches | Compare each candidate's identifiers with the source document. Select the correct shipment only when the evidence supports it. |
| Confirm shipment / Choose shipment | Search for the correct shipment and verify the client and reference. Leave the item open if there is insufficient information. |
| Document could not be read | Preview the original and obtain a clearer document if needed. Do not treat a shipment attachment as a repair of failed extraction. |

Approving or attaching one item does not add its sender to the permanent approved
list. An administrator manages that list separately in **Document Email**.

### Wrong client or unwanted document

- **Wrong client? → Reassign…** moves an unattached document to another client in
  the same workspace after confirmation. Reopen the item and select a shipment
  for that client. The original destination remains in audit history, and existing
  document visibility is preserved: an internal operations file stays internal.
  If you opened a client-filtered queue, the reassigned item moves out of that view.
- **Discard…** requires confirmation. The item leaves the queue and is excluded
  from filing use; a discarded document is hidden from the portal. Its audit
  history remains. Discarding an item does not create a permanent sender block.

## Manage addresses and sender policy

Open **Manage Account → Document Email** (`/app/admin/settings`) or the client's
address card. Address administration requires settings management access. Copy the
current address from its client row; use **Manage** to change policy or lifecycle.

| Sender policy | Unknown sender behavior |
| --- | --- |
| Review new senders (default) | Clean files are stored and customer-visible, but wait for a sender/shipment decision in Email review. |
| Approved senders only | The email is held before attachment download or storage. The broker can approve that email for scanning. |
| Any sender | Nonblocked senders can enter processing after a clean scan. Uncertain shipment matches still require review. |

Blocked sender rules take precedence under every policy. **Add approved sender**
authorizes the address's destination; it does not decide the client or guarantee
an automatic shipment attachment.

| Address action | Effect |
| --- | --- |
| Regenerate address… | Creates a new address. The previous address continues accepting documents for 30 days; distribute the new one before that grace ends. |
| Suspend… / Resume | Suspension rejects new emails immediately. Resume enables the address again. |
| Revoke… | Permanently rejects new emails to that address. Use a new address for future intake. |

The receipt checkbox works only when deployment-level automatic replies are also
enabled. It does not control portal document visibility.

## Review Entry Proof after new evidence

When an emailed document is attached to a shipment with published Entry Proof,
Qubere generates a new **DRAFT** with a reference to that document. Open the filing
when the proof is marked out of date, review the evidence and changes, and publish
only when ready. The customer keeps seeing the previous published proof until
then. Email intake never automatically publishes proof or submits a filing.

## When something is missing

| Symptom | First check |
| --- | --- |
| No client address in the portal | Confirm client assignment and an active address with the broker. An administrator must enable the feature in both apps. |
| Email sent but no file visible | Confirm the current client destination and sender policy. The email may be held before download, or scanning may have rejected an attachment. |
| No suitable shipment in the review list | Verify the item's client, then search by shipment number. Use Reassign only if the client itself is wrong. |
| Processing does not advance | Ask the administrator to check the scanner, storage, parser worker and inbound recovery job. Repeatedly forwarding the file can create separate emails. |
| No receipt email | Replies may be off, suppressed or failed. Check portal status or ask the broker instead of using the receipt as proof of processing. |

Administrator reference: [rollout, diagnostics and rollback](../../../operations/CLIENT-EMAIL-INGESTION-ROLLOUT.md).
Seller reference: [synthetic demo and expected outcomes](../../../sales/CLIENT-EMAIL-INGESTION-DEMO.md).
