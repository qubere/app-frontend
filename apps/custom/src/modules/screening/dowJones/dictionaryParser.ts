import fs from "fs";
import { SaxesParser, SaxesTagPlain } from "saxes";

/**
 * One row of the Dow Jones `SanctionsReferencesLists` dictionary --
 * `<SanctionsReferencesList><Code>2</Code><Name>OFAC - Specially Designated
 * National List</Name><Status>Current</Status>...</SanctionsReferencesList>`.
 * This is the only one of the feed's ~8 header dictionaries the MVP
 * transformer needs: `NameType`/`AddressCountry`/`CountryValue` on Entity
 * records are already plain display strings in this feed, not codes, so
 * CountryLists/NameTypeLists/etc. dictionaries are never consulted.
 */
export interface SanctionsReferenceDictionaryEntry {
  name: string;
  status: string;
}

export type SanctionsReferenceDictionary = Map<string, SanctionsReferenceDictionaryEntry>;

/**
 * Streams only as much of the file as needed to read the
 * `<SanctionsReferencesLists>` dictionary (near the top of the document,
 * well before the 838MB `<Entities>` body starts) and destroys the read
 * stream the moment the closing tag is seen -- never reads the full file.
 */
export async function parseSanctionsReferencesDictionary(filePath: string): Promise<SanctionsReferenceDictionary> {
  const dictionary: SanctionsReferenceDictionary = new Map();

  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(filePath, { encoding: "utf-8" });
    const parser = new SaxesParser();
    const stack: string[] = [];
    let textBuf = "";
    let currentCode: string | null = null;
    let currentName: string | null = null;
    let currentStatus: string | null = null;
    let done = false;

    function finish(err?: Error) {
      if (done) return;
      done = true;
      stream.destroy();
      if (err) reject(err);
      else resolve();
    }

    parser.on("error", (e) => finish(e));

    parser.on("text", (t) => {
      textBuf += t;
    });

    parser.on("opentag", (node: SaxesTagPlain) => {
      stack.push(node.name);
      textBuf = "";
      if (node.name === "SanctionsReferencesList") {
        currentCode = null;
        currentName = null;
        currentStatus = null;
      }
    });

    parser.on("closetag", (node: SaxesTagPlain) => {
      const tag = node.name;
      const parentTag = stack[stack.length - 2];
      const value = textBuf.trim();

      if (parentTag === "SanctionsReferencesList") {
        if (tag === "Code") currentCode = value;
        else if (tag === "Name") currentName = value;
        else if (tag === "Status") currentStatus = value;
      } else if (tag === "SanctionsReferencesList") {
        if (currentCode && currentName) {
          dictionary.set(currentCode, { name: currentName, status: currentStatus || "Current" });
        }
      } else if (tag === "SanctionsReferencesLists") {
        finish();
      }

      stack.pop();
      textBuf = "";
    });

    stream.on("data", (chunk) => {
      if (done) return;
      try {
        parser.write(chunk as string);
      } catch (e) {
        finish(e instanceof Error ? e : new Error(String(e)));
      }
    });
    stream.on("error", (e) => finish(e));
    stream.on("close", () => {
      if (!done) finish(new Error("File stream closed before </SanctionsReferencesLists> was reached."));
    });
  });

  return dictionary;
}
