export const COUNTRIES = [
  { code: "AR", name: "Argentina", currency: "ARS", symbol: "$", cities: ["Buenos Aires","Córdoba","Rosario","Mendoza","Tucumán"] },
  { code: "BO", name: "Bolivia", currency: "BOB", symbol: "Bs", cities: ["La Paz","Santa Cruz","Cochabamba","Sucre"] },
  { code: "BR", name: "Brasil", currency: "BRL", symbol: "R$", cities: ["São Paulo","Rio de Janeiro","Brasília","Salvador","Fortaleza"] },
  { code: "CL", name: "Chile", currency: "CLP", symbol: "$", cities: ["Santiago","Valparaíso","Concepción","Antofagasta"] },
  { code: "CO", name: "Colombia", currency: "COP", symbol: "$", cities: ["Bogotá","Medellín","Cali","Barranquilla","Cartagena"] },
  { code: "CR", name: "Costa Rica", currency: "CRC", symbol: "₡", cities: ["San José","Cartago","Heredia","Alajuela"] },
  { code: "CU", name: "Cuba", currency: "CUP", symbol: "$", cities: ["La Habana","Santiago de Cuba","Camagüey"] },
  { code: "DO", name: "República Dominicana", currency: "DOP", symbol: "RD$", cities: ["Santo Domingo","Santiago","La Romana","San Pedro de Macorís","Punta Cana","Puerto Plata"] },
  { code: "EC", name: "Ecuador", currency: "USD", symbol: "$", cities: ["Quito","Guayaquil","Cuenca","Manta"] },
  { code: "SV", name: "El Salvador", currency: "USD", symbol: "$", cities: ["San Salvador","Santa Ana","San Miguel"] },
  { code: "ES", name: "España", currency: "EUR", symbol: "€", cities: ["Madrid","Barcelona","Valencia","Sevilla","Bilbao","Zaragoza","Málaga"] },
  { code: "GT", name: "Guatemala", currency: "GTQ", symbol: "Q", cities: ["Ciudad de Guatemala","Quetzaltenango","Escuintla"] },
  { code: "HN", name: "Honduras", currency: "HNL", symbol: "L", cities: ["Tegucigalpa","San Pedro Sula","La Ceiba"] },
  { code: "MX", name: "México", currency: "MXN", symbol: "$", cities: ["Ciudad de México","Guadalajara","Monterrey","Puebla","Tijuana","Cancún","León"] },
  { code: "NI", name: "Nicaragua", currency: "NIO", symbol: "C$", cities: ["Managua","León","Masaya","Granada"] },
  { code: "PA", name: "Panamá", currency: "USD", symbol: "$", cities: ["Ciudad de Panamá","Colón","David"] },
  { code: "PY", name: "Paraguay", currency: "PYG", symbol: "₲", cities: ["Asunción","Ciudad del Este","Encarnación"] },
  { code: "PE", name: "Perú", currency: "PEN", symbol: "S/", cities: ["Lima","Arequipa","Trujillo","Cusco","Piura"] },
  { code: "PR", name: "Puerto Rico", currency: "USD", symbol: "$", cities: ["San Juan","Ponce","Bayamón","Carolina"] },
  { code: "UY", name: "Uruguay", currency: "UYU", symbol: "$", cities: ["Montevideo","Salto","Paysandú","Rivera"] },
  { code: "VE", name: "Venezuela", currency: "VES", symbol: "Bs", cities: ["Caracas","Maracaibo","Valencia","Barquisimeto"] },
  { code: "US", name: "Estados Unidos", currency: "USD", symbol: "$", cities: ["New York","Los Angeles","Miami","Chicago","Houston","Phoenix","Dallas"] },
  { code: "CA", name: "Canadá", currency: "CAD", symbol: "$", cities: ["Toronto","Montreal","Vancouver","Calgary","Ottawa"] },
  { code: "GB", name: "Reino Unido", currency: "GBP", symbol: "£", cities: ["Londres","Manchester","Birmingham","Glasgow","Leeds"] },
  { code: "IT", name: "Italia", currency: "EUR", symbol: "€", cities: ["Roma","Milán","Nápoles","Turín","Palermo"] },
  { code: "FR", name: "Francia", currency: "EUR", symbol: "€", cities: ["París","Marsella","Lyon","Toulouse","Niza"] },
  { code: "DE", name: "Alemania", currency: "EUR", symbol: "€", cities: ["Berlín","Múnich","Hamburgo","Colonia","Frankfurt"] },
  { code: "PT", name: "Portugal", currency: "EUR", symbol: "€", cities: ["Lisboa","Oporto","Braga","Coimbra","Faro"] },
];

export type Country = typeof COUNTRIES[number];

export function getCountryByCode(code: string): Country | undefined {
  return COUNTRIES.find(c => c.code === code);
}

export function getCurrencyForCountry(code: string): { currency: string; symbol: string } {
  const country = getCountryByCode(code);
  return { currency: country?.currency ?? "USD", symbol: country?.symbol ?? "$" };
}

export function getCitiesForCountry(code: string): string[] {
  return getCountryByCode(code)?.cities ?? [];
}
