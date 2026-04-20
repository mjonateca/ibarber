export const COUNTRIES = [
  {
    code: "DO",
    name: "República Dominicana",
    cities: [
      "Santo Domingo",
      "Santiago",
      "La Romana",
      "San Pedro de Macorís",
      "Punta Cana",
      "Puerto Plata",
      "San Francisco de Macorís",
      "La Vega",
      "Higüey",
      "Baní",
    ],
  },
  {
    code: "US",
    name: "Estados Unidos",
    cities: ["New York", "Miami", "Orlando", "Boston", "Providence"],
  },
  {
    code: "PR",
    name: "Puerto Rico",
    cities: ["San Juan", "Bayamón", "Carolina", "Ponce", "Mayagüez"],
  },
] as const;

export type CountryCode = (typeof COUNTRIES)[number]["code"];

export function getCountryName(code: string) {
  return COUNTRIES.find((country) => country.code === code)?.name || code;
}

export function getCitiesForCountry(code: string) {
  return COUNTRIES.find((country) => country.code === code)?.cities || [];
}
