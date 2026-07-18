export type LegalRegion = "EU" | "TR" | "US" | "MENA" | "ROW";

export type CountryOption = {
  code: string;
  name: string;
  region: LegalRegion;
};

const EU_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT",
  "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO",
  "GB", "CH",
]);

const MENA_COUNTRIES = new Set([
  "AE", "SA", "QA", "KW", "BH", "OM", "EG", "MA", "DZ", "TN", "JO", "LB", "IQ", "YE", "LY",
  "PS", "SY", "IR", "IL",
]);

export const COUNTRY_OPTIONS: CountryOption[] = [
  { code: "TR", name: "Turkey", region: "TR" },
  { code: "US", name: "United States", region: "US" },
  { code: "GB", name: "United Kingdom", region: "EU" },
  { code: "DE", name: "Germany", region: "EU" },
  { code: "FR", name: "France", region: "EU" },
  { code: "NL", name: "Netherlands", region: "EU" },
  { code: "ES", name: "Spain", region: "EU" },
  { code: "IT", name: "Italy", region: "EU" },
  { code: "PL", name: "Poland", region: "EU" },
  { code: "SE", name: "Sweden", region: "EU" },
  { code: "AT", name: "Austria", region: "EU" },
  { code: "BE", name: "Belgium", region: "EU" },
  { code: "IE", name: "Ireland", region: "EU" },
  { code: "PT", name: "Portugal", region: "EU" },
  { code: "GR", name: "Greece", region: "EU" },
  { code: "RO", name: "Romania", region: "EU" },
  { code: "CZ", name: "Czech Republic", region: "EU" },
  { code: "HU", name: "Hungary", region: "EU" },
  { code: "DK", name: "Denmark", region: "EU" },
  { code: "FI", name: "Finland", region: "EU" },
  { code: "NO", name: "Norway", region: "EU" },
  { code: "CH", name: "Switzerland", region: "EU" },
  { code: "AE", name: "United Arab Emirates", region: "MENA" },
  { code: "SA", name: "Saudi Arabia", region: "MENA" },
  { code: "QA", name: "Qatar", region: "MENA" },
  { code: "EG", name: "Egypt", region: "MENA" },
  { code: "MA", name: "Morocco", region: "MENA" },
  { code: "CA", name: "Canada", region: "ROW" },
  { code: "AU", name: "Australia", region: "ROW" },
  { code: "IN", name: "India", region: "ROW" },
  { code: "JP", name: "Japan", region: "ROW" },
  { code: "KR", name: "South Korea", region: "ROW" },
  { code: "BR", name: "Brazil", region: "ROW" },
  { code: "MX", name: "Mexico", region: "ROW" },
  { code: "SG", name: "Singapore", region: "ROW" },
  { code: "OTHER", name: "Other country", region: "ROW" },
];

export function resolveLegalRegion(countryCode: string): LegalRegion {
  const code = countryCode.trim().toUpperCase();
  if (code === "TR") return "TR";
  if (code === "US") return "US";
  if (EU_COUNTRIES.has(code)) return "EU";
  if (MENA_COUNTRIES.has(code)) return "MENA";
  return "ROW";
}

export function isValidCountryCode(code: string): boolean {
  const normalized = code.trim().toUpperCase();
  return COUNTRY_OPTIONS.some((c) => c.code === normalized);
}

export function getCountryOption(code: string): CountryOption | undefined {
  const normalized = code.trim().toUpperCase();
  return COUNTRY_OPTIONS.find((c) => c.code === normalized);
}

export const COUNTRY_GROUPS: { label: string; region: LegalRegion }[] = [
  { label: "Turkey", region: "TR" },
  { label: "United States", region: "US" },
  { label: "Europe & UK", region: "EU" },
  { label: "Middle East & North Africa", region: "MENA" },
  { label: "Other", region: "ROW" },
];

export function countriesByRegion(region: LegalRegion): CountryOption[] {
  return COUNTRY_OPTIONS.filter((c) => c.region === region);
}

export function requiresStrictCookieConsent(region: LegalRegion): boolean {
  return region === "EU" || region === "TR";
}

const REGION_STORAGE_KEY = "bbo:legal-region";

export function setStoredLegalRegion(region: LegalRegion): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(REGION_STORAGE_KEY, region);
}

export function getStoredLegalRegion(): LegalRegion {
  if (typeof window === "undefined") return "ROW";
  const raw = localStorage.getItem(REGION_STORAGE_KEY);
  if (raw === "EU" || raw === "TR" || raw === "US" || raw === "MENA" || raw === "ROW") return raw;
  return "ROW";
}
