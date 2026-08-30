import type { Metadata } from "next";
import { LegalPageShell } from "@/components/LegalPageShell";

export const metadata: Metadata = {
  title: "Terms of Service & End User License Agreement — Qubere",
  description:
    "The terms governing access to and use of the Qubere trade-compliance and logistics platform, including use of third-party integrations such as QuickBooks Online.",
};

const LAST_UPDATED = "August 29, 2026";

export default function TermsPage() {
  return (
    <LegalPageShell
      title="Terms of Service & End User License Agreement"
      lastUpdated={LAST_UPDATED}
      intro={
        <p>
          These Terms of Service and End User License Agreement (the &ldquo;Terms&rdquo;) are a
          binding agreement between Qubere, Inc. (&ldquo;Qubere,&rdquo; &ldquo;we,&rdquo; or
          &ldquo;us&rdquo;) and the entity or person that accesses or uses the Qubere platform,
          websites, applications, and APIs (collectively, the &ldquo;Services&rdquo;). By creating
          an account, accessing, or using the Services, you agree to these Terms. If you use the
          Services on behalf of an organization, you represent that you are authorized to bind that
          organization.
        </p>
      }
    >
      <p>
        <strong>Draft for review.</strong> This document is a working draft prepared to support
        third-party application review (including the Intuit Developer portal). A negotiated master
        services agreement or order form, where one exists, controls over these Terms. This
        document should be reviewed and approved by qualified legal counsel before it is relied
        upon.
      </p>

      <h2>1. Definitions</h2>
      <ul>
        <li>
          <strong>&ldquo;Customer Data&rdquo;</strong> means data and content that you or your
          users submit to the Services or that the Services collect from systems you connect.
        </li>
        <li>
          <strong>&ldquo;Third-Party Services&rdquo;</strong> means products or services not
          provided by Qubere that you choose to integrate with the Services, including QuickBooks
          Online and other accounting, ERP, and logistics systems.
        </li>
      </ul>

      <h2>2. License grant</h2>
      <p>
        Subject to these Terms and payment of applicable fees, Qubere grants you a limited,
        non-exclusive, non-transferable, non-sublicensable, revocable right to access and use the
        Services during the subscription term solely for your internal business purposes.
      </p>

      <h2>3. Accounts and security</h2>
      <p>
        You must provide accurate registration information and keep it current. You are responsible
        for all activity under your accounts and for maintaining the confidentiality of
        credentials. Notify us promptly of any unauthorized use at{" "}
        <a href="mailto:security@qubere.ai">security@qubere.ai</a>.
      </p>

      <h2>4. Acceptable use</h2>
      <p>You will not, and will not permit any user or third party to:</p>
      <ul>
        <li>use the Services in violation of applicable law or these Terms;</li>
        <li>
          reverse engineer, decompile, or attempt to derive source code or underlying models,
          except as permitted by law;
        </li>
        <li>
          resell, sublicense, or provide the Services to third parties except as expressly
          permitted;
        </li>
        <li>
          probe, scan, or test the vulnerability of the Services, or circumvent security or
          authentication;
        </li>
        <li>
          introduce malware, or use the Services to store or transmit infringing, defamatory, or
          unlawful material;
        </li>
        <li>
          use the Services to build a competing product, or to benchmark without our prior written
          consent;
        </li>
        <li>
          exceed rate limits or use automated means to access the Services other than through
          documented APIs.
        </li>
      </ul>

      <h2>5. Customer Data</h2>
      <p>
        As between the parties, you own all right, title, and interest in Customer Data. You grant
        Qubere a worldwide, non-exclusive license to host, copy, process, transmit, and display
        Customer Data as necessary to provide, secure, and improve the Services and as otherwise
        permitted in our{" "}
        <a href="/privacy">Privacy Policy</a>. You are responsible for the accuracy, quality, and
        legality of Customer Data and for having the necessary rights to provide it to us.
      </p>

      <h2>6. Third-Party Services and QuickBooks Online</h2>
      <p>
        The Services can interoperate with Third-Party Services. Your use of any Third-Party
        Service is governed by that provider&rsquo;s terms and privacy policy, not these Terms.
        Specifically, use of the QuickBooks Online integration is subject to the Intuit Terms of
        Service and Intuit&rsquo;s privacy statements.
      </p>
      <ul>
        <li>
          You authorize Qubere to access and exchange data with a Third-Party Service on your
          behalf when you connect it, and to store the credentials or tokens needed to do so.
        </li>
        <li>
          Qubere is not responsible for the availability, accuracy, or acts or omissions of any
          Third-Party Service, or for changes a provider makes to its APIs.
        </li>
        <li>
          You may disconnect an integration at any time; disconnection may reduce or disable
          related functionality.
        </li>
      </ul>

      <h2>7. Not legal, customs, or financial advice</h2>
      <p>
        The Services provide software tools to help you organize trade, compliance, logistics, and
        billing information. The Services do not constitute legal advice, customs brokerage
        services, tax advice, or accounting advice, and Qubere is not acting as your licensed
        customs broker, attorney, or accountant unless expressly agreed in a separate written
        agreement. You are solely responsible for the accuracy and completeness of any customs
        declaration, entry, filing, invoice, or financial record you submit to any government
        authority or third party, and for retaining qualified professionals as appropriate.
        Outputs generated with automated or AI-assisted features may contain errors and must be
        reviewed by a qualified person before use.
      </p>

      <h2>8. Fees</h2>
      <p>
        Fees, billing frequency, and payment terms are set out in the applicable order form or
        subscription plan. Unless stated otherwise, fees are non-refundable, due within [30] days
        of invoice, and exclusive of taxes.
      </p>

      <h2>9. Confidentiality</h2>
      <p>
        Each party will protect the other&rsquo;s Confidential Information with at least reasonable
        care and use it only to perform under these Terms. This section does not apply to
        information that is public through no fault of the receiving party, independently
        developed, or rightfully received from a third party.
      </p>

      <h2>10. Intellectual property</h2>
      <p>
        Qubere and its licensors retain all right, title, and interest in the Services, including
        all software, models, and documentation, and all improvements to them. Feedback you provide
        may be used by Qubere without restriction or obligation.
      </p>

      <h2>11. Warranty disclaimer</h2>
      <p>
        EXCEPT AS EXPRESSLY STATED IN A SEPARATE WRITTEN AGREEMENT, THE SERVICES ARE PROVIDED
        &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND, WHETHER
        EXPRESS, IMPLIED, OR STATUTORY, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR
        A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. QUBERE DOES NOT WARRANT THAT THE SERVICES
        WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE, OR THAT DATA FROM THIRD-PARTY SERVICES WILL BE
        ACCURATE OR COMPLETE.
      </p>

      <h2>12. Limitation of liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEITHER PARTY WILL BE LIABLE FOR ANY INDIRECT,
        INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, REVENUE, OR
        DATA, ARISING OUT OF OR RELATED TO THESE TERMS. EACH PARTY&rsquo;S TOTAL AGGREGATE LIABILITY
        ARISING OUT OF OR RELATED TO THESE TERMS WILL NOT EXCEED THE AMOUNTS PAID OR PAYABLE BY YOU
        TO QUBERE FOR THE SERVICES IN THE 12 MONTHS BEFORE THE EVENT GIVING RISE TO THE LIABILITY.
      </p>

      <h2>13. Indemnification</h2>
      <p>
        You will defend and indemnify Qubere against third-party claims arising from Customer Data,
        your use of the Services in violation of these Terms, or your violation of applicable law or
        third-party rights, except to the extent caused by Qubere.
      </p>

      <h2>14. Term and termination</h2>
      <p>
        These Terms apply while you have an account or use the Services. Either party may terminate
        for material breach not cured within [30] days of notice. We may suspend access immediately
        for security risks, non-payment, or violations of Section 4. On termination, your right to
        use the Services ends; you may export Customer Data during a [30]-day window, after which we
        may delete it.
      </p>

      <h2>15. Changes</h2>
      <p>
        We may modify the Services or these Terms. If we make material changes to these Terms, we
        will provide notice through the Services or by email. Changes take effect on the stated
        effective date; continued use after that date constitutes acceptance.
      </p>

      <h2>16. Governing law and disputes</h2>
      <p>
        These Terms are governed by the laws of the State of [Delaware], excluding its conflict-of-
        laws rules. The state and federal courts located in [Delaware] have exclusive jurisdiction,
        and each party consents to venue there, except that either party may seek injunctive relief
        in any court of competent jurisdiction.
      </p>

      <h2>17. General</h2>
      <p>
        These Terms, together with any order form and the Privacy Policy, are the entire agreement
        on this subject. If any provision is unenforceable, the rest remains in effect. Neither
        party may assign these Terms without the other&rsquo;s consent, except to a successor in a
        merger or sale of substantially all assets. Failure to enforce a provision is not a waiver.
      </p>

      <h2>18. Contact</h2>
      <p>
        Qubere, Inc. — <a href="mailto:legal@qubere.ai">legal@qubere.ai</a> — [registered address].
      </p>
    </LegalPageShell>
  );
}
