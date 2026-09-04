/**
 * CATAIR Appendix B: Country and Currency Codes for ACE Reference Data
 * Source: docs/plans/catair-source-docs/appendix-b-valid-codes.pdf, Pages 6-16 (August 4, 2026)
 *
 * This module exports programmatically extracted lookup tables and validation helper functions
 * for all 243 Country entries and 256 Country-Currency mappings extracted from CATAIR Appendix B.
 *
 * Column structure extracted from PDF:
 * - Country Name
 * - ISO Country Code (2-character alpha code)
 * - Currency Name
 * - Currency Code (3-character alpha code)
 *
 * Evidentiary Bar & Discrepancies Documented:
 * - PDF Pages 6-15 contain the 11-page Country and Currency Codes table.
 * - PDF Page 16 contains Footnotes 1, 2, and 3.
 * - BURMA (MM): Table body on Page 7 prints MM for BURMA. Page 5 change log item 3 notes: "Removed MM (Myanmar) and added BU (Burma)".
 * - INTERNATIONAL MONETARY FUND (I.M.F.): Listed on Page 10 without a 2-letter country code (Footnote 3).
 * - Non-standard/CBP-specific codes: GZ (Gaza Strip), WE (West Bank), KV (Kosovo), USS/USN (US Banking), CHW/CHE (Swiss WIR).
 */

export interface CurrencyDetail {
  /** Currency name / description from CATAIR Appendix B */
  currencyName: string;
  /** 3-letter currency code (e.g. "USD", "EUR", "GBP") */
  currencyCode: string;
  /** Source PDF page number (6-15) */
  page: number;
}

export interface CountryCurrencyEntry {
  /** Country or territory name in English */
  countryName: string;
  /** 2-letter country code (e.g. "US", "GB", "CN") or empty string for IMF */
  countryCode: string;
  /** Primary currency name */
  currencyName: string;
  /** Primary 3-letter currency code */
  currencyCode: string;
  /** Complete list of currencies associated with this country (including secondary/regional currencies) */
  currencies: CurrencyDetail[];
  /** Source PDF page number where entry begins (6-15) */
  page: number;
  /** True if the code/entry is non-standard or CBP-specific (e.g. IMF, GZ, WE, KV) */
  isNonStandardIso?: boolean;
  /** Explanatory notes regarding ambiguity, change logs, or multi-line/page continuations */
  notes?: string;
}

/**
 * Authoritative list of all 243 Country entries extracted from CATAIR Appendix B (Pages 6-15).
 */
