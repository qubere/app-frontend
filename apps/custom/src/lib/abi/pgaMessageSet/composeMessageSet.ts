import { DomainError } from "@/lib/api/error";
import type { HoldFormInput } from "@/lib/pga/holdContracts";

/**
 * Safety boundary for the required agency-specific orchestrator. Product/CHB
 * approved field-to-record mappings are a hard prerequisite in PGA-10a.
 * Generic PG records passing structural validation are not an agency filing.
 */
export function composeMessageSet(agencyCode: string, _formInput: HoldFormInput): { messageSetText: string; recordsUsed: string[] } {
  void _formInput;
  throw new DomainError(
    "An approved " + agencyCode + " field-to-record mapping is required before Qubere can generate a filing message. Prepare the response here and file through your existing ACE channel.",
    "PGA_MAPPING_NOT_APPROVED", 422,
  );
}
