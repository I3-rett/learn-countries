export type ContinentId = string

export type QuickSelectCountry = {
  code: string
  name: string
}

export type ContinentConfig = {
  id: ContinentId
  label: string
  editionLabel: string
  codes: readonly string[]
  quickSelect: readonly QuickSelectCountry[]
  mapView: {
    center: [number, number]
    zoom: number
    minZoom: number
    maxZoom: number
  }
  cacheKey: string
  plonkitOverrides?: Record<string, string>
}

export const EUROPE_CODES = [
  'AL',
  'AD',
  'AT',
  'BY',
  'BE',
  'BA',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IS',
  'IE',
  'IT',
  'XK',
  'LV',
  'LI',
  'LT',
  'LU',
  'MT',
  'MD',
  'MC',
  'ME',
  'NL',
  'MK',
  'NO',
  'PL',
  'PT',
  'RO',
  'SM',
  'RS',
  'SK',
  'SI',
  'ES',
  'SE',
  'CH',
  'TR',
  'UA',
  'GB',
  'VA',
] as const

export const EUROPE_CONTINENT: ContinentConfig = {
  id: 'europe',
  label: 'Europe',
  editionLabel: 'Europe Edition',
  codes: EUROPE_CODES,
  quickSelect: [
    { code: 'VA', name: 'Vatican City' },
    { code: 'MC', name: 'Monaco' },
    { code: 'SM', name: 'San Marino' },
    { code: 'LI', name: 'Liechtenstein' },
    { code: 'AD', name: 'Andorra' },
    { code: 'MT', name: 'Malta' },
  ],
  mapView: {
    center: [49.5822, 2.714],
    zoom: 4.5,
    minZoom: 4,
    maxZoom: 10,
  },
  cacheKey: 'learn-countries:europe-cache-v2',
  plonkitOverrides: {
    BA: 'bosnia-and-herzegovina',
    CZ: 'czechia',
    GB: 'united-kingdom',
    MK: 'north-macedonia',
    VA: 'vatican-city',
    XK: 'kosovo',
  },
}

export const CONTINENTS: readonly ContinentConfig[] = [EUROPE_CONTINENT]