export const ABI_COUNTRY_CURRENCY_CODES: readonly CountryCurrencyEntry[] = [
  {
    "countryName": "AFGHANISTAN",
    "countryCode": "AF",
    "currencyName": "Afghani",
    "currencyCode": "AFN",
    "currencies": [
      {
        "currencyName": "Afghani",
        "currencyCode": "AFN",
        "page": 6
      }
    ],
    "page": 6
  },
  {
    "countryName": "ALBANIA",
    "countryCode": "AL",
    "currencyName": "Lek",
    "currencyCode": "ALL",
    "currencies": [
      {
        "currencyName": "Lek",
        "currencyCode": "ALL",
        "page": 6
      }
    ],
    "page": 6
  },
  {
    "countryName": "ALGERIA",
    "countryCode": "DZ",
    "currencyName": "Algerian Dinar",
    "currencyCode": "DZD",
    "currencies": [
      {
        "currencyName": "Algerian Dinar",
        "currencyCode": "DZD",
        "page": 6
      }
    ],
    "page": 6
  },
  {
    "countryName": "AMERICAN SAMOA",
    "countryCode": "AS",
    "currencyName": "US Dollar",
    "currencyCode": "USD",
    "currencies": [
      {
        "currencyName": "US Dollar",
        "currencyCode": "USD",
        "page": 6
      }
    ],
    "page": 6
  },
  {
    "countryName": "ANDORRA",
    "countryCode": "AD",
    "currencyName": "Euro",
    "currencyCode": "EUR",
    "currencies": [
      {
        "currencyName": "Euro",
        "currencyCode": "EUR",
        "page": 6
      }
    ],
    "page": 6
  },
  {
    "countryName": "ANGOLA",
    "countryCode": "AO",
    "currencyName": "Kwanza",
    "currencyCode": "AOA",
    "currencies": [
      {
        "currencyName": "Kwanza",
        "currencyCode": "AOA",
        "page": 6
      }
    ],
    "page": 6
  },
  {
    "countryName": "ANGUILLA",
    "countryCode": "AI",
    "currencyName": "East Caribbean Dollar",
    "currencyCode": "XCD",
    "currencies": [
      {
        "currencyName": "East Caribbean Dollar",
        "currencyCode": "XCD",
        "page": 6
      }
    ],
    "page": 6
  },
  {
    "countryName": "ANTIGUA & BARBUDA",
    "countryCode": "AG",
    "currencyName": "East Caribbean Dollar",
    "currencyCode": "XCD",
    "currencies": [
      {
        "currencyName": "East Caribbean Dollar",
        "currencyCode": "XCD",
        "page": 6
      }
    ],
    "page": 6
  },
  {
    "countryName": "ARGENTINA",
    "countryCode": "AR",
    "currencyName": "Argentine Peso",
    "currencyCode": "ARS",
    "currencies": [
      {
        "currencyName": "Argentine Peso",
        "currencyCode": "ARS",
        "page": 6
      }
    ],
    "page": 6
  },
  {
    "countryName": "ARMENIA",
    "countryCode": "AM",
    "currencyName": "Armenian Dram",
    "currencyCode": "AMD",
    "currencies": [
      {
        "currencyName": "Armenian Dram",
        "currencyCode": "AMD",
        "page": 6
      }
    ],
    "page": 6
  },
  {
    "countryName": "ARUBA",
    "countryCode": "AW",
    "currencyName": "Aruban Guilder",
    "currencyCode": "AWG",
    "currencies": [
      {
        "currencyName": "Aruban Guilder",
        "currencyCode": "AWG",
        "page": 6
      }
    ],
    "page": 6
  },
  {
    "countryName": "AUSTRALIA",
    "countryCode": "AU",
    "currencyName": "Australian Dollar",
    "currencyCode": "AUD",
    "currencies": [
      {
        "currencyName": "Australian Dollar",
        "currencyCode": "AUD",
        "page": 6
      }
    ],
    "page": 6
  },
  {
    "countryName": "AUSTRIA",
    "countryCode": "AT",
    "currencyName": "Euro",
    "currencyCode": "EUR",
    "currencies": [
      {
        "currencyName": "Euro",
        "currencyCode": "EUR",
        "page": 6
      }
    ],
    "page": 6
  },
  {
    "countryName": "AZERBAIJAN",
    "countryCode": "AZ",
    "currencyName": "Azerbaijanian Manat",
    "currencyCode": "AZN",
    "currencies": [
      {
        "currencyName": "Azerbaijanian Manat",
        "currencyCode": "AZN",
        "page": 6
      }
    ],
    "page": 6
  },
  {
    "countryName": "BAHAMAS",
    "countryCode": "BS",
    "currencyName": "Bahamian Dollar",
    "currencyCode": "BSD",
    "currencies": [
      {
        "currencyName": "Bahamian Dollar",
        "currencyCode": "BSD",
        "page": 6
      }
    ],
    "page": 6
  },
  {
    "countryName": "BAHRAIN",
    "countryCode": "BH",
    "currencyName": "Bahraini Dinar",
    "currencyCode": "BHD",
    "currencies": [
      {
        "currencyName": "Bahraini Dinar",
        "currencyCode": "BHD",
        "page": 6
      }
    ],
    "page": 6
  },
  {
    "countryName": "BANGLADESH",
    "countryCode": "BD",
    "currencyName": "Taka",
    "currencyCode": "BDT",
    "currencies": [
      {
        "currencyName": "Taka",
        "currencyCode": "BDT",
        "page": 6
      }
    ],
    "page": 6
  },
  {
    "countryName": "BARBADOS",
    "countryCode": "BB",
    "currencyName": "Barbados Dollar",
    "currencyCode": "BBD",
    "currencies": [
      {
        "currencyName": "Barbados Dollar",
        "currencyCode": "BBD",
        "page": 6
      }
    ],
    "page": 6
  },
  {
    "countryName": "BELARUS",
    "countryCode": "BY",
    "currencyName": "Belarussian Ruble",
    "currencyCode": "BYR",
    "currencies": [
      {
        "currencyName": "Belarussian Ruble",
        "currencyCode": "BYR",
        "page": 6
      }
    ],
    "page": 6
  },
  {
    "countryName": "BELGIUM",
    "countryCode": "BE",
    "currencyName": "Euro",
    "currencyCode": "EUR",
    "currencies": [
      {
        "currencyName": "Euro",
        "currencyCode": "EUR",
        "page": 6
      }
    ],
    "page": 6
  },
  {
    "countryName": "BELIZE",
    "countryCode": "BZ",
    "currencyName": "Belize Dollar",
    "currencyCode": "BZD",
    "currencies": [
      {
        "currencyName": "Belize Dollar",
        "currencyCode": "BZD",
        "page": 6
      }
    ],
    "page": 6
  },
  {
    "countryName": "BENIN",
    "countryCode": "BJ",
    "currencyName": "CFA Franc",
    "currencyCode": "XOF",
    "currencies": [
      {
        "currencyName": "CFA Franc",
        "currencyCode": "XOF",
        "page": 6
      }
    ],
    "page": 6
  },
  {
    "countryName": "BERMUDA",
    "countryCode": "BM",
    "currencyName": "Bermudian Dollar",
    "currencyCode": "BMD",
    "currencies": [
      {
        "currencyName": "Bermudian Dollar",
        "currencyCode": "BMD",
        "page": 6
      }
    ],
    "page": 6
  },
  {
    "countryName": "BHUTAN",
    "countryCode": "BT",
    "currencyName": "Indian Rupee",
    "currencyCode": "INR",
    "currencies": [
      {
        "currencyName": "Indian Rupee",
        "currencyCode": "INR",
        "page": 7
      },
      {
        "currencyName": "Ngultrum",
        "currencyCode": "BTN",
        "page": 7
      }
    ],
    "page": 7
  },
  {
    "countryName": "BOLIVIA",
    "countryCode": "BO",
    "currencyName": "Bolivian",
    "currencyCode": "BOB",
    "currencies": [
      {
        "currencyName": "Bolivian",
        "currencyCode": "BOB",
        "page": 7
      },
      {
        "currencyName": "Mvdol",
        "currencyCode": "BOV",
        "page": 7
      }
    ],
    "page": 7
  },
  {
    "countryName": "BOSNIA & HERCEGOVINA",
    "countryCode": "BA",
    "currencyName": "Convertible Marks",
    "currencyCode": "BAM",
    "currencies": [
      {
        "currencyName": "Convertible Marks",
        "currencyCode": "BAM",
        "page": 7
      }
    ],
    "page": 7
  },
  {
    "countryName": "BOTSWANA",
    "countryCode": "BW",
    "currencyName": "Pula",
    "currencyCode": "BWP",
    "currencies": [
      {
        "currencyName": "Pula",
        "currencyCode": "BWP",
        "page": 7
      }
    ],
    "page": 7
  },
  {
    "countryName": "BOUVET ISLAND",
    "countryCode": "BV",
    "currencyName": "Norwegian Krone",
    "currencyCode": "NOK",
    "currencies": [
      {
        "currencyName": "Norwegian Krone",
        "currencyCode": "NOK",
        "page": 7
      }
    ],
    "page": 7
  },
  {
    "countryName": "BRAZIL",
    "countryCode": "BR",
    "currencyName": "Brazilian Real",
    "currencyCode": "BRL",
    "currencies": [
      {
        "currencyName": "Brazilian Real",
        "currencyCode": "BRL",
        "page": 7
      }
    ],
    "page": 7
  },
  {
    "countryName": "BRITISH INDIAN OCEAN TERRITORY",
    "countryCode": "IO",
    "currencyName": "US Dollar",
    "currencyCode": "USD",
    "currencies": [
      {
        "currencyName": "US Dollar",
        "currencyCode": "USD",
        "page": 7
      }
    ],
    "page": 7
  },
  {
    "countryName": "BRUNEI DARUSSALAM",
    "countryCode": "BN",
    "currencyName": "Brunei Dollar",
    "currencyCode": "BND",
    "currencies": [
      {
        "currencyName": "Brunei Dollar",
        "currencyCode": "BND",
        "page": 7
      }
    ],
    "page": 7
  },
  {
    "countryName": "BULGARIA",
    "countryCode": "BG",
    "currencyName": "Bulgarian Lev",
    "currencyCode": "BGN",
    "currencies": [
      {
        "currencyName": "Bulgarian Lev",
        "currencyCode": "BGN",
        "page": 7
      }
    ],
    "page": 7
  },
  {
    "countryName": "BURKINA FASO",
    "countryCode": "BF",
    "currencyName": "CFA Franc",
    "currencyCode": "XOF",
    "currencies": [
      {
        "currencyName": "CFA Franc",
        "currencyCode": "XOF",
        "page": 7
      }
    ],
    "page": 7
  },
  {
    "countryName": "BURMA",
    "countryCode": "MM",
    "currencyName": "Myanmar Kyat",
    "currencyCode": "MMK",
    "currencies": [
      {
        "currencyName": "Myanmar Kyat",
        "currencyCode": "MMK",
        "page": 7
      }
    ],
    "page": 7,
    "notes": "Listed as BURMA with country code MM on Page 7. Note: Page 5 change log item 3 states: Removed MM (Myanmar) and added BU (Burma)."
  },
  {
    "countryName": "BURUNDI",
    "countryCode": "BI",
    "currencyName": "Burundi Franc",
    "currencyCode": "BIF",
    "currencies": [
      {
        "currencyName": "Burundi Franc",
        "currencyCode": "BIF",
        "page": 7
      }
    ],
    "page": 7
  },
  {
    "countryName": "CAMBODIA",
    "countryCode": "KH",
    "currencyName": "Riel",
    "currencyCode": "KHR",
    "currencies": [
      {
        "currencyName": "Riel",
        "currencyCode": "KHR",
        "page": 7
      }
    ],
    "page": 7
  },
  {
    "countryName": "CAMEROON,",
    "countryCode": "CM",
    "currencyName": "CFA Franc",
    "currencyCode": "XAF",
    "currencies": [
      {
        "currencyName": "CFA Franc",
        "currencyCode": "XAF",
        "page": 7
      }
    ],
    "page": 7
  },
  {
    "countryName": "CANADA",
    "countryCode": "CA",
    "currencyName": "Canadian Dollar",
    "currencyCode": "CAD",
    "currencies": [
      {
        "currencyName": "Canadian Dollar",
        "currencyCode": "CAD",
        "page": 7
      }
    ],
    "page": 7
  },
  {
    "countryName": "CAPE VERDE",
    "countryCode": "CV",
    "currencyName": "Cape Verde Escudo",
    "currencyCode": "CVE",
    "currencies": [
      {
        "currencyName": "Cape Verde Escudo",
        "currencyCode": "CVE",
        "page": 7
      }
    ],
    "page": 7
  },
  {
    "countryName": "CAYMAN ISLANDS",
    "countryCode": "KY",
    "currencyName": "Cayman Islands Dollar",
    "currencyCode": "KYD",
    "currencies": [
      {
        "currencyName": "Cayman Islands Dollar",
        "currencyCode": "KYD",
        "page": 7
      }
    ],
    "page": 7
  },
  {
    "countryName": "CENTRAL AFRICAN REPUBLIC",
    "countryCode": "CF",
    "currencyName": "CFA Franc",
    "currencyCode": "XAF",
    "currencies": [
      {
        "currencyName": "CFA Franc",
        "currencyCode": "XAF",
        "page": 7
      }
    ],
    "page": 7
  },
  {
    "countryName": "CHAD",
    "countryCode": "TD",
    "currencyName": "CFA Franc",
    "currencyCode": "XAF",
    "currencies": [
      {
        "currencyName": "CFA Franc",
        "currencyCode": "XAF",
        "page": 7
      }
    ],
    "page": 7
  },
  {
    "countryName": "CHILE",
    "countryCode": "CL",
    "currencyName": "Chilean Peso",
    "currencyCode": "CLP",
    "currencies": [
      {
        "currencyName": "Chilean Peso",
        "currencyCode": "CLP",
        "page": 7
      }
    ],
    "page": 7
  },
  {
    "countryName": "CHINA",
    "countryCode": "CN",
    "currencyName": "Yuan Renminbi",
    "currencyCode": "CNY",
    "currencies": [
      {
        "currencyName": "Yuan Renminbi",
        "currencyCode": "CNY",
        "page": 7
      }
    ],
    "page": 7
  },
  {
    "countryName": "CHRISTMAS ISLANDS",
    "countryCode": "CX",
    "currencyName": "Australian Dollar",
    "currencyCode": "AUD",
    "currencies": [
      {
        "currencyName": "Australian Dollar",
        "currencyCode": "AUD",
        "page": 7
      }
    ],
    "page": 7
  },
  {
    "countryName": "COCOS (KEELING) ISLANDS",
    "countryCode": "CC",
    "currencyName": "Australian Dollar",
    "currencyCode": "AUD",
    "currencies": [
      {
        "currencyName": "Australian Dollar",
        "currencyCode": "AUD",
        "page": 7
      }
    ],
    "page": 7
  },
  {
    "countryName": "COLOMBIA",
    "countryCode": "CO",
    "currencyName": "Colombian Peso",
    "currencyCode": "COP",
    "currencies": [
      {
        "currencyName": "Colombian Peso",
        "currencyCode": "COP",
        "page": 7
      }
    ],
    "page": 7
  },
  {
    "countryName": "COMOROS",
    "countryCode": "KM",
    "currencyName": "Comoros Franc",
    "currencyCode": "KMF",
    "currencies": [
      {
        "currencyName": "Comoros Franc",
        "currencyCode": "KMF",
        "page": 8
      }
    ],
    "page": 8
  },
  {
    "countryName": "CONGO",
    "countryCode": "CG",
    "currencyName": "CFA Franc",
    "currencyCode": "XAF",
    "currencies": [
      {
        "currencyName": "CFA Franc",
        "currencyCode": "XAF",
        "page": 8
      }
    ],
    "page": 8
  },
  {
    "countryName": "CONGO , THE DEMOCRATIC REPUBLIC OF",
    "countryCode": "CD",
    "currencyName": "Franc Congolais",
    "currencyCode": "CDF",
    "currencies": [
      {
        "currencyName": "Franc Congolais",
        "currencyCode": "CDF",
        "page": 8
      }
    ],
    "page": 8
  },
  {
    "countryName": "COOK ISLANDS",
    "countryCode": "CK",
    "currencyName": "New Zealand Dollar",
    "currencyCode": "NZD",
    "currencies": [
      {
        "currencyName": "New Zealand Dollar",
        "currencyCode": "NZD",
        "page": 8
      }
    ],
    "page": 8
  },
  {
    "countryName": "COSTA RICA",
    "countryCode": "CR",
    "currencyName": "Costa Rican Colon",
    "currencyCode": "CRC",
    "currencies": [
      {
        "currencyName": "Costa Rican Colon",
        "currencyCode": "CRC",
        "page": 8
      }
    ],
    "page": 8
  },
  {
    "countryName": "COTE D\u2019IVOIRE",
    "countryCode": "CI",
    "currencyName": "CFA Franc",
    "currencyCode": "XOF",
    "currencies": [
      {
        "currencyName": "CFA Franc",
        "currencyCode": "XOF",
        "page": 8
      }
    ],
    "page": 8
  },
  {
    "countryName": "CROATIA",
    "countryCode": "HR",
    "currencyName": "Croatian Kuna",
    "currencyCode": "HRK",
    "currencies": [
      {
        "currencyName": "Croatian Kuna",
        "currencyCode": "HRK",
        "page": 8
      }
    ],
    "page": 8
  },
  {
    "countryName": "CUBA",
    "countryCode": "CU",
    "currencyName": "Cuban Peso",
    "currencyCode": "CUP",
    "currencies": [
      {
        "currencyName": "Cuban Peso",
        "currencyCode": "CUP",
        "page": 8
      }
    ],
    "page": 8
  },
  {
    "countryName": "CURACAO",
    "countryCode": "CW",
    "currencyName": "Netherlands Antillian Guilder",
    "currencyCode": "ANG",
    "currencies": [
      {
        "currencyName": "Netherlands Antillian Guilder",
        "currencyCode": "ANG",
        "page": 8
      }
    ],
    "page": 8
  },
  {
    "countryName": "CYPRUS",
    "countryCode": "CY",
    "currencyName": "Euro",
    "currencyCode": "EUR",
    "currencies": [
      {
        "currencyName": "Euro",
        "currencyCode": "EUR",
        "page": 8
      }
    ],
    "page": 8
  },
  {
    "countryName": "CZECH REPUBLIC",
    "countryCode": "CZ",
    "currencyName": "Czech Koruna",
    "currencyCode": "CZK",
    "currencies": [
      {
        "currencyName": "Czech Koruna",
        "currencyCode": "CZK",
        "page": 8
      }
    ],
    "page": 8
  },
  {
    "countryName": "DENMARK",
    "countryCode": "DK",
    "currencyName": "Danish Krone",
    "currencyCode": "DKK",
    "currencies": [
      {
        "currencyName": "Danish Krone",
        "currencyCode": "DKK",
        "page": 8
      }
    ],
    "page": 8
  },
  {
    "countryName": "DJIBOUTI",
    "countryCode": "DJ",
    "currencyName": "Djibouti Franc",
    "currencyCode": "DJF",
    "currencies": [
      {
        "currencyName": "Djibouti Franc",
        "currencyCode": "DJF",
        "page": 8
      }
    ],
    "page": 8
  },
  {
    "countryName": "DOMINICA",
    "countryCode": "DM",
    "currencyName": "East Caribbean Dollar",
    "currencyCode": "XCD",
    "currencies": [
      {
        "currencyName": "East Caribbean Dollar",
        "currencyCode": "XCD",
        "page": 8
      }
    ],
    "page": 8
  },
  {
    "countryName": "DOMINICAN REPUBLIC",
    "countryCode": "DO",
    "currencyName": "Dominican Peso",
    "currencyCode": "DOP",
    "currencies": [
      {
        "currencyName": "Dominican Peso",
        "currencyCode": "DOP",
        "page": 8
      }
    ],
    "page": 8
  },
  {
    "countryName": "ECUADOR",
    "countryCode": "EC",
    "currencyName": "US Dollar",
    "currencyCode": "USD",
    "currencies": [
      {
        "currencyName": "US Dollar",
        "currencyCode": "USD",
        "page": 8
      }
    ],
    "page": 8
  },
  {
    "countryName": "EGYPT",
    "countryCode": "EG",
    "currencyName": "Egyptian Pound",
    "currencyCode": "EGP",
    "currencies": [
      {
        "currencyName": "Egyptian Pound",
        "currencyCode": "EGP",
        "page": 8
      }
    ],
    "page": 8
  },
  {
    "countryName": "EL SALVADOR",
    "countryCode": "SV",
    "currencyName": "El Salvador Colon",
    "currencyCode": "SVC",
    "currencies": [
      {
        "currencyName": "El Salvador Colon",
        "currencyCode": "SVC",
        "page": 8
      },
      {
        "currencyName": "US Dollar",
        "currencyCode": "USD",
        "page": 8
      }
    ],
    "page": 8
  },
  {
    "countryName": "EQUATORIAL GUINEA",
    "countryCode": "GQ",
    "currencyName": "CFA Franc",
    "currencyCode": "XOF",
    "currencies": [
      {
        "currencyName": "CFA Franc",
        "currencyCode": "XOF",
        "page": 8
      }
    ],
    "page": 8
  },
  {
    "countryName": "ERITREA",
    "countryCode": "ER",
    "currencyName": "Nakfa",
    "currencyCode": "ERN",
    "currencies": [
      {
        "currencyName": "Nakfa",
        "currencyCode": "ERN",
        "page": 8
      }
    ],
    "page": 8
  },
  {
    "countryName": "ESTONIA",
    "countryCode": "EE",
    "currencyName": "Kroon",
    "currencyCode": "EEK",
    "currencies": [
      {
        "currencyName": "Kroon",
        "currencyCode": "EEK",
        "page": 8
      }
    ],
    "page": 8
  },
  {
    "countryName": "ETHIOPIA",
    "countryCode": "ET",
    "currencyName": "Ethiopian Birr",
    "currencyCode": "ETB",
    "currencies": [
      {
        "currencyName": "Ethiopian Birr",
        "currencyCode": "ETB",
        "page": 8
      }
    ],
    "page": 8
  },
  {
    "countryName": "FALKLAND ISLANDS (MALVINAS)",
    "countryCode": "FK",
    "currencyName": "Falkland Islands Pound",
    "currencyCode": "FKP",
    "currencies": [
      {
        "currencyName": "Falkland Islands Pound",
        "currencyCode": "FKP",
        "page": 8
      }
    ],
    "page": 8
  },
  {
    "countryName": "FAROE ISLANDS",
    "countryCode": "FO",
    "currencyName": "Danish Krone",
    "currencyCode": "DKK",
    "currencies": [
      {
        "currencyName": "Danish Krone",
        "currencyCode": "DKK",
        "page": 8
      }
    ],
    "page": 8
  },
  {
    "countryName": "FIJI",
    "countryCode": "FJ",
    "currencyName": "Fiji Dollar",
    "currencyCode": "FJD",
    "currencies": [
      {
        "currencyName": "Fiji Dollar",
        "currencyCode": "FJD",
        "page": 8
      }
    ],
    "page": 8
  },
  {
    "countryName": "FINLAND",
    "countryCode": "FI",
    "currencyName": "Euro",
    "currencyCode": "EUR",
    "currencies": [
      {
        "currencyName": "Euro",
        "currencyCode": "EUR",
        "page": 9
      }
    ],
    "page": 9
  },
  {
    "countryName": "FRANCE",
    "countryCode": "FR",
    "currencyName": "Euro",
    "currencyCode": "EUR",
    "currencies": [
      {
        "currencyName": "Euro",
        "currencyCode": "EUR",
        "page": 9
      }
    ],
    "page": 9
  },
  {
    "countryName": "FRENCH GUIANA",
    "countryCode": "GF",
    "currencyName": "Euro",
    "currencyCode": "EUR",
    "currencies": [
      {
        "currencyName": "Euro",
        "currencyCode": "EUR",
        "page": 9
      }
    ],
    "page": 9
  },
  {
    "countryName": "FRENCH POLYNESIA",
    "countryCode": "PF",
    "currencyName": "CFP Franc",
    "currencyCode": "XPF",
    "currencies": [
      {
        "currencyName": "CFP Franc",
        "currencyCode": "XPF",
        "page": 9
      }
    ],
    "page": 9
  },
  {
    "countryName": "FRENCH SOUTHERN TERRITORIES",
    "countryCode": "TF",
    "currencyName": "Euro",
    "currencyCode": "EUR",
    "currencies": [
      {
        "currencyName": "Euro",
        "currencyCode": "EUR",
        "page": 9
      }
    ],
    "page": 9
  },
  {
    "countryName": "GABON",
    "countryCode": "GA",
    "currencyName": "CFA Franc",
    "currencyCode": "XAF",
    "currencies": [
      {
        "currencyName": "CFA Franc",
        "currencyCode": "XAF",
        "page": 9
      }
    ],
    "page": 9
  },
  {
    "countryName": "GAMBIA",
    "countryCode": "GM",
    "currencyName": "Dalasi",
    "currencyCode": "GMD",
    "currencies": [
      {
        "currencyName": "Dalasi",
        "currencyCode": "GMD",
        "page": 9
      }
    ],
    "page": 9
  },
  {
    "countryName": "GAZA STRIP",
    "countryCode": "GZ",
    "currencyName": "New Israeli Sheqel",
    "currencyCode": "ILS",
    "currencies": [
      {
        "currencyName": "New Israeli Sheqel",
        "currencyCode": "ILS",
        "page": 9
      }
    ],
    "page": 9,
    "isNonStandardIso": true,
    "notes": "Non-standard/legacy CBP entity code for Gaza Strip (ISO standard uses PS)."
  },
  {
    "countryName": "GEORGIA",
    "countryCode": "GE",
    "currencyName": "Lari",
    "currencyCode": "GEL",
    "currencies": [
      {
        "currencyName": "Lari",
        "currencyCode": "GEL",
        "page": 9
      }
    ],
    "page": 9
  },
  {
    "countryName": "GERMANY",
    "countryCode": "DE",
    "currencyName": "Euro",
    "currencyCode": "EUR",
    "currencies": [
      {
        "currencyName": "Euro",
        "currencyCode": "EUR",
        "page": 9
      }
    ],
    "page": 9
  },
  {
    "countryName": "GHANA",
    "countryCode": "GH",
    "currencyName": "Ghana Cedi",
    "currencyCode": "GHS",
    "currencies": [
      {
        "currencyName": "Ghana Cedi",
        "currencyCode": "GHS",
        "page": 9
      }
    ],
    "page": 9
  },
  {
    "countryName": "GIBRALTAR",
    "countryCode": "GI",
    "currencyName": "Gibraltar Pound",
    "currencyCode": "GIP",
    "currencies": [
      {
        "currencyName": "Gibraltar Pound",
        "currencyCode": "GIP",
        "page": 9
      }
    ],
    "page": 9
  },
  {
    "countryName": "GREECE",
    "countryCode": "GR",
    "currencyName": "Euro",
    "currencyCode": "EUR",
    "currencies": [
      {
        "currencyName": "Euro",
        "currencyCode": "EUR",
        "page": 9
      }
    ],
    "page": 9
  },
  {
    "countryName": "GREENLAND",
    "countryCode": "GL",
    "currencyName": "Danish Krone",
    "currencyCode": "DKK",
    "currencies": [
      {
        "currencyName": "Danish Krone",
        "currencyCode": "DKK",
        "page": 9
      }
    ],
    "page": 9
  },
  {
    "countryName": "GRENADA",
    "countryCode": "GD",
    "currencyName": "East Caribbean Dollar",
    "currencyCode": "XCD",
    "currencies": [
      {
        "currencyName": "East Caribbean Dollar",
        "currencyCode": "XCD",
        "page": 9
      }
    ],
    "page": 9
  },
  {
    "countryName": "GUADELOUPE",
    "countryCode": "GP",
    "currencyName": "Euro",
    "currencyCode": "EUR",
    "currencies": [
      {
        "currencyName": "Euro",
        "currencyCode": "EUR",
        "page": 9
      }
    ],
    "page": 9
  },
  {
    "countryName": "GUAM",
    "countryCode": "GU",
    "currencyName": "US Dollar",
    "currencyCode": "USD",
    "currencies": [
      {
        "currencyName": "US Dollar",
        "currencyCode": "USD",
        "page": 9
      }
    ],
    "page": 9
  },
  {
    "countryName": "GUATEMALA",
    "countryCode": "GT",
    "currencyName": "Quetzal",
    "currencyCode": "GTQ",
    "currencies": [
      {
        "currencyName": "Quetzal",
        "currencyCode": "GTQ",
        "page": 9
      }
    ],
    "page": 9
  },
  {
    "countryName": "GUINEA",
    "countryCode": "GN",
    "currencyName": "Guinea Franc",
    "currencyCode": "GNF",
    "currencies": [
      {
        "currencyName": "Guinea Franc",
        "currencyCode": "GNF",
        "page": 9
      }
    ],
    "page": 9
  },
  {
    "countryName": "GUINEA-BISSAU",
    "countryCode": "GW",
    "currencyName": "Guinea-Bissau Peso",
    "currencyCode": "GWP",
    "currencies": [
      {
        "currencyName": "Guinea-Bissau Peso",
        "currencyCode": "GWP",
        "page": 9
      },
      {
        "currencyName": "CFA Franc",
        "currencyCode": "XOF",
        "page": 9
      }
    ],
    "page": 9
  },
  {
    "countryName": "GUYANA",
    "countryCode": "GY",
    "currencyName": "Guyana Dollar",
    "currencyCode": "GYD",
    "currencies": [
      {
        "currencyName": "Guyana Dollar",
        "currencyCode": "GYD",
        "page": 9
      }
    ],
    "page": 9
  },
  {
    "countryName": "HAITI",
    "countryCode": "HT",
    "currencyName": "Gourde",
    "currencyCode": "HTG",
    "currencies": [
      {
        "currencyName": "Gourde",
        "currencyCode": "HTG",
        "page": 9
      },
      {
        "currencyName": "US Dollar",
        "currencyCode": "USD",
        "page": 9
      }
    ],
    "page": 9
  },
  {
    "countryName": "HEARD AND McDONALD ISLANDS",
    "countryCode": "HM",
    "currencyName": "Australian Dollar",
    "currencyCode": "AUD",
    "currencies": [
      {
        "currencyName": "Australian Dollar",
        "currencyCode": "AUD",
        "page": 9
      }
    ],
    "page": 9
  },
  {
    "countryName": "HOLY SEE (VATICAN CITY STATE)",
    "countryCode": "VA",
    "currencyName": "Euro",
    "currencyCode": "EUR",
    "currencies": [
      {
        "currencyName": "Euro",
        "currencyCode": "EUR",
        "page": 9
      }
    ],
    "page": 9
  },
  {
    "countryName": "HONDURAS",
    "countryCode": "HN",
    "currencyName": "Lempira",
    "currencyCode": "HNL",
    "currencies": [
      {
        "currencyName": "Lempira",
        "currencyCode": "HNL",
        "page": 10
      }
    ],
    "page": 10
  },
  {
    "countryName": "HONG KONG",
    "countryCode": "HK",
    "currencyName": "Hong Kong Dollar",
    "currencyCode": "HKD",
    "currencies": [
      {
        "currencyName": "Hong Kong Dollar",
        "currencyCode": "HKD",
        "page": 10
      }
    ],
    "page": 10
  },
  {
    "countryName": "HUNGARY",
    "countryCode": "HU",
    "currencyName": "Forint",
    "currencyCode": "HUF",
    "currencies": [
      {
        "currencyName": "Forint",
        "currencyCode": "HUF",
        "page": 10
      }
    ],
    "page": 10
  },
  {
    "countryName": "ICELAND",
    "countryCode": "IS",
    "currencyName": "Iceland Krona",
    "currencyCode": "ISK",
    "currencies": [
      {
        "currencyName": "Iceland Krona",
        "currencyCode": "ISK",
        "page": 10
      }
    ],
    "page": 10
  },
  {
    "countryName": "INDIA",
    "countryCode": "IN",
    "currencyName": "Indian Rupee",
    "currencyCode": "INR",
    "currencies": [
      {
        "currencyName": "Indian Rupee",
        "currencyCode": "INR",
        "page": 10
      }
    ],
    "page": 10
  },
  {
    "countryName": "INDONESIA",
    "countryCode": "ID",
    "currencyName": "Rupiah",
    "currencyCode": "IDR",
    "currencies": [
      {
        "currencyName": "Rupiah",
        "currencyCode": "IDR",
        "page": 10
      }
    ],
    "page": 10
  },
  {
    "countryName": "INTERNATIONAL MONETARY FUND (I.M.F.)",
    "countryCode": "",
    "currencyName": "SDR",
    "currencyCode": "XDR",
    "currencies": [
      {
        "currencyName": "SDR",
        "currencyCode": "XDR",
        "page": 10
      }
    ],
    "page": 10,
    "isNonStandardIso": true,
    "notes": "No 2-letter ISO country code in PDF. Footnote 3 on Page 16 notes: This entry is not derived from ISO 3166, but is included here for convenience."
  },
  {
    "countryName": "IRAN, ISLAMIC REPUBLIC OF",
    "countryCode": "IR",
    "currencyName": "Iranian Riall",
    "currencyCode": "IRR",
    "currencies": [
      {
        "currencyName": "Iranian Riall",
        "currencyCode": "IRR",
        "page": 10
      }
    ],
    "page": 10
  },
  {
    "countryName": "IRAQ",
    "countryCode": "IQ",
    "currencyName": "Iraqi Dinar",
    "currencyCode": "IQD",
    "currencies": [
      {
        "currencyName": "Iraqi Dinar",
        "currencyCode": "IQD",
        "page": 10
      }
    ],
    "page": 10
  },
  {
    "countryName": "IRELAND",
    "countryCode": "IE",
    "currencyName": "Euro",
    "currencyCode": "EUR",
    "currencies": [
      {
        "currencyName": "Euro",
        "currencyCode": "EUR",
        "page": 10
      }
    ],
    "page": 10
  },
  {
    "countryName": "ISRAEL",
    "countryCode": "IL",
    "currencyName": "New Israeli Sheqel",
    "currencyCode": "ILS",
    "currencies": [
      {
        "currencyName": "New Israeli Sheqel",
        "currencyCode": "ILS",
        "page": 10
      }
    ],
    "page": 10
  },
  {
    "countryName": "ITALY",
    "countryCode": "IT",
    "currencyName": "Euro",
    "currencyCode": "EUR",
    "currencies": [
      {
        "currencyName": "Euro",
        "currencyCode": "EUR",
        "page": 10
      }
    ],
    "page": 10
  },
  {
    "countryName": "JAMAICA",
    "countryCode": "JM",
    "currencyName": "Jamaican Dollar",
    "currencyCode": "JMD",
    "currencies": [
      {
        "currencyName": "Jamaican Dollar",
        "currencyCode": "JMD",
        "page": 10
      }
    ],
    "page": 10
  },
  {
    "countryName": "JAPAN",
    "countryCode": "JP",
    "currencyName": "Yen",
    "currencyCode": "JPY",
    "currencies": [
      {
        "currencyName": "Yen",
        "currencyCode": "JPY",
        "page": 10
      }
    ],
    "page": 10
  },
  {
    "countryName": "JORDAN",
    "countryCode": "JO",
    "currencyName": "Jordanian Dinar",
    "currencyCode": "JOD",
    "currencies": [
      {
        "currencyName": "Jordanian Dinar",
        "currencyCode": "JOD",
        "page": 10
      }
    ],
    "page": 10
  },
  {
    "countryName": "KAZAKHSTAN",
    "countryCode": "KZ",
    "currencyName": "Tenge",
    "currencyCode": "KZT",
    "currencies": [
      {
        "currencyName": "Tenge",
        "currencyCode": "KZT",
        "page": 10
      }
    ],
    "page": 10
  },
  {
    "countryName": "KENYA",
    "countryCode": "KE",
    "currencyName": "Kenyan Shilling",
    "currencyCode": "KES",
    "currencies": [
      {
        "currencyName": "Kenyan Shilling",
        "currencyCode": "KES",
        "page": 10
      }
    ],
    "page": 10
  },
  {
    "countryName": "KIRIBATI",
    "countryCode": "KI",
    "currencyName": "Australian Dollar",
    "currencyCode": "AUD",
    "currencies": [
      {
        "currencyName": "Australian Dollar",
        "currencyCode": "AUD",
        "page": 10
      }
    ],
    "page": 10
  },
  {
    "countryName": "KOREA, DEMOCRATIC PEOPLE\u2019S REPUBLIC OF",
    "countryCode": "KP",
    "currencyName": "North Korean Won",
    "currencyCode": "KPW",
    "currencies": [
      {
        "currencyName": "North Korean Won",
        "currencyCode": "KPW",
        "page": 10
      }
    ],
    "page": 10
  },
  {
    "countryName": "KOREA, REPUBLIC OF",
    "countryCode": "KR",
    "currencyName": "Won",
    "currencyCode": "KRW",
    "currencies": [
      {
        "currencyName": "Won",
        "currencyCode": "KRW",
        "page": 10
      }
    ],
    "page": 10
  },
  {
    "countryName": "KOSOVO",
    "countryCode": "KV",
    "currencyName": "Euro",
    "currencyCode": "EUR",
    "currencies": [
      {
        "currencyName": "Euro",
        "currencyCode": "EUR",
        "page": 10
      }
    ],
    "page": 10,
    "isNonStandardIso": true,
    "notes": "Non-standard CBP country code for Kosovo (ISO user-assigned is XK)."
  },
  {
    "countryName": "KUWAIT",
    "countryCode": "KW",
    "currencyName": "Kuwaiti Dinar",
    "currencyCode": "KWD",
    "currencies": [
      {
        "currencyName": "Kuwaiti Dinar",
        "currencyCode": "KWD",
        "page": 10
      }
    ],
    "page": 10
  },
  {
    "countryName": "KYRGYZSTAN",
    "countryCode": "KG",
    "currencyName": "Som",
    "currencyCode": "KGS",
    "currencies": [
      {
        "currencyName": "Som",
        "currencyCode": "KGS",
        "page": 10
      }
    ],
    "page": 10
  },
  {
    "countryName": "LAOS PEOPLE\u2019S DEMOCRATIC REPUBLIC",
    "countryCode": "LA",
    "currencyName": "Kip",
    "currencyCode": "LAK",
    "currencies": [
      {
        "currencyName": "Kip",
        "currencyCode": "LAK",
        "page": 10
      }
    ],
    "page": 10
  },
  {
    "countryName": "LATVIA",
    "countryCode": "LV",
    "currencyName": "Latvian Lats",
    "currencyCode": "LVL",
    "currencies": [
      {
        "currencyName": "Latvian Lats",
        "currencyCode": "LVL",
        "page": 10
      }
    ],
    "page": 10
  },
  {
    "countryName": "LEBANON",
    "countryCode": "LB",
    "currencyName": "Lebanese Pound",
    "currencyCode": "LBP",
    "currencies": [
      {
        "currencyName": "Lebanese Pound",
        "currencyCode": "LBP",
        "page": 11
      }
    ],
    "page": 11
  },
  {
    "countryName": "LESOTHO",
    "countryCode": "LS",
    "currencyName": "Rand",
    "currencyCode": "ZAR",
    "currencies": [
      {
        "currencyName": "Rand",
        "currencyCode": "ZAR",
        "page": 11
      },
      {
        "currencyName": "Loti",
        "currencyCode": "LSL",
        "page": 11
      }
    ],
    "page": 11
  },
  {
    "countryName": "LIBERIA",
    "countryCode": "LR",
    "currencyName": "Liberian Dollar",
    "currencyCode": "LRD",
    "currencies": [
      {
        "currencyName": "Liberian Dollar",
        "currencyCode": "LRD",
        "page": 11
      }
    ],
    "page": 11
  },
  {
    "countryName": "LIBYA ARAB JAMAHIRIYA",
    "countryCode": "LY",
    "currencyName": "Libyan Dollar",
    "currencyCode": "LYD",
    "currencies": [
      {
        "currencyName": "Libyan Dollar",
        "currencyCode": "LYD",
        "page": 11
      }
    ],
    "page": 11
  },
  {
    "countryName": "LIECHTENSTEIN",
    "countryCode": "LI",
    "currencyName": "Swiss Franc",
    "currencyCode": "CHF",
    "currencies": [
      {
        "currencyName": "Swiss Franc",
        "currencyCode": "CHF",
        "page": 11
      }
    ],
    "page": 11
  },
  {
    "countryName": "LITHUANIA",
    "countryCode": "LT",
    "currencyName": "Lithuanian Litas",
    "currencyCode": "LTL",
    "currencies": [
      {
        "currencyName": "Lithuanian Litas",
        "currencyCode": "LTL",
        "page": 11
      }
    ],
    "page": 11
  },
  {
    "countryName": "LUXEMBOURG",
    "countryCode": "LU",
    "currencyName": "Euro",
    "currencyCode": "EUR",
    "currencies": [
      {
        "currencyName": "Euro",
        "currencyCode": "EUR",
        "page": 11
      }
    ],
    "page": 11
  },
  {
    "countryName": "MACAO",
    "countryCode": "MO",
    "currencyName": "Pataca",
    "currencyCode": "MOP",
    "currencies": [
      {
        "currencyName": "Pataca",
        "currencyCode": "MOP",
        "page": 11
      }
    ],
    "page": 11
  },
  {
    "countryName": "NORTH MACEDONIA, REPUBLIC OF",
    "countryCode": "MK",
    "currencyName": "Denar",
    "currencyCode": "MKD",
    "currencies": [
      {
        "currencyName": "Denar",
        "currencyCode": "MKD",
        "page": 11
      }
    ],
    "page": 11
  },
  {
    "countryName": "MADAGASCAR",
    "countryCode": "MG",
    "currencyName": "Malagasy Ariary",
    "currencyCode": "MGA",
    "currencies": [
      {
        "currencyName": "Malagasy Ariary",
        "currencyCode": "MGA",
        "page": 11
      }
    ],
    "page": 11
  },
  {
    "countryName": "MALAWI",
    "countryCode": "MW",
    "currencyName": "Kwacha",
    "currencyCode": "MWK",
    "currencies": [
      {
        "currencyName": "Kwacha",
        "currencyCode": "MWK",
        "page": 11
      }
    ],
    "page": 11
  },
  {
    "countryName": "MALAYSIA",
    "countryCode": "MY",
    "currencyName": "Malaysian Ringgit",
    "currencyCode": "MYR",
    "currencies": [
      {
        "currencyName": "Malaysian Ringgit",
        "currencyCode": "MYR",
        "page": 11
      }
    ],
    "page": 11
  },
  {
    "countryName": "MALDIVES",
    "countryCode": "MV",
    "currencyName": "Rufiyaa",
    "currencyCode": "MVR",
    "currencies": [
      {
        "currencyName": "Rufiyaa",
        "currencyCode": "MVR",
        "page": 11
      }
    ],
    "page": 11
  },
  {
    "countryName": "MALI",
    "countryCode": "ML",
    "currencyName": "CFA Franc",
    "currencyCode": "XOF",
    "currencies": [
      {
        "currencyName": "CFA Franc",
        "currencyCode": "XOF",
        "page": 11
      }
    ],
    "page": 11
  },
  {
    "countryName": "MALTA",
    "countryCode": "MT",
    "currencyName": "Euro",
    "currencyCode": "EUR",
    "currencies": [
      {
        "currencyName": "Euro",
        "currencyCode": "EUR",
        "page": 11
      }
    ],
    "page": 11
  },
  {
    "countryName": "MARSHALL ISLANDS",
    "countryCode": "MH",
    "currencyName": "US Dollar",
    "currencyCode": "USD",
    "currencies": [
      {
        "currencyName": "US Dollar",
        "currencyCode": "USD",
        "page": 11
      }
    ],
    "page": 11
  },
  {
    "countryName": "MARTINIQUE",
    "countryCode": "MQ",
    "currencyName": "Euro",
    "currencyCode": "EUR",
    "currencies": [
      {
        "currencyName": "Euro",
        "currencyCode": "EUR",
        "page": 11
      }
    ],
    "page": 11
  },
  {
    "countryName": "MAURITANIA",
    "countryCode": "MR",
    "currencyName": "Ouguiya",
    "currencyCode": "MRO",
    "currencies": [
      {
        "currencyName": "Ouguiya",
        "currencyCode": "MRO",
        "page": 11
      }
    ],
    "page": 11
  },
  {
    "countryName": "MAURITIUS",
    "countryCode": "MU",
    "currencyName": "Mauritius Rupee",
    "currencyCode": "MUR",
    "currencies": [
      {
        "currencyName": "Mauritius Rupee",
        "currencyCode": "MUR",
        "page": 11
      }
    ],
    "page": 11
  },
  {
    "countryName": "MAYOTTE",
    "countryCode": "YT",
    "currencyName": "Euro",
    "currencyCode": "EUR",
    "currencies": [
      {
        "currencyName": "Euro",
        "currencyCode": "EUR",
        "page": 11
      }
    ],
    "page": 11
  },
  {
    "countryName": "MEXICO",
    "countryCode": "MX",
    "currencyName": "Mexican Peso",
    "currencyCode": "MXN",
    "currencies": [
      {
        "currencyName": "Mexican Peso",
        "currencyCode": "MXN",
        "page": 11
      }
    ],
    "page": 11
  },
  {
    "countryName": "MICRONESIA, FEDERATED STATE OF",
    "countryCode": "FM",
    "currencyName": "US Dollar",
    "currencyCode": "USD",
    "currencies": [
      {
        "currencyName": "US Dollar",
        "currencyCode": "USD",
        "page": 11
      }
    ],
    "page": 11
  },
  {
    "countryName": "MOLDOVA, REPUBLIC OF",
    "countryCode": "MD",
    "currencyName": "Moldovan Leu",
    "currencyCode": "MDL",
    "currencies": [
      {
        "currencyName": "Moldovan Leu",
        "currencyCode": "MDL",
        "page": 11
      }
    ],
    "page": 11
  },
  {
    "countryName": "MONACO",
    "countryCode": "MC",
    "currencyName": "Euro",
    "currencyCode": "EUR",
    "currencies": [
      {
        "currencyName": "Euro",
        "currencyCode": "EUR",
        "page": 11
      }
    ],
    "page": 11
  },
  {
    "countryName": "MONGOLIA",
    "countryCode": "MN",
    "currencyName": "Tugrik",
    "currencyCode": "MNT",
    "currencies": [
      {
        "currencyName": "Tugrik",
        "currencyCode": "MNT",
        "page": 11
      }
    ],
    "page": 11
  },
  {
    "countryName": "MONTENEGRO",
    "countryCode": "ME",
    "currencyName": "Euro",
    "currencyCode": "EUR",
    "currencies": [
      {
        "currencyName": "Euro",
        "currencyCode": "EUR",
        "page": 12
      }
    ],
    "page": 12
  },
  {
    "countryName": "MONTSERRAT",
    "countryCode": "MS",
    "currencyName": "East Caribbean Dollar",
    "currencyCode": "XCD",
    "currencies": [
      {
        "currencyName": "East Caribbean Dollar",
        "currencyCode": "XCD",
        "page": 12
      }
    ],
    "page": 12
  },
  {
    "countryName": "MOROCCO",
    "countryCode": "MA",
    "currencyName": "Moroccan Dirham",
    "currencyCode": "MAD",
    "currencies": [
      {
        "currencyName": "Moroccan Dirham",
        "currencyCode": "MAD",
        "page": 12
      }
    ],
    "page": 12
  },
  {
    "countryName": "MOZAMBIQUE",
    "countryCode": "MZ",
    "currencyName": "Metical",
    "currencyCode": "MZN",
    "currencies": [
      {
        "currencyName": "Metical",
        "currencyCode": "MZN",
        "page": 12
      }
    ],
    "page": 12
  },
  {
    "countryName": "NAMIBIA",
    "countryCode": "NA",
    "currencyName": "Rand",
    "currencyCode": "ZAR",
    "currencies": [
      {
        "currencyName": "Rand",
        "currencyCode": "ZAR",
        "page": 12
      },
      {
        "currencyName": "Namibian Dollar",
        "currencyCode": "NAD",
        "page": 12
      }
    ],
    "page": 12
  },
  {
    "countryName": "NAURU",
    "countryCode": "NR",
    "currencyName": "Australian Dollar",
    "currencyCode": "AUD",
    "currencies": [
      {
        "currencyName": "Australian Dollar",
        "currencyCode": "AUD",
        "page": 12
      }
    ],
    "page": 12
  },
  {
    "countryName": "NEPAL",
    "countryCode": "NP",
    "currencyName": "Nepalese Rupee",
    "currencyCode": "NPR",
    "currencies": [
      {
        "currencyName": "Nepalese Rupee",
        "currencyCode": "NPR",
        "page": 12
      }
    ],
    "page": 12
  },
  {
    "countryName": "NETHERLANDS",
    "countryCode": "NL",
    "currencyName": "Euro",
    "currencyCode": "EUR",
    "currencies": [
      {
        "currencyName": "Euro",
        "currencyCode": "EUR",
        "page": 12
      }
    ],
    "page": 12
  },
  {
    "countryName": "NEW CALEDONIA",
    "countryCode": "NC",
    "currencyName": "CFP Franc",
    "currencyCode": "XPF",
    "currencies": [
      {
        "currencyName": "CFP Franc",
        "currencyCode": "XPF",
        "page": 12
      }
    ],
    "page": 12
  },
  {
    "countryName": "NEW ZEALAND",
    "countryCode": "NZ",
    "currencyName": "New Zealand Dollar",
    "currencyCode": "NZD",
    "currencies": [
      {
        "currencyName": "New Zealand Dollar",
        "currencyCode": "NZD",
        "page": 12
      }
    ],
    "page": 12
  },
  {
    "countryName": "NICARAGUA",
    "countryCode": "NI",
    "currencyName": "Cordoba Oro",
    "currencyCode": "NIO",
    "currencies": [
      {
        "currencyName": "Cordoba Oro",
        "currencyCode": "NIO",
        "page": 12
      }
    ],
    "page": 12
  },
  {
    "countryName": "NIGER",
    "countryCode": "NE",
    "currencyName": "CFA Franc",
    "currencyCode": "XOF",
    "currencies": [
      {
        "currencyName": "CFA Franc",
        "currencyCode": "XOF",
        "page": 12
      }
    ],
    "page": 12
  },
  {
    "countryName": "NIGERIA",
    "countryCode": "NG",
    "currencyName": "Naira",
    "currencyCode": "NGN",
    "currencies": [
      {
        "currencyName": "Naira",
        "currencyCode": "NGN",
        "page": 12
      }
    ],
    "page": 12
  },
  {
    "countryName": "NIUE",
    "countryCode": "NU",
    "currencyName": "New Zealand Dollar",
    "currencyCode": "NZD",
    "currencies": [
      {
        "currencyName": "New Zealand Dollar",
        "currencyCode": "NZD",
        "page": 12
      }
    ],
    "page": 12
  },
  {
    "countryName": "NORFOLK ISLAND",
    "countryCode": "NF",
    "currencyName": "Australian Dollar",
    "currencyCode": "AUD",
    "currencies": [
      {
        "currencyName": "Australian Dollar",
        "currencyCode": "AUD",
        "page": 12
      }
    ],
    "page": 12
  },
  {
    "countryName": "NORTHERN MARIANA ISLANDS",
    "countryCode": "MP",
    "currencyName": "US Dollar",
    "currencyCode": "USD",
    "currencies": [
      {
        "currencyName": "US Dollar",
        "currencyCode": "USD",
        "page": 12
      }
    ],
    "page": 12
  },
  {
    "countryName": "NORWAY",
    "countryCode": "NO",
    "currencyName": "Norwegian Krone",
    "currencyCode": "NOK",
    "currencies": [
      {
        "currencyName": "Norwegian Krone",
        "currencyCode": "NOK",
        "page": 12
      }
    ],
    "page": 12
  },
  {
    "countryName": "OMAN",
    "countryCode": "OM",
    "currencyName": "Rial Omani",
    "currencyCode": "OMR",
    "currencies": [
      {
        "currencyName": "Rial Omani",
        "currencyCode": "OMR",
        "page": 12
      }
    ],
    "page": 12
  },
  {
    "countryName": "PAKISTAN",
    "countryCode": "PK",
    "currencyName": "Pakistan Rupee",
    "currencyCode": "PKR",
    "currencies": [
      {
        "currencyName": "Pakistan Rupee",
        "currencyCode": "PKR",
        "page": 12
      }
    ],
    "page": 12
  },
  {
    "countryName": "PALAU",
    "countryCode": "PW",
    "currencyName": "US Dollar",
    "currencyCode": "USD",
    "currencies": [
      {
        "currencyName": "US Dollar",
        "currencyCode": "USD",
        "page": 12
      }
    ],
    "page": 12
  },
  {
    "countryName": "PANAMA",
    "countryCode": "PA",
    "currencyName": "Balboa",
    "currencyCode": "PAB",
    "currencies": [
      {
        "currencyName": "Balboa",
        "currencyCode": "PAB",
        "page": 12
      },
      {
        "currencyName": "US Dollar",
        "currencyCode": "USD",
        "page": 12
      }
    ],
    "page": 12
  },
  {
    "countryName": "PAPUA NEW GUINEA",
    "countryCode": "PG",
    "currencyName": "Kina",
    "currencyCode": "PGK",
    "currencies": [
      {
        "currencyName": "Kina",
        "currencyCode": "PGK",
        "page": 12
      }
    ],
    "page": 12
  },
  {
    "countryName": "PARAGUAY",
    "countryCode": "PY",
    "currencyName": "Guarani",
    "currencyCode": "PYG",
    "currencies": [
      {
        "currencyName": "Guarani",
        "currencyCode": "PYG",
        "page": 12
      }
    ],
    "page": 12
  },
  {
    "countryName": "PERU",
    "countryCode": "PE",
    "currencyName": "Nuevo Sol",
    "currencyCode": "PEN",
    "currencies": [
      {
        "currencyName": "Nuevo Sol",
        "currencyCode": "PEN",
        "page": 12
      }
    ],
    "page": 12
  },
  {
    "countryName": "PHILIPPINES",
    "countryCode": "PH",
    "currencyName": "Philippine Peso",
    "currencyCode": "PHP",
    "currencies": [
      {
        "currencyName": "Philippine Peso",
        "currencyCode": "PHP",
        "page": 13
      }
    ],
    "page": 13
  },
  {
    "countryName": "PITCAIRN",
    "countryCode": "PN",
    "currencyName": "New Zealand Dollar",
    "currencyCode": "NZD",
    "currencies": [
      {
        "currencyName": "New Zealand Dollar",
        "currencyCode": "NZD",
        "page": 13
      }
    ],
    "page": 13
  },
  {
    "countryName": "POLAND",
    "countryCode": "PL",
    "currencyName": "Zloty",
    "currencyCode": "PLZ",
    "currencies": [
      {
        "currencyName": "Zloty",
        "currencyCode": "PLZ",
        "page": 13
      }
    ],
    "page": 13
  },
  {
    "countryName": "PORTUGAL",
    "countryCode": "PT",
    "currencyName": "Euro",
    "currencyCode": "EUR",
    "currencies": [
      {
        "currencyName": "Euro",
        "currencyCode": "EUR",
        "page": 13
      }
    ],
    "page": 13
  },
  {
    "countryName": "PUERTO RICO",
    "countryCode": "PR",
    "currencyName": "US Dollar",
    "currencyCode": "USD",
    "currencies": [
      {
        "currencyName": "US Dollar",
        "currencyCode": "USD",
        "page": 13
      }
    ],
    "page": 13
  },
  {
    "countryName": "QATAR",
    "countryCode": "QA",
    "currencyName": "Qatari Rial",
    "currencyCode": "QAR",
    "currencies": [
      {
        "currencyName": "Qatari Rial",
        "currencyCode": "QAR",
        "page": 13
      }
    ],
    "page": 13
  },
  {
    "countryName": "REUNION",
    "countryCode": "RE",
    "currencyName": "Euro",
    "currencyCode": "EUR",
    "currencies": [
      {
        "currencyName": "Euro",
        "currencyCode": "EUR",
        "page": 13
      }
    ],
    "page": 13
  },
  {
    "countryName": "ROMANIA",
    "countryCode": "RO",
    "currencyName": "New Leu",
    "currencyCode": "RON",
    "currencies": [
      {
        "currencyName": "New Leu",
        "currencyCode": "RON",
        "page": 13
      }
    ],
    "page": 13
  },
  {
    "countryName": "RUSSIAN FEDERATION",
    "countryCode": "RU",
    "currencyName": "Russian Ruble",
    "currencyCode": "RUB",
    "currencies": [
      {
        "currencyName": "Russian Ruble",
        "currencyCode": "RUB",
        "page": 13
      }
    ],
    "page": 13
  },
  {
    "countryName": "RWANDA",
    "countryCode": "RW",
    "currencyName": "Rwandan Franc",
    "currencyCode": "RWF",
    "currencies": [
      {
        "currencyName": "Rwandan Franc",
        "currencyCode": "RWF",
        "page": 13
      }
    ],
    "page": 13
  },
  {
    "countryName": "ST. HELENA",
    "countryCode": "SH",
    "currencyName": "St. Helena Pound",
    "currencyCode": "SHP",
    "currencies": [
      {
        "currencyName": "St. Helena Pound",
        "currencyCode": "SHP",
        "page": 13
      }
    ],
    "page": 13
  },
  {
    "countryName": "ST. KITTS-NEVIS",
    "countryCode": "KN",
    "currencyName": "East Caribbean Dollar",
    "currencyCode": "XCD",
    "currencies": [
      {
        "currencyName": "East Caribbean Dollar",
        "currencyCode": "XCD",
        "page": 13
      }
    ],
    "page": 13
  },
  {
    "countryName": "ST. PIERRE AND MIQUELON",
    "countryCode": "PM",
    "currencyName": "Euro",
    "currencyCode": "EUR",
    "currencies": [
      {
        "currencyName": "Euro",
        "currencyCode": "EUR",
        "page": 13
      }
    ],
    "page": 13
  },
  {
    "countryName": "SAINT LUCIA",
    "countryCode": "LC",
    "currencyName": "East Caribbean Dollar",
    "currencyCode": "XCD",
    "currencies": [
      {
        "currencyName": "East Caribbean Dollar",
        "currencyCode": "XCD",
        "page": 13
      }
    ],
    "page": 13
  },
  {
    "countryName": "SAINT VINCENT AND THE GRENADINES",
    "countryCode": "VC",
    "currencyName": "East Caribbean Dollar",
    "currencyCode": "XCD",
    "currencies": [
      {
        "currencyName": "East Caribbean Dollar",
        "currencyCode": "XCD",
        "page": 13
      }
    ],
    "page": 13
  },
  {
    "countryName": "SAMOA",
    "countryCode": "WS",
    "currencyName": "Tala",
    "currencyCode": "WST",
    "currencies": [
      {
        "currencyName": "Tala",
        "currencyCode": "WST",
        "page": 13
      }
    ],
    "page": 13
  },
  {
    "countryName": "SAN MARINO",
    "countryCode": "SM",
    "currencyName": "Euro",
    "currencyCode": "EUR",
    "currencies": [
      {
        "currencyName": "Euro",
        "currencyCode": "EUR",
        "page": 13
      }
    ],
    "page": 13
  },
  {
    "countryName": "SAO TOMES AND PRINCIPE",
    "countryCode": "ST",
    "currencyName": "Dobra",
    "currencyCode": "STD",
    "currencies": [
      {
        "currencyName": "Dobra",
        "currencyCode": "STD",
        "page": 13
      }
    ],
    "page": 13
  },
  {
    "countryName": "SAUDI ARABIA",
    "countryCode": "SA",
    "currencyName": "Saudi Riyal",
    "currencyCode": "SAR",
    "currencies": [
      {
        "currencyName": "Saudi Riyal",
        "currencyCode": "SAR",
        "page": 13
      }
    ],
    "page": 13
  },
  {
    "countryName": "SENEGAL",
    "countryCode": "SN",
    "currencyName": "CFA Franc",
    "currencyCode": "XOF",
    "currencies": [
      {
        "currencyName": "CFA Franc",
        "currencyCode": "XOF",
        "page": 13
      }
    ],
    "page": 13
  },
  {
    "countryName": "SERBIA",
    "countryCode": "RS",
    "currencyName": "Servian Dinar",
    "currencyCode": "RSD",
    "currencies": [
      {
        "currencyName": "Servian Dinar",
        "currencyCode": "RSD",
        "page": 13
      }
    ],
    "page": 13,
    "notes": "Currency name spelled Servian Dinar in source PDF."
  },
  {
    "countryName": "SEYCHELLES",
    "countryCode": "SC",
    "currencyName": "Seychelles Rupee",
    "currencyCode": "SCR",
    "currencies": [
      {
        "currencyName": "Seychelles Rupee",
        "currencyCode": "SCR",
        "page": 13
      }
    ],
    "page": 13
  },
  {
    "countryName": "SIERRA LEONE",
    "countryCode": "SL",
    "currencyName": "Leone",
    "currencyCode": "SLL",
    "currencies": [
      {
        "currencyName": "Leone",
        "currencyCode": "SLL",
        "page": 13
      }
    ],
    "page": 13
  },
  {
    "countryName": "SINGAPORE",
    "countryCode": "SG",
    "currencyName": "Singapore Dollar",
    "currencyCode": "SGD",
    "currencies": [
      {
        "currencyName": "Singapore Dollar",
        "currencyCode": "SGD",
        "page": 13
      }
    ],
    "page": 13
  },
  {
    "countryName": "SINT MAARTEN",
    "countryCode": "SX",
    "currencyName": "Netherlands Antillean Guilder",
    "currencyCode": "ANG",
    "currencies": [
      {
        "currencyName": "Netherlands Antillean Guilder",
        "currencyCode": "ANG",
        "page": 13
      }
    ],
    "page": 13
  },
  {
    "countryName": "SLOVAKIA",
    "countryCode": "SK",
    "currencyName": "Slovak Koruna",
    "currencyCode": "SKK",
    "currencies": [
      {
        "currencyName": "Slovak Koruna",
        "currencyCode": "SKK",
        "page": 13
      },
      {
        "currencyName": "Euro (Effective 1 January 2009)",
        "currencyCode": "EUR",
        "page": 14
      }
    ],
    "page": 13,
    "notes": "Multi-currency entry spanning page boundary (SKK on Page 13, EUR effective 2009 on Page 14)."
  },
  {
    "countryName": "SLOVENIA",
    "countryCode": "SI",
    "currencyName": "Euro",
    "currencyCode": "EUR",
    "currencies": [
      {
        "currencyName": "Euro",
        "currencyCode": "EUR",
        "page": 14
      }
    ],
    "page": 14
  },
  {
    "countryName": "SOLOMON ISLANDS",
    "countryCode": "SB",
    "currencyName": "Solomon Islands Dollar",
    "currencyCode": "SBD",
    "currencies": [
      {
        "currencyName": "Solomon Islands Dollar",
        "currencyCode": "SBD",
        "page": 14
      }
    ],
    "page": 14
  },
  {
    "countryName": "SOMALIA",
    "countryCode": "SO",
    "currencyName": "Somali Shilling",
    "currencyCode": "SOS",
    "currencies": [
      {
        "currencyName": "Somali Shilling",
        "currencyCode": "SOS",
        "page": 14
      }
    ],
    "page": 14
  },
  {
    "countryName": "SOUTH AFRICA",
    "countryCode": "ZA",
    "currencyName": "Rand",
    "currencyCode": "ZAR",
    "currencies": [
      {
        "currencyName": "Rand",
        "currencyCode": "ZAR",
        "page": 14
      }
    ],
    "page": 14
  },
  {
    "countryName": "SOUTH SUDAN",
    "countryCode": "SS",
    "currencyName": "Sudanese Pound",
    "currencyCode": "SDP",
    "currencies": [
      {
        "currencyName": "Sudanese Pound",
        "currencyCode": "SDP",
        "page": 14
      }
    ],
    "page": 14
  },
  {
    "countryName": "SPAIN",
    "countryCode": "ES",
    "currencyName": "Euro",
    "currencyCode": "EUR",
    "currencies": [
      {
        "currencyName": "Euro",
        "currencyCode": "EUR",
        "page": 14
      }
    ],
    "page": 14
  },
  {
    "countryName": "SRI LANKA",
    "countryCode": "LK",
    "currencyName": "Sri Lanka Rupee",
    "currencyCode": "LKR",
    "currencies": [
      {
        "currencyName": "Sri Lanka Rupee",
        "currencyCode": "LKR",
        "page": 14
      }
    ],
    "page": 14
  },
  {
    "countryName": "SUDAN",
    "countryCode": "SD",
    "currencyName": "Sudanese Pound",
    "currencyCode": "SDP",
    "currencies": [
      {
        "currencyName": "Sudanese Pound",
        "currencyCode": "SDP",
        "page": 14
      }
    ],
    "page": 14
  },
  {
    "countryName": "SURINAME",
    "countryCode": "SR",
    "currencyName": "Surinam Dollar",
    "currencyCode": "SRD",
    "currencies": [
      {
        "currencyName": "Surinam Dollar",
        "currencyCode": "SRD",
        "page": 14
      }
    ],
    "page": 14
  },
  {
    "countryName": "SVALBARD AND JAN MAYEN, ISLANDS",
    "countryCode": "SJ",
    "currencyName": "Norwegian Krone",
    "currencyCode": "NOK",
    "currencies": [
      {
        "currencyName": "Norwegian Krone",
        "currencyCode": "NOK",
        "page": 14
      }
    ],
    "page": 14
  },
  {
    "countryName": "SWAZILAND",
    "countryCode": "SZ",
    "currencyName": "Lilangeni",
    "currencyCode": "SZL",
    "currencies": [
      {
        "currencyName": "Lilangeni",
        "currencyCode": "SZL",
        "page": 14
      }
    ],
    "page": 14
  },
  {
    "countryName": "SWEDEN",
    "countryCode": "SE",
    "currencyName": "Swedish Krona",
    "currencyCode": "SEK",
    "currencies": [
      {
        "currencyName": "Swedish Krona",
        "currencyCode": "SEK",
        "page": 14
      }
    ],
    "page": 14
  },
  {
    "countryName": "SWITZERLAND",
    "countryCode": "CH",
    "currencyName": "Swiss Frank",
    "currencyCode": "CHF",
    "currencies": [
      {
        "currencyName": "Swiss Frank",
        "currencyCode": "CHF",
        "page": 14
      },
      {
        "currencyName": "WIR Franc",
        "currencyCode": "CHW",
        "page": 14
      },
      {
        "currencyName": "WIR Euro",
        "currencyCode": "CHE",
        "page": 14
      }
    ],
    "page": 14,
    "notes": "Includes standard CHF plus CHW (WIR Franc) and CHE (WIR Euro)."
  },
  {
    "countryName": "SYRIAN ARAB REPUBLIC",
    "countryCode": "SY",
    "currencyName": "Syrian Pound",
    "currencyCode": "SYP",
    "currencies": [
      {
        "currencyName": "Syrian Pound",
        "currencyCode": "SYP",
        "page": 14
      }
    ],
    "page": 14
  },
  {
    "countryName": "TAIWAN, PROVINCE OF CHINA",
    "countryCode": "TW",
    "currencyName": "New Taiwan Dollar",
    "currencyCode": "TWD",
    "currencies": [
      {
        "currencyName": "New Taiwan Dollar",
        "currencyCode": "TWD",
        "page": 14
      }
    ],
    "page": 14
  },
  {
    "countryName": "TAJIKISTAN",
    "countryCode": "TJ",
    "currencyName": "Somoni",
    "currencyCode": "TJS",
    "currencies": [
      {
        "currencyName": "Somoni",
        "currencyCode": "TJS",
        "page": 14
      }
    ],
    "page": 14
  },
  {
    "countryName": "TANZANIA, UNITED REPUBLIC OF",
    "countryCode": "TZ",
    "currencyName": "Tanzanian Shilling",
    "currencyCode": "TZS",
    "currencies": [
      {
        "currencyName": "Tanzanian Shilling",
        "currencyCode": "TZS",
        "page": 14
      }
    ],
    "page": 14
  },
  {
    "countryName": "THAILAND",
    "countryCode": "TH",
    "currencyName": "Baht",
    "currencyCode": "THB",
    "currencies": [
      {
        "currencyName": "Baht",
        "currencyCode": "THB",
        "page": 14
      }
    ],
    "page": 14
  },
  {
    "countryName": "TIMOR-LESTE",
    "countryCode": "TL",
    "currencyName": "US Dollar",
    "currencyCode": "USD",
    "currencies": [
      {
        "currencyName": "US Dollar",
        "currencyCode": "USD",
        "page": 14
      }
    ],
    "page": 14
  },
  {
    "countryName": "TOGO",
    "countryCode": "TG",
    "currencyName": "CFA Franc",
    "currencyCode": "XOF",
    "currencies": [
      {
        "currencyName": "CFA Franc",
        "currencyCode": "XOF",
        "page": 14
      }
    ],
    "page": 14
  },
  {
    "countryName": "TOKELAU",
    "countryCode": "TK",
    "currencyName": "New Zealand Dollar",
    "currencyCode": "NZD",
    "currencies": [
      {
        "currencyName": "New Zealand Dollar",
        "currencyCode": "NZD",
        "page": 14
      }
    ],
    "page": 14
  },
  {
    "countryName": "TONGA",
    "countryCode": "TO",
    "currencyName": "Pa'anga",
    "currencyCode": "TOP",
    "currencies": [
      {
        "currencyName": "Pa'anga",
        "currencyCode": "TOP",
        "page": 14
      }
    ],
    "page": 14
  },
  {
    "countryName": "TRINIDAD AND TOBAGO",
    "countryCode": "TT",
    "currencyName": "Trinidad and Tobago Dollar",
    "currencyCode": "TTD",
    "currencies": [
      {
        "currencyName": "Trinidad and Tobago Dollar",
        "currencyCode": "TTD",
        "page": 14
      }
    ],
    "page": 14
  },
  {
    "countryName": "TUNISIA",
    "countryCode": "TN",
    "currencyName": "Tunisian Dinar",
    "currencyCode": "TND",
    "currencies": [
      {
        "currencyName": "Tunisian Dinar",
        "currencyCode": "TND",
        "page": 15
      }
    ],
    "page": 15
  },
  {
    "countryName": "TURKEY",
    "countryCode": "TR",
    "currencyName": "New Turkish Lira",
    "currencyCode": "TRY",
    "currencies": [
      {
        "currencyName": "New Turkish Lira",
        "currencyCode": "TRY",
        "page": 15
      }
    ],
    "page": 15
  },
  {
    "countryName": "TURKMENISTAN",
    "countryCode": "TM",
    "currencyName": "Manat",
    "currencyCode": "TMM",
    "currencies": [
      {
        "currencyName": "Manat",
        "currencyCode": "TMM",
        "page": 15
      }
    ],
    "page": 15
  },
  {
    "countryName": "TURKS AND CAICOS ISLANDS",
    "countryCode": "TC",
    "currencyName": "US Dollar",
    "currencyCode": "USD",
    "currencies": [
      {
        "currencyName": "US Dollar",
        "currencyCode": "USD",
        "page": 15
      }
    ],
    "page": 15
  },
  {
    "countryName": "TUVALU",
    "countryCode": "TV",
    "currencyName": "Australian Dollar",
    "currencyCode": "AUD",
    "currencies": [
      {
        "currencyName": "Australian Dollar",
        "currencyCode": "AUD",
        "page": 15
      }
    ],
    "page": 15
  },
  {
    "countryName": "UGANDA",
    "countryCode": "UG",
    "currencyName": "Uganda Shilling",
    "currencyCode": "UGS",
    "currencies": [
      {
        "currencyName": "Uganda Shilling",
        "currencyCode": "UGS",
        "page": 15
      }
    ],
    "page": 15
  },
  {
    "countryName": "UKRAINE",
    "countryCode": "UA",
    "currencyName": "Hryvnia",
    "currencyCode": "UAH",
    "currencies": [
      {
        "currencyName": "Hryvnia",
        "currencyCode": "UAH",
        "page": 15
      }
    ],
    "page": 15
  },
  {
    "countryName": "UNITED ARAB EMIRATES",
    "countryCode": "AE",
    "currencyName": "UAE Dirham",
    "currencyCode": "AED",
    "currencies": [
      {
        "currencyName": "UAE Dirham",
        "currencyCode": "AED",
        "page": 15
      }
    ],
    "page": 15
  },
  {
    "countryName": "UNITED KINGDOM",
    "countryCode": "GB",
    "currencyName": "Pound Sterling",
    "currencyCode": "GBP",
    "currencies": [
      {
        "currencyName": "Pound Sterling",
        "currencyCode": "GBP",
        "page": 15
      }
    ],
    "page": 15
  },
  {
    "countryName": "UNITED STATES",
    "countryCode": "US",
    "currencyName": "US Dollar",
    "currencyCode": "USD",
    "currencies": [
      {
        "currencyName": "US Dollar",
        "currencyCode": "USD",
        "page": 15
      },
      {
        "currencyName": "(Same Day)",
        "currencyCode": "USS",
        "page": 15
      },
      {
        "currencyName": "(Next Day)",
        "currencyCode": "USN",
        "page": 15
      }
    ],
    "page": 15,
    "notes": "Includes standard USD plus CBP banking codes USS (Same Day) and USN (Next Day)."
  },
  {
    "countryName": "UNITED STATES MINOR OUTLYING ISLANDS",
    "countryCode": "UM",
    "currencyName": "US Dollar",
    "currencyCode": "USD",
    "currencies": [
      {
        "currencyName": "US Dollar",
        "currencyCode": "USD",
        "page": 15
      }
    ],
    "page": 15
  },
  {
    "countryName": "URUGUAY",
    "countryCode": "UY",
    "currencyName": "Peso Uruguayo",
    "currencyCode": "UYU",
    "currencies": [
      {
        "currencyName": "Peso Uruguayo",
        "currencyCode": "UYU",
        "page": 15
      }
    ],
    "page": 15
  },
  {
    "countryName": "UZBEKISTAN",
    "countryCode": "UZ",
    "currencyName": "Uzbekistan Sum",
    "currencyCode": "UZS",
    "currencies": [
      {
        "currencyName": "Uzbekistan Sum",
        "currencyCode": "UZS",
        "page": 15
      }
    ],
    "page": 15
  },
  {
    "countryName": "VANUATU",
    "countryCode": "VU",
    "currencyName": "Vatu",
    "currencyCode": "VUV",
    "currencies": [
      {
        "currencyName": "Vatu",
        "currencyCode": "VUV",
        "page": 15
      }
    ],
    "page": 15
  },
  {
    "countryName": "VENEZUELA",
    "countryCode": "VE",
    "currencyName": "Bolivar Fuerte",
    "currencyCode": "VEF",
    "currencies": [
      {
        "currencyName": "Bolivar Fuerte",
        "currencyCode": "VEF",
        "page": 15
      }
    ],
    "page": 15
  },
  {
    "countryName": "VIET NAM",
    "countryCode": "VN",
    "currencyName": "Dong",
    "currencyCode": "VND",
    "currencies": [
      {
        "currencyName": "Dong",
        "currencyCode": "VND",
        "page": 15
      }
    ],
    "page": 15
  },
  {
    "countryName": "VIRGIN ISLANDS (BRITISH)",
    "countryCode": "VG",
    "currencyName": "US Dollar",
    "currencyCode": "USD",
    "currencies": [
      {
        "currencyName": "US Dollar",
        "currencyCode": "USD",
        "page": 15
      }
    ],
    "page": 15
  },
  {
    "countryName": "VIRGIN ISLANDS (U.S.)",
    "countryCode": "VI",
    "currencyName": "US Dollar",
    "currencyCode": "USD",
    "currencies": [
      {
        "currencyName": "US Dollar",
        "currencyCode": "USD",
        "page": 15
      }
    ],
    "page": 15
  },
  {
    "countryName": "WALLIS AND FUTUNA ISLANDS",
    "countryCode": "WF",
    "currencyName": "CFP Franc",
    "currencyCode": "XPF",
    "currencies": [
      {
        "currencyName": "CFP Franc",
        "currencyCode": "XPF",
        "page": 15
      }
    ],
    "page": 15
  },
  {
    "countryName": "WEST BANK",
    "countryCode": "WE",
    "currencyName": "Israeli Shekel",
    "currencyCode": "ILS",
    "currencies": [
      {
        "currencyName": "Israeli Shekel",
        "currencyCode": "ILS",
        "page": 15
      }
    ],
    "page": 15,
    "isNonStandardIso": true,
    "notes": "Non-standard/legacy CBP entity code for West Bank (ISO standard uses PS)."
  },
  {
    "countryName": "WESTERN SAHARA",
    "countryCode": "EH",
    "currencyName": "Moroccan Dirham",
    "currencyCode": "MAD",
    "currencies": [
      {
        "currencyName": "Moroccan Dirham",
        "currencyCode": "MAD",
        "page": 15
      }
    ],
    "page": 15
  },
  {
    "countryName": "YEMEN",
    "countryCode": "YE",
    "currencyName": "Yemeni Rial",
    "currencyCode": "YER",
    "currencies": [
      {
        "currencyName": "Yemeni Rial",
        "currencyCode": "YER",
        "page": 15
      }
    ],
    "page": 15
  },
  {
    "countryName": "ZAMBIA",
    "countryCode": "ZM",
    "currencyName": "Kwacha",
    "currencyCode": "ZMK",
    "currencies": [
      {
        "currencyName": "Kwacha",
        "currencyCode": "ZMK",
        "page": 15
      }
    ],
    "page": 15
  },
  {
    "countryName": "ZIMBABWE",
    "countryCode": "ZW",
    "currencyName": "Zimbabwe Dollar",
    "currencyCode": "ZWR",
    "currencies": [
      {
        "currencyName": "Zimbabwe Dollar",
        "currencyCode": "ZWR",
        "page": 15
      }
    ],
    "page": 15
  }
];

