# 🚀 Qubere Platform Capabilities Guide

> **Mandatory Architecture Directive**: To maintain high code quality, consistent security, unified auditing, and operational excellence across the Qubere Monorepo (`apps/custom`, `apps/portal`, `apps/tms`), **ALL developers must consume shared platform capabilities** instead of re-implementing ad-hoc helper logic locally in individual modules.

---

## 📋 Table of Contents
1. [Unified Email Notification Capability (`PlatformEmailService`)](#1-unified-email-notification-capability)
2. [Unified Data Access & Tenant Isolation (`@qubere/db`)](#2-unified-data-access--tenant-isolation)
3. [Unified Authorization & Security Engine (`@qubere/auth`)](#3-unified-authorization--security-engine)
4. [Unified Binary Storage & Document Vault (`@qubere/storage`)](#4-unified-binary-storage--document-vault)
5. [Multimodal AI & Document Intelligence (`packages/ai` & `packages/assistant`)](#5-multimodal-ai--document-intelligence)
6. [Structured Audit Logging & Regulatory Compliance (`@qubere/db`)](#6-structured-audit-logging--regulatory-compliance)

---

## 1. Unified Email Notification Capability

### Module Location
- [`apps/custom/src/lib/email/platformEmailService.ts`](file:///Users/rachitlohani/Documents/GitHub/app-frontend/apps/custom/src/lib/email/platformEmailService.ts)

### Overview
`PlatformEmailService` is the single authorized platform capability for dispatching email notifications. Powered by **Resend API**, it automatically formats Apple-inspired HTML templates, injects deep links, handles environment routing, and logs delivery metrics.

### Key API Methods
```ts
import { PlatformEmailService } from "@/lib/email/platformEmailService";

// 1. Task Assignment Notification (Customer Requests, Actions)
await PlatformEmailService.sendTaskAssignmentNotification({
  toEmail: "porter@target.com",
  toName: "Porter TargetUser",
  taskTitle: "Upload Bill of Lading",
  actionId: "ACT-107",
  shipmentNumber: "SHP-TGT-2026-001",
  assignedByName: "Sarah Jenkins",
  targetUrl: "http://localhost:3002/requests/req_123",
});

// 2. Document Request Notification
await PlatformEmailService.sendDocumentRequestNotification({
  toEmail: "porter@target.com",
  documentType: "Commercial Invoice",
  shipmentRef: "SHP-TGT-2026-001",
  portalUrl: "http://localhost:3002/requests/req_123",
});

// 3. Raw Custom Email Dispatch
await PlatformEmailService.sendEmail({
  to: "user@domain.com",
  subject: "Custom Platform Alert",
  html: "<h2>Alert</h2><p>Body text</p>",
  fromName: "Qubere Trade Compliance",
});
```

---

## 2. Unified Data Access & Tenant Isolation

### Module Location
- [`packages/db`](file:///Users/rachitlohani/Documents/GitHub/app-frontend/packages/db)

### Overview
`@qubere/db` centralizes the Prisma schema, Supabase PostgreSQL pooler connections, data-mode scoping (`PRODUCTION` vs `DEMO`), and multi-tenant isolation (`accountId`, `clientId`).

### Key Capabilities & Best Practices
```ts
import { db, runWithAccountId, runWithDataMode } from "@/lib/db";

// Always filter by accountId & clientId for multi-tenant isolation
const customerRequests = await db.customerRequest.findMany({
  where: {
    accountId: ctx.accountId,
    clientId: ctx.effectiveClientId,
  },
  include: {
    assignedUser: { select: { id: true, email: true, firstName: true, lastName: true } },
    shipment: { select: { shipmentNumber: true } },
  },
});
```

---

## 3. Unified Authorization & Security Engine

### Module Location
- [`packages/auth`](file:///Users/rachitlohani/Documents/GitHub/app-frontend/packages/auth)

### Overview
`@qubere/auth` provides the unified RBAC authorization matrix, Clerk session resolver, and route-guard wrappers (`withAuthenticatedRoute`, `withPublicRoute`, `withCronRoute`).

### Usage Example
```ts
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";

export const POST = withAuthenticatedRoute(async ({ req, ctx }) => {
  // ctx automatically contains: ctx.userId, ctx.accountId, ctx.effectiveClientId, ctx.roleNames
  return NextResponse.json({ success: true });
});
```

---

## 4. Unified Binary Storage & Document Vault

### Module Location
- [`packages/storage`](file:///Users/rachitlohani/Documents/GitHub/app-frontend/packages/storage)

### Overview
`@qubere/storage` manages object storage across Vercel Blob and Google Cloud Storage (GCS), including signed upload token generation, file validation, and automatic malware screening.

### Usage Example
```ts
import { storeDocumentBytes } from "@qubere/storage";
import { signUploadToken } from "@/lib/uploadToken";

// Store document bytes into encrypted object storage
const result = await storeDocumentBytes({
  bytes: fileBuffer,
  fileName: "commercial_invoice.pdf",
  mimeType: "application/pdf",
  accountId: ctx.accountId,
});
```

---

## 5. Multimodal AI & Document Intelligence

### Module Location
- [`packages/ai`](file:///Users/rachitlohani/Documents/GitHub/app-frontend/packages/ai) & [`packages/assistant`](file:///Users/rachitlohani/Documents/GitHub/app-frontend/packages/assistant)

### Overview
Provides multimodal document parsing (IBM Docling), Gemini 3.6 Flash reasoning, entry summary hydration, and reasonable care compliance auditing.

---

## 6. Structured Audit Logging & Regulatory Compliance

### Module Location
- [`packages/db`](file:///Users/rachitlohani/Documents/GitHub/app-frontend/packages/db) & [`apps/custom/src/lib/logging`](file:///Users/rachitlohani/Documents/GitHub/app-frontend/apps/custom/src/lib/logging)

### Overview
Logs every mutating API request into `db.auditLog` to maintain regulatory audit trails required for CBP 19 U.S.C. § 1509 customs recordkeeping.

---

### Rule for New Feature Development
When adding any new feature or module to the Qubere repository:
1. **Check this guide first**: Verify if a platform capability already exists.
2. **Reuse Platform Services**: Always invoke `PlatformEmailService`, `@qubere/auth`, `@qubere/storage`, and `@qubere/db`.
3. **Do Not Re-invent**: Never build local email senders, ad-hoc authentication logic, or un-audited database queries inside individual page routes.
