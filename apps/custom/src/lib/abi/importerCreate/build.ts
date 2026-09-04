// Build a complete 5106 Importer/Consignee Create/Update ABI transaction string.
// Application Identifier TP (see Batch & Block Control chapter for B-record wrapping).
// Source: docs/plans/catair-source-docs/19-importer-consignee-create-update-5106-v12.pdf

import { encodeRecord } from "@/lib/abi/fixedWidth";
import type { ImporterCreateInput } from "./types";
import {
  RECORD_T1_SPEC,
  RECORD_TA_SPEC,
  RECORD_T2_SPEC,
  RECORD_T3_SPEC,
  RECORD_TB_SPEC,
  RECORD_TC_SPEC,
  RECORD_TD_SPEC,
  RECORD_TE_SPEC,
  RECORD_TF_SPEC,
  RECORD_TG_SPEC,
  RECORD_TH_SPEC,
  RECORD_TI_SPEC,
  RECORD_TJ_SPEC,
  RECORD_TK_SPEC,
  RECORD_TL_SPEC,
  RECORD_TM_SPEC,
  RECORD_TN_SPEC,
} from "./recordSpecs";

const OVERFLOW_MAX = 70;

/** Truncate a string to `max` chars and return the remainder (overflow), or "" if it fits. */
function splitOverflow(value: string, max: number): { head: string; tail: string } {
  const upper = value.toUpperCase();
  return { head: upper.slice(0, max), tail: upper.slice(max) };
}

/**
 * Build an ordered list of 80-char ABI lines for one 5106 Create/Update transaction.
 * The caller is responsible for wrapping in B-Record (Block Control Header) and
 * A-Record (Batch Control Header) per the Batch & Block Control chapter.
 * Application Identifier for the B-Record = "TP".
 */
