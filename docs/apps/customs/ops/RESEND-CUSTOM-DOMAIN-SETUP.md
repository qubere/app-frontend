# 📧 Setting Up Custom Domain (`mail.qubere.ai`) for Resend & Cloudflare

Follow this 5-minute guide to configure **`mail.qubere.ai`** as the official sending domain for all Qubere platform emails.

For receiving client documents, use the
[client email rollout guide](../../../operations/CLIENT-EMAIL-INGESTION-ROLLOUT.md).
It covers the inbound domain, signed webhook, client addresses and scanner/worker
requirements. Configuring a sending domain alone does not enable client intake.

---

## Step 1: Add Domain in Resend Dashboard

1. Log into your [Resend Dashboard](https://resend.com/domains).
2. Click **Add Domain**.
3. Enter Domain: **`mail.qubere.ai`** (or `qubere.ai`).
4. Region: **US (us-east-1)**.
5. Click **Add**.

---

## Step 2: Add DNS Records in Cloudflare

Log into your **Cloudflare Dashboard** -> Select `qubere.ai` -> Go to **DNS Records** -> Click **Add Record**:

### 1. DKIM Record (DomainKey Identified Mail)
- **Type**: `TXT`
- **Name**: `resend._domainkey.mail`
- **Content**: *(Copy exact `p=MIGf...` string provided in Resend dashboard)*
- **TTL**: `Auto`
- **Proxy Status**: **DNS Only** *(Gray Cloud ☁️ - Do NOT enable Cloudflare Proxy)*

### 2. SPF Record (Sender Policy Framework)
- **Type**: `MX`
- **Name**: `mail`
- **Server / Value**: `feedback-smtp.us-east-1.amazonses.com`
- **Priority**: `10`
- **Proxy Status**: **DNS Only** *(Gray Cloud ☁️)*

*(Optional fallback SPF TXT Record if requested by Resend)*:
- **Type**: `TXT`
- **Name**: `mail`
- **Content**: `v=spf1 include:amazonses.com ~all`

### 3. DMARC Record (Domain-based Message Authentication)
- **Type**: `TXT`
- **Name**: `_dmarc.mail`
- **Content**: `v=DMARC1; p=none;`

---

## Step 3: Verify Domain in Resend

1. Go back to [Resend Domains](https://resend.com/domains).
2. Click **Verify Domain**.
3. Once verified, the status will show **`Verified`** ✅.

---

## Step 4: Update Environment Variables in Qubere

Update `RESEND_FROM_ADDRESS` in `.env`, `.env.local`, and GCP Secret Manager:

```env
RESEND_FROM_ADDRESS="notifications@mail.qubere.ai"
```

Once updated, all task assignment notifications, document requests, and compliance alerts will deliver from:
**`Qubere Trade Compliance <notifications@mail.qubere.ai>`** 🎉
