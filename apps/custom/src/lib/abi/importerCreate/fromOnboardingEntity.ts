// Map an OnboardingEntity + ImporterOfRecord from the DB to an ImporterCreateInput.
// Used by POST /api/onboarding/5106/[id]/transmit.

import type { ImporterCreateInput, TIOfficer, TJOfficer } from "./types";

interface IorData {
  name: string;
  irsEin?: string | null;
  cbpImporterNumber?: string | null;
  // Accepts Prisma JsonValue (any) for the address blob
  address?: unknown;
}

interface OfficerRecord {
  name?: string;
  title?: string;
  role?: string;
  phone?: string;
  email?: string;
  ssn?: string;
}

interface OnboardingEntityData {
  importerOfRecord: IorData | null;
  officers?: OfficerRecord[] | null;
}

interface BrokerCredential {
  brokerName?: string | null;
  certifyingName?: string | null;
  certifyingTitle?: string | null;
  phone?: string | null;
}

/**
 * Build an ImporterCreateInput from a fully-loaded OnboardingEntity.
 * Pass `actionCode: "N"` to apply for a CBP-assigned number,
 * `actionCode: "A"` to add a known IRS/SSN number,
 * `actionCode: "U"` to update an existing record.
 */
export function fromOnboardingEntity(
  entity: OnboardingEntityData,
  opts: {
    actionCode: "A" | "U" | "N";
    brokerCredential?: BrokerCredential;
    phone: string;
    email: string;
    entriesPerYear?: "1" | "2" | "3" | "4" | "5";
  }
): ImporterCreateInput {
  const ior = entity.importerOfRecord;
  if (!ior) throw new Error("OnboardingEntity has no ImporterOfRecord — cannot build 5106.");

  const addr = (ior.address ?? {}) as Record<string, string>;

  // Abbreviate name to 32 chars; if full legal name is longer we emit T3 too
  const fullName = ior.name.toUpperCase();
  const abbreviatedName = fullName.slice(0, 32);
  const needsT3 = fullName.length > 32;

  // Importer number: use IRS EIN if available, otherwise space-fill (action N)
  const importerNumber =
    opts.actionCode === "N"
      ? "            " // 12 spaces per spec for action N
      : (ior.irsEin ?? ior.cbpImporterNumber ?? "").toUpperCase();

  // Mailing address from IOR JSON blob
  const mailingLine1 = (addr.line1 ?? addr.addressLine1 ?? "").toUpperCase().slice(0, 32);
  const mailingLine2 = (addr.line2 ?? addr.addressLine2 ?? "").toUpperCase().slice(0, 32) || undefined;
  const city = (addr.city ?? "").toUpperCase().slice(0, 21);
  const state = (addr.state ?? "").toUpperCase().slice(0, 2) || "FN";
  const postal = (addr.postalCode ?? addr.zip ?? "").toUpperCase().slice(0, 9) || undefined;
  const country = (addr.country ?? "US").toUpperCase().slice(0, 2);

  // Officers
  const officers: Array<{ ti: TIOfficer; tj: TJOfficer }> = [];
  const rawOfficers = Array.isArray(entity.officers) ? entity.officers : [];
  rawOfficers.forEach((o, idx) => {
    const lineNum = String(idx + 1).padStart(2, "0");
    const officerName = ((o.name ?? "").toUpperCase()).slice(0, 30);
    const officerTitle = ((o.title ?? o.role ?? "OFFICER").toUpperCase()).slice(0, 22);
    officers.push({
      ti: {
        lineItemNumber: lineNum,
        name: officerName,
        title: officerTitle,
        ssn: o.ssn?.replace(/\D/g, "").slice(0, 9) || undefined,
      },
      tj: {
        lineItemNumber: lineNum,
        phone: (o.phone ?? opts.phone).replace(/[^\d ]/g, "").slice(0, 15),
        email: (o.email ?? opts.email).toUpperCase().slice(0, 30),
      },
    });
  });

  const broker = opts.brokerCredential;

  return {
    t1: {
      actionCode: opts.actionCode,
      importerNumber,
      abbreviatedImporterName: abbreviatedName,
      mailingAddressLine1: mailingLine1,
      importerType: "C",
    },
    t2: {
      mailingAddressLine2: mailingLine2,
      mailingCity: city,
      mailingStateCode: state,
      mailingPostalCode: postal,
      mailingCountryCode: country,
    },
    ...(needsT3 ? { t3: { fullLegalImporterName: fullName.slice(32, 62) } } : {}),
    td: {
      entriesPerYear: opts.entriesPerYear ?? "2",
      utilImporterOfRecord: "X",
      phone: opts.phone.replace(/[^\d ]/g, "").slice(0, 15),
    },
    te: {
      mailingAddressType: "2", // Corporate Office
      businessDescription: undefined,
    },
    tf: {
      email: opts.email.toUpperCase().slice(0, 100),
    },
    officers: officers.length > 0 ? officers : undefined,
    tl: {
      electronicSignature: "X",
      certifyingIndividualFullName: (
        broker?.certifyingName ?? opts.email.split("@")[0]
      ).toUpperCase().slice(0, 100),
      title: (broker?.certifyingTitle ?? "AUTHORIZED FILER").toUpperCase().slice(0, 22),
    },
    ...(broker
      ? {
          tm: {
            brokersName: broker.brokerName?.toUpperCase().slice(0, 100),
            brokersPhone: broker.phone?.replace(/[^\d ]/g, "").slice(0, 15),
          },
        }
      : {}),
  };
}
