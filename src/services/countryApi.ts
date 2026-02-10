import { EUROPE_CODES, type EuropeCode } from '../data/europe'

export type CountryInfo = {
  code: EuropeCode
  name: string
  frenchName?: string
  capital: string
  region?: string
  subregion?: string
  flagUrl?: string
  flagAlt?: string
}

type ApiCountry = {
  cca2: string
  name?: { common?: string }
  translations?: { fra?: { common?: string } }
  capital?: string[]
  region?: string
  subregion?: string
  flags?: { png?: string; svg?: string; alt?: string }
}

const API_URL = 'https://restcountries.com/v3.1/alpha'

export async function fetchEuropeCountries(): Promise<Record<EuropeCode, CountryInfo>> {
  const codes = EUROPE_CODES.join(',')
  const url = `${API_URL}?codes=${codes}&fields=name,translations,capital,cca2,region,subregion,flags`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error('Failed to load country data.')
  }

  const payload = (await response.json()) as ApiCountry[]
  const countryMap = {} as Record<EuropeCode, CountryInfo>

  for (const country of payload) {
    const code = country.cca2?.toUpperCase() as EuropeCode

    if (!code || !EUROPE_CODES.includes(code)) {
      continue
    }

    countryMap[code] = {
      code,
      name: country.name?.common ?? code,
      frenchName: country.translations?.fra?.common,
      capital: country.capital?.[0] ?? 'Unknown',
      region: country.region,
      subregion: country.subregion,
      flagUrl: country.flags?.svg || country.flags?.png,
      flagAlt: country.flags?.alt,
    }
  }

  return countryMap
}