/**
 * Set of all valid 2-letter country codes extracted from Appendix B (including BU from change log).
 */
const VALID_COUNTRY_CODES_SET = new Set<string>([
  ...ABI_COUNTRY_CURRENCY_CODES.map((c) => c.countryCode).filter((code) => code.length === 2),
  'BU', // Flagged from Page 5 change log: "Removed MM (Myanmar) and added BU (Burma)"
]);

/**
 * Set of all valid 3-letter currency codes extracted from Appendix B.
 */
const VALID_CURRENCY_CODES_SET = new Set<string>(
  ABI_COUNTRY_CURRENCY_CODES.flatMap((c) => c.currencies.map((curr) => curr.currencyCode)).filter(
    (code) => code.length === 3
  )
);

/**
 * Lookup map from 2-letter Country Code to CountryCurrencyEntry.
 */
const COUNTRY_CODE_MAP = new Map<string, CountryCurrencyEntry>(
  ABI_COUNTRY_CURRENCY_CODES.filter((c) => c.countryCode.length === 2).map((c) => [c.countryCode, c])
);

/**
 * Array of all valid 2-letter country codes.
 */
export const ABI_VALID_COUNTRY_CODES: readonly string[] = Array.from(VALID_COUNTRY_CODES_SET).sort();

/**
 * Array of all valid 3-letter currency codes (166 unique codes).
 */