export function buildImporterCreateLines(input: ImporterCreateInput): string[] {
  const lines: string[] = [];

  // T1 – Importer Account Header
  lines.push(encodeRecord(RECORD_T1_SPEC, input.t1));

  // TA – Name Qualifier / Alternate Name (optional)
  if (input.ta) {
    lines.push(encodeRecord(RECORD_TA_SPEC, input.ta));
  }

  // T2 – Mailing Address
  lines.push(encodeRecord(RECORD_T2_SPEC, input.t2));

  // T3 – Full Legal Importer Name (conditional: required when name > 32 chars)
  if (input.t3) {
    const { head, tail } = splitOverflow(input.t3.fullLegalImporterName, 30);
    lines.push(encodeRecord(RECORD_T3_SPEC, { fullLegalImporterName: head }));
    if (tail.length > 0) {
      // Overflow remaining legal name via TN with qualifier IN1
      for (let offset = 0; offset < tail.length; offset += OVERFLOW_MAX) {
        lines.push(
          encodeRecord(RECORD_TN_SPEC, {
            additionalInfoQualifierCode: "IN1",
            additionalInformation: tail.slice(offset, offset + OVERFLOW_MAX),
          })
        );
      }
    }
  }

  // TB / TC – Physical Address (conditional pair)
  if (input.tb) {
    lines.push(encodeRecord(RECORD_TB_SPEC, input.tb));
    if (input.tc) {
      lines.push(encodeRecord(RECORD_TC_SPEC, input.tc));
    }
  }

  // TD – Identification Numbers & Phone
  lines.push(encodeRecord(RECORD_TD_SPEC, input.td));

  // TE – Address Type & Business Description
  lines.push(encodeRecord(RECORD_TE_SPEC, input.te));

  // TF – Email, Website, Fax (with overflow TN for long email/website)
  const emailSplit = splitOverflow(input.tf.email, 30);
  const websiteSplit = input.tf.website ? splitOverflow(input.tf.website, 30) : { head: "", tail: "" };
  lines.push(
    encodeRecord(RECORD_TF_SPEC, {
      email: emailSplit.head,
      website: websiteSplit.head || undefined,
      fax: input.tf.fax,
    })
  );
  if (emailSplit.tail.length > 0) {
    for (let offset = 0; offset < emailSplit.tail.length; offset += OVERFLOW_MAX) {
      lines.push(
        encodeRecord(RECORD_TN_SPEC, {
          additionalInfoQualifierCode: "CE1",
          additionalInformation: emailSplit.tail.slice(offset, offset + OVERFLOW_MAX),
        })
      );
    }
  }
  if (websiteSplit.tail.length > 0) {
    for (let offset = 0; offset < websiteSplit.tail.length; offset += OVERFLOW_MAX) {
      lines.push(
        encodeRecord(RECORD_TN_SPEC, {
          additionalInfoQualifierCode: "CW1",
          additionalInformation: websiteSplit.tail.slice(offset, offset + OVERFLOW_MAX),
        })
      );
    }
  }

  // TG – NAICS/DUNS/Filer/Incorporation (optional)
  if (input.tg) {
    lines.push(encodeRecord(RECORD_TG_SPEC, input.tg));
  }

  // TH – Primary Bank Information (optional, with overflow TN)
  if (input.th) {
    const bankNameSplit = input.th.primaryBankName
      ? splitOverflow(input.th.primaryBankName, 30)
      : { head: "", tail: "" };
    const bankCitySplit = input.th.bankCity ? splitOverflow(input.th.bankCity, 30) : { head: "", tail: "" };
    lines.push(
      encodeRecord(RECORD_TH_SPEC, {
        primaryBankName: bankNameSplit.head || undefined,
        routingNumber: input.th.routingNumber,
        bankCity: bankCitySplit.head || undefined,
        bankState: input.th.bankState,
        bankCountry: input.th.bankCountry,
      })
    );
    if (bankNameSplit.tail.length > 0) {
      lines.push(
        encodeRecord(RECORD_TN_SPEC, { additionalInfoQualifierCode: "BN1", additionalInformation: bankNameSplit.tail })
      );
    }
    if (bankCitySplit.tail.length > 0) {
      lines.push(
        encodeRecord(RECORD_TN_SPEC, { additionalInfoQualifierCode: "BC1", additionalInformation: bankCitySplit.tail })
      );
    }
  }

  // TI + TJ – Company Officers (conditional pairs, repeating)
  if (input.officers && input.officers.length > 0) {
    for (const officer of input.officers) {
      const nameSplit = splitOverflow(officer.ti.name, 30);
      lines.push(encodeRecord(RECORD_TI_SPEC, { ...officer.ti, name: nameSplit.head }));
      if (nameSplit.tail.length > 0) {
        lines.push(
          encodeRecord(RECORD_TN_SPEC, { additionalInfoQualifierCode: "CN1", additionalInformation: nameSplit.tail })
        );
      }
      const emailTjSplit = splitOverflow(officer.tj.email, 30);
      lines.push(encodeRecord(RECORD_TJ_SPEC, { ...officer.tj, email: emailTjSplit.head }));
      if (emailTjSplit.tail.length > 0) {
        lines.push(
          encodeRecord(RECORD_TN_SPEC, { additionalInfoQualifierCode: "CE2", additionalInformation: emailTjSplit.tail })
        );
      }
    }
  }

  // TK – Related Businesses (optional, repeating)
  if (input.relatedBusinesses && input.relatedBusinesses.length > 0) {
    for (const rb of input.relatedBusinesses) {
      const entitySplit = splitOverflow(rb.nameOfEntity, 30);
      lines.push(encodeRecord(RECORD_TK_SPEC, { ...rb, nameOfEntity: entitySplit.head }));
      if (entitySplit.tail.length > 0) {
        lines.push(
          encodeRecord(RECORD_TN_SPEC, { additionalInfoQualifierCode: "NE1", additionalInformation: entitySplit.tail })
        );
      }
    }
  }

  // TL – Individual Certification (mandatory)
  const tlNameSplit = splitOverflow(input.tl.certifyingIndividualFullName, 30);
  lines.push(encodeRecord(RECORD_TL_SPEC, { ...input.tl, certifyingIndividualFullName: tlNameSplit.head }));
  if (tlNameSplit.tail.length > 0) {
    lines.push(
      encodeRecord(RECORD_TN_SPEC, { additionalInfoQualifierCode: "IN2", additionalInformation: tlNameSplit.tail })
    );
  }

  // TM – Broker Certification (optional, with overflow TN for long broker name)
  if (input.tm) {
    const brokerNameSplit = input.tm.brokersName ? splitOverflow(input.tm.brokersName, 30) : { head: "", tail: "" };
    lines.push(
      encodeRecord(RECORD_TM_SPEC, {
        brokersName: brokerNameSplit.head || undefined,
        certifyingIndividualPhone: input.tm.certifyingIndividualPhone,
        brokersPhone: input.tm.brokersPhone,
      })
    );
    if (brokerNameSplit.tail.length > 0) {
      lines.push(
        encodeRecord(RECORD_TN_SPEC, {
          additionalInfoQualifierCode: "BN2",
          additionalInformation: brokerNameSplit.tail,
        })
      );
    }
  }

  return lines;
}

/** Join lines into a single CRLF-terminated ABI string. */
export function buildImporterCreateTransaction(input: ImporterCreateInput): string {
  return buildImporterCreateLines(input).join("\r\n") + "\r\n";
}
