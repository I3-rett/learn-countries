import type { CountryInfo } from './countryApi'

export type GeojsonAreaConfig = {
  url: string
  codeKey: string
  nameKey: string
  cacheKey: string
}

type GeojsonFeature = {
  properties?: Record<string, unknown>
}

type GeojsonPayload = {
  features?: GeojsonFeature[]
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
    return JSON.parse(raw) as Record<string, CountryInfo>
  } catch {
    return null
  }
}

const writeCache = (cacheKey: string, data: Record<string, CountryInfo>) => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(cacheKey, JSON.stringify(data))
}

export async function fetchGeojsonAreas(
  config: GeojsonAreaConfig
): Promise<Record<string, CountryInfo>> {
  const cached = readCache(config.cacheKey)
  if (cached) {
    return cached
  }

  const response = await fetch(config.url)
  if (!response.ok) {
    throw new Error('Failed to load area data.')
  }

  const payload = (await response.json()) as GeojsonPayload
  const countryMap: Record<string, CountryInfo> = {}

  const features = payload.features ?? []
  features.forEach((feature) => {
    const props = feature.properties
    if (!props) {
      return
    }

    const codeValue = props[config.codeKey]
    const nameValue = props[config.nameKey]

    if ((typeof codeValue !== 'string' && typeof codeValue !== 'number') || typeof nameValue !== 'string') {
      return
    }

    const code = String(codeValue).trim()
    const name = nameValue.trim()

    if (!code || !name) {
      return
    }

    countryMap[code] = {
      code,
      name,
      capital: 'Unknown',
    }
  })

  writeCache(config.cacheKey, countryMap)
  return countryMap
}
