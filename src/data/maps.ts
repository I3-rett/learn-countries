export type MapId = string
export type MapKind = 'countries' | 'geojson'

export type QuickSelectCountry = {
  code: string
  name: string
}

export type MapConfig = {
  id: MapId
  label: string
  kind: MapKind
  codes?: readonly string[]
  geojsonUrl?: string
  geojsonCodeKey?: string
  geojsonNameKey?: string
  cacheKey: string
  quickSelect: readonly QuickSelectCountry[]
  mapView: {
    center: [number, number]
    zoom: number
    minZoom: number
    maxZoom: number
  }
  supportsFlags: boolean
  supportsCapitals: boolean
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

const FRANCE_REGIONS_GEOJSON =
  'https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/regions-version-simplifiee.geojson'
const FRANCE_DEPARTMENTS_GEOJSON =
  'https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements-version-simplifiee.geojson'

export const EUROPE_MAP: MapConfig = {
  id: 'europe',
  label: 'Europe',
  kind: 'countries',
  codes: EUROPE_CODES,
  cacheKey: 'learn-countries:europe-cache-v2',
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
  supportsFlags: true,
  supportsCapitals: true,
  plonkitOverrides: {
    BA: 'bosnia-and-herzegovina',
    CZ: 'czechia',
    GB: 'united-kingdom',
    MK: 'north-macedonia',
    VA: 'vatican-city',
    XK: 'kosovo',
  },
}

export const FRANCE_REGIONS_MAP: MapConfig = {
  id: 'fr-regions',
  label: 'France Regions',
  kind: 'geojson',
  geojsonUrl: FRANCE_REGIONS_GEOJSON,
  geojsonCodeKey: 'code',
  geojsonNameKey: 'nom',
  cacheKey: 'learn-countries:fr-regions-v1',
  quickSelect: [],
  mapView: {
    center: [46.6, 2.4],
    zoom: 5.4,
    minZoom: 5,
    maxZoom: 8,
  },
  supportsFlags: false,
  supportsCapitals: false,
}

export const FRANCE_DEPARTMENTS_MAP: MapConfig = {
  id: 'fr-departments',
  label: 'France Departments',
  kind: 'geojson',
  geojsonUrl: FRANCE_DEPARTMENTS_GEOJSON,
  geojsonCodeKey: 'code',
  geojsonNameKey: 'nom',
  cacheKey: 'learn-countries:fr-departments-v1',
  quickSelect: [],
  mapView: {
    center: [46.6, 2.4],
    zoom: 6.1,
    minZoom: 5,
    maxZoom: 9,
  },
  supportsFlags: false,
  supportsCapitals: false,
}

export const MAPS: readonly MapConfig[] = [
  EUROPE_MAP,
  FRANCE_REGIONS_MAP,
  FRANCE_DEPARTMENTS_MAP,
]
