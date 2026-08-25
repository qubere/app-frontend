// Restricted / Denied-Party Screening -- Metaphone2 phonetic algorithm.
//
// Self-contained, dependency-free port of the classic single-code Metaphone
// algorithm (Lawrence Philips, 1990; public domain) -- distinct from the
// Double Metaphone implementation in phoneticMatch.ts. Selected via
// RestrictedPartyScreeningOptions.phoneticAlgorithm = "METAPHONE2". The exact
// legacy Metaphone2 library/constant table is not recoverable from this
// repository or its supplied source references, so this is a best-effort,
// standard-algorithm implementation -- documented PARTIAL for exact legacy
// parity per the implementation plan, not abandoned.

function isVowel(c: string): boolean {
  return "AEIOU".includes(c);
}

/** Single deterministic phonetic code for `input`, or "" when nothing alphabetic remains. */
export function metaphone2(input: string): string {
  let word = input.toUpperCase().replace(/[^A-Z]/g, "");
  if (!word) return "";

  const n = word.length;
  let i = 0;
  let result = "";

  const at = (idx: number) => (idx >= 0 && idx < n ? word[idx] : "");

  if (/^(AE|GN|KN|PN|WR)/.test(word)) i = 1;
  else if (at(0) === "X") word = "S" + word.slice(1);
  else if (/^WH/.test(word)) word = "W" + word.slice(2);

  const MAX = 32;
  while (i < n && result.length < MAX) {
    const c = at(i);

    if (isVowel(c)) {
      if (i === 0) result += c;
      i++;
      continue;
    }

    if (c === at(i - 1) && c !== "C") {
      i++;
      continue;
    }

    switch (c) {
      case "B":
        if (!(i === n - 1 && at(i - 1) === "M")) result += "B";
        i++;
        break;
      case "C":
        if (at(i + 1) === "I" && at(i + 2) === "A") {
          result += "X";
          i += 3;
        } else if (at(i + 1) === "H") {
          result += at(i - 1) === "S" ? "K" : "X";
          i += 2;
        } else if (/[IEY]/.test(at(i + 1))) {
          if (at(i - 1) !== "S") result += "S";
          i += 2;
        } else {
          result += "K";
          i++;
        }
        break;
      case "D":
        if (at(i + 1) === "G" && /[IEY]/.test(at(i + 2))) {
          result += "J";
          i += 3;
        } else {
          result += "T";
          i++;
        }
        break;
      case "G":
        if (at(i + 1) === "H") {
          if (isVowel(at(i + 2))) {
            result += "K";
            i++;
          } else {
            i += 2;
          }
        } else if (at(i + 1) === "N") {
          i++;
        } else if (/[IEY]/.test(at(i + 1))) {
          result += "J";
          i++;
        } else {
          result += "K";
          i++;
        }
        break;
      case "H":
        if (isVowel(at(i - 1)) && !isVowel(at(i + 1))) i++;
        else if (/[CSPTG]/.test(at(i - 1))) i++;
        else {
          result += "H";
          i++;
        }
        break;
      case "K":
        if (at(i - 1) !== "C") result += "K";
        i++;
        break;
      case "P":
        if (at(i + 1) === "H") {
          result += "F";
          i += 2;
        } else {
          result += "P";
          i++;
        }
        break;
      case "Q":
        result += "K";
        i++;
        break;
      case "S":
        if (at(i + 1) === "H") {
          result += "X";
          i += 2;
        } else if (at(i + 1) === "I" && /[OA]/.test(at(i + 2))) {
          result += "X";
          i += 3;
        } else {
          result += "S";
          i++;
        }
        break;
      case "T":
        if (at(i + 1) === "H") {
          result += "0";
          i += 2;
        } else if (at(i + 1) === "I" && /[OA]/.test(at(i + 2))) {
          result += "X";
          i += 3;
        } else {
          result += "T";
          i++;
        }
        break;
      case "V":
        result += "F";
        i++;
        break;
      case "W":
      case "Y":
        if (isVowel(at(i + 1))) result += c;
        i++;
        break;
      case "X":
        result += "KS";
        i++;
        break;
      case "Z":
        result += "S";
        i++;
        break;
      case "F":
      case "J":
      case "L":
      case "M":
      case "N":
      case "R":
        result += c;
        i++;
        break;
      default:
        i++;
        break;
    }
  }

  return result;
}

/** True if `a` and `b` produce the same non-empty Metaphone2 code. */
export function metaphone2Matches(a: string, b: string): boolean {
  const ca = metaphone2(a);
  const cb = metaphone2(b);
  return ca !== "" && ca === cb;
}
