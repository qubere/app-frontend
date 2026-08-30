import type { Metadata } from "next";
import { LegalPageShell } from "@/components/LegalPageShell";

export const metadata: Metadata = {
  title: "Privacy Policy — Qubere",
  description:
    "How Qubere, Inc. collects, uses, stores, and protects personal information and third-party data, including data accessed from QuickBooks Online.",
};

const LAST_UPDATED = "August 29, 2026";

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell
      title="Privacy Policy"
      lastUpdated={LAST_UPDATED}
      intro={
        <p>
          This Privacy Policy explains how Qubere, Inc. (&ldquo;Qubere,&rdquo; &ldquo;we,&rdquo;
          &ldquo;us,&rdquo; or &ldquo;our&rdquo;) collects, uses, discloses, and safeguards
          information in connection with the Qubere trade-compliance and logistics platform and
          related websites, applications, and APIs (collectively, the &ldquo;Services&rdquo;). It
          also describes the rights and choices available to individuals regarding their
          information.
        </p>
      }
    >
      <p>
        <strong>Draft for review.</strong> This document is a working draft prepared to support
        third-party application review (including the Intuit Developer portal). It should be
        reviewed and approved by qualified legal counsel before it is relied upon.
      </p>

      <h2>1. Who we are and how to contact us</h2>
      <p>
        The data controller is Qubere, Inc., [registered address]. For privacy questions,
        requests, or complaints, contact us at{" "}
        <a href="mailto:privacy@qubere.ai">privacy@qubere.ai</a>.
      </p>

      <h2>2. Scope</h2>
      <p>
        This policy applies to information we process as a <strong>controller</strong> — for
        example, information about the representatives of our customers and prospects, and visitors
        to our website. When our customers use the Services to process data about their own
        customers, shipments, suppliers, and financial records, we act as a{" "}
        <strong>processor</strong> on the customer&rsquo;s behalf, and that processing is governed
        by our agreement with the customer.
      </p>

      <h2>3. Information we collect</h2>
      <h3>3.1 Information you provide</h3>
      <ul>
        <li>
          <strong>Account and profile data</strong> — name, work email, phone number, employer,
          role, and authentication identifiers.
        </li>
        <li>
          <strong>Customer content</strong> — commercial invoices, packing lists, product and
          classification data, party master records, shipment and entry data, billing and rate
          data, and documents you upload or generate in the Services.
        </li>
        <li>
          <strong>Support and communications</strong> — messages, feedback, and correspondence you
          send us.
        </li>
      </ul>
      <h3>3.2 Information from connected third-party services</h3>
      <p>
        When you connect a third-party system to the Services, we receive data from that system as
        directed by you. This includes:
      </p>
      <ul>
        <li>
          <strong>QuickBooks Online / Intuit.</strong> With your authorization via Intuit&rsquo;s
          OAuth 2.0 flow, we access your QuickBooks company (realm) identifier, company profile,
          and the accounting records needed to synchronize billing — including customers, items,
          accounts, tax codes, invoices, and payments. We request the{" "}
          <code>com.intuit.quickbooks.accounting</code> scope only.
        </li>
        <li>
          <strong>Other integrations</strong> — ERP, transportation, tracking, and accounting
          providers you choose to connect, limited to the data required for the feature you enable.
        </li>
      </ul>
      <h3>3.3 Information collected automatically</h3>
      <ul>
        <li>
          <strong>Usage and log data</strong> — IP address, device and browser type, pages and
          features used, timestamps, referring URLs, and diagnostic/error data.
        </li>
        <li>
          <strong>Cookies and similar technologies</strong> — used for authentication, security,
          preferences, and aggregate analytics. We do not use advertising cookies.
        </li>
      </ul>

      <h2>4. How we use information</h2>
      <ul>
        <li>Provide, operate, secure, and maintain the Services.</li>
        <li>
          Synchronize records between the Services and systems you connect (for example, creating
          or updating invoices, customers, and payments in QuickBooks Online at your direction).
        </li>
        <li>Authenticate users, prevent fraud and abuse, and enforce our terms.</li>
        <li>Provide customer support and respond to requests.</li>
        <li>
          Monitor, troubleshoot, and improve the Services, including aggregated and de-identified
          analytics.
        </li>
        <li>Comply with legal obligations and enforce our legal rights.</li>
      </ul>
      <p>
        Where required by law, our legal bases for processing are performance of a contract,
        legitimate interests (operating and improving the Services and keeping them secure),
        consent (where requested), and compliance with legal obligations.
      </p>

      <h2>5. Use of Intuit / QuickBooks Online data</h2>
      <p>We specifically commit that:</p>
      <ul>
        <li>
          We access QuickBooks data only to provide user-requested functionality (billing
          synchronization and reconciliation).
        </li>
        <li>
          We do not use Intuit data for advertising, and we do not sell or rent Intuit data.
        </li>
        <li>
          We store the minimum QuickBooks data necessary to operate the integration and to show
          you sync history; OAuth tokens are encrypted at rest.
        </li>
        <li>
          When you disconnect QuickBooks, or on request, we revoke the connection and delete or
          de-identify the associated tokens and cached QuickBooks records within [30] days, except
          where retention is required for legal or audit purposes.
        </li>
        <li>
          Our processing of Intuit data complies with the Intuit Developer and API Terms of
          Service.
        </li>
      </ul>

      <h2>6. How we disclose information</h2>
      <p>We do not sell personal information. We disclose information to:</p>
      <ul>
        <li>
          <strong>Service providers / subprocessors</strong> that process data on our behalf under
          contract — including cloud hosting and infrastructure, database hosting, error and
          performance monitoring, email delivery, and AI/document-processing providers used to
          power platform features. A current list is available at [subprocessors URL] or on
          request.
        </li>
        <li>
          <strong>Systems you connect</strong>, such as QuickBooks Online, when you direct data to
          be sent there.
        </li>
        <li>
          <strong>Legal and safety</strong> — to comply with law, legal process, or lawful
          requests; to enforce agreements; or to protect the rights, property, or safety of
          Qubere, our users, or the public.
        </li>
        <li>
          <strong>Corporate transactions</strong> — in connection with a merger, acquisition,
          financing, or sale of assets, subject to this policy.
        </li>
      </ul>

      <h2>7. International transfers</h2>
      <p>
        We are based in the United States and may process information in the United States and
        other countries. Where we transfer personal data from the EEA, UK, or Switzerland, we rely
        on appropriate safeguards such as the Standard Contractual Clauses.
      </p>

      <h2>8. Data retention</h2>
      <p>
        We retain personal information for as long as needed to provide the Services, comply with
        legal obligations, resolve disputes, and enforce agreements. Customer content is retained
        per our customer agreement; upon termination, customer content is deleted or returned
        within the period stated in that agreement. Backups are purged on a rolling schedule.
      </p>

      <h2>9. Security</h2>
      <p>
        We use administrative, technical, and physical safeguards designed to protect information,
        including encryption in transit (TLS) and at rest, tenant isolation, least-privilege access
        controls, audit logging, and monitoring. No method of transmission or storage is completely
        secure.
      </p>

      <h2>10. Your rights and choices</h2>
      <p>
        Depending on your location, you may have the right to access, correct, delete, or port
        your personal information; to object to or restrict certain processing; and to withdraw
        consent. To exercise these rights, contact{" "}
        <a href="mailto:privacy@qubere.ai">privacy@qubere.ai</a>. If we process your information on
        behalf of a customer, we will refer your request to that customer. You may also have the
        right to lodge a complaint with a supervisory authority.
      </p>
      <p>
        <strong>US state privacy rights.</strong> Residents of California and other US states with
        comprehensive privacy laws may exercise the rights described above. We do not
        &ldquo;sell&rdquo; or &ldquo;share&rdquo; personal information for cross-context behavioral
        advertising.
      </p>

      <h2>11. Children&rsquo;s privacy</h2>
      <p>
        The Services are intended for business use and are not directed to children under 16. We do
        not knowingly collect personal information from children.
      </p>

      <h2>12. Changes to this policy</h2>
      <p>
        We may update this policy from time to time. If we make material changes, we will provide
        notice through the Services or by other means. The &ldquo;Last updated&rdquo; date above
        indicates when this policy was last revised.
      </p>

      <h2>13. Contact</h2>
      <p>
        Qubere, Inc. — <a href="mailto:privacy@qubere.ai">privacy@qubere.ai</a> — [registered
        address].
      </p>
    </LegalPageShell>
  );
}