export const ABI_VALID_CURRENCY_CODES: readonly string[] = Array.from(VALID_CURRENCY_CODES_SET).sort();

/**
 * Returns true if the given 2-letter code is a valid CATAIR country code.
 */
export function isValidCountryCode(code: string): boolean {
  if (!code) return false;
  return VALID_COUNTRY_CODES_SET.has(code.toUpperCase().trim());
}

/**
 * Returns true if the given 3-letter code is a valid CATAIR currency code.
 */
export function isValidCurrencyCode(code: string): boolean {
  if (!code) return false;
  return VALID_CURRENCY_CODES_SET.has(code.toUpperCase().trim());
}

/**
 * Retrieves the country entry for a 2-letter country code.
 */
export function getCountryByCode(code: string): CountryCurrencyEntry | undefined {
  if (!code) return undefined;
  const upper = code.toUpperCase().trim();
  if (upper === 'BU') {
    // Return Burma entry if requested as BU
    return COUNTRY_CODE_MAP.get('MM');
  }
  return COUNTRY_CODE_MAP.get(upper);
}

/**
 * Returns all currency details for a given country code.
 */
export function getCurrenciesForCountry(code: string): CurrencyDetail[] {
  const country = getCountryByCode(code);
  return country ? [...country.currencies] : [];
}
