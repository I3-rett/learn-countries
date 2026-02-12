import { EUROPE_MAP } from '../data/maps'

export type CountryCode = string

export type CountryInfo = {
  code: CountryCode
  name: string
  frenchName?: string
  capital: string
  capitalLatLng?: { lat: number; lng: number }
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
  capitalInfo?: { latlng?: [number, number] }
  region?: string
  subregion?: string
  flags?: { png?: string; svg?: string; alt?: string }
}

const API_URL = 'https://restcountries.com/v3.1/alpha'
const SECONDARY_API_URL = 'https://restcountries.com/v2/alpha'
const REQUEST_TIMEOUT_MS = 12000

type ApiCountryV2 = {
  alpha2Code: string
  name?: string
  translations?: { fr?: string }
  capital?: string
  latlng?: number[]
  region?: string
  subregion?: string
  flag?: string
}

const readCache = (cacheKey: string) => {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(cacheKey)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as Record<CountryCode, CountryInfo>
  } catch {
    return null
  }
}

const writeCache = (cacheKey: string, data: Record<CountryCode, CountryInfo>) => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(cacheKey, JSON.stringify(data))
}

const mapV3Countries = (payload: ApiCountry[], allowedCodes: Set<string>) => {
  const countryMap = {} as Record<CountryCode, CountryInfo>

  for (const country of payload) {
    const code = country.cca2?.toUpperCase()

    if (!code || !allowedCodes.has(code)) {
      continue
    }

    const capitalCoords = country.capitalInfo?.latlng
    const [capitalLat, capitalLng] = capitalCoords ?? []
    countryMap[code] = {
      code,
      name: country.name?.common ?? code,
      frenchName: country.translations?.fra?.common,
      capital: country.capital?.[0] ?? 'Unknown',
      capitalLatLng:
        typeof capitalLat === 'number' && typeof capitalLng === 'number'
          ? { lat: capitalLat, lng: capitalLng }
          : undefined,
      region: country.region,
      subregion: country.subregion,
      flagUrl: country.flags?.svg || country.flags?.png,
      flagAlt: country.flags?.alt,
    }
  }

  return countryMap
}

const mapV2Countries = (payload: ApiCountryV2[], allowedCodes: Set<string>) => {
  const countryMap = {} as Record<CountryCode, CountryInfo>

  for (const country of payload) {
    const code = country.alpha2Code?.toUpperCase()

    if (!code || !allowedCodes.has(code)) {
      continue
    }

    const capitalCoords = country.latlng
    const [capitalLat, capitalLng] = capitalCoords ?? []
    countryMap[code] = {
      code,
      name: country.name ?? code,
      frenchName: country.translations?.fr,
      capital: country.capital ?? 'Unknown',
      capitalLatLng:
        typeof capitalLat === 'number' && typeof capitalLng === 'number'
          ? { lat: capitalLat, lng: capitalLng }
          : undefined,
      region: country.region,
      subregion: country.subregion,
      flagUrl: country.flag,
      flagAlt: country.name ? `Flag of ${country.name}` : undefined,
    }
  }

  return countryMap
}

const fetchWithTimeout = async (url: string) => {
  const isTestEnv = typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test'
  const controller = isTestEnv ? null : new AbortController()
  const timeoutId = window.setTimeout(() => controller?.abort(), REQUEST_TIMEOUT_MS)
  const signal = controller?.signal

  try {
    return await fetch(url, signal ? { signal } : undefined)
  } finally {
    window.clearTimeout(timeoutId)
  }
}

export async function fetchCountries(
  codes: readonly string[],
  cacheKey: string
): Promise<Record<CountryCode, CountryInfo>> {
  const codesValue = codes.join(',')
  const allowedCodes = new Set(codes)
  const url =
    `${API_URL}?codes=${codesValue}&fields=name,translations,capital,capitalInfo,cca2,region,subregion,flags`
  const secondaryUrl =
    `${SECONDARY_API_URL}?codes=${codesValue}&fields=name;translations;capital;latlng;alpha2Code;region;subregion;flag`

  try {
    const response = await fetchWithTimeout(url)

    if (!response.ok) {
      throw new Error('Failed to load country data.')
    }

    const payload = (await response.json()) as ApiCountry[]
    const mapped = mapV3Countries(payload, allowedCodes)
    writeCache(cacheKey, mapped)
    return mapped
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.warn('Primary country data request timed out.')
    } else {
      console.warn('Primary country data request failed.', error)
    }
  }

  try {
    const response = await fetchWithTimeout(secondaryUrl)

    if (!response.ok) {
      throw new Error('Failed to load country data.')
    }

    const payload = (await response.json()) as ApiCountryV2[]
    const mapped = mapV2Countries(payload, allowedCodes)
    writeCache(cacheKey, mapped)
    return mapped
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.warn('Secondary country data request timed out.')
    } else {
      console.warn('Secondary country data request failed.', error)
    }
  }

  const cached = readCache(cacheKey)
  if (cached) {
    return cached
  }

  throw new Error('Failed to load country data.')
}

export async function fetchEuropeCountries(): Promise<Record<CountryCode, CountryInfo>> {
  return fetchCountries(EUROPE_MAP.codes ?? [], EUROPE_MAP.cacheKey)
}
