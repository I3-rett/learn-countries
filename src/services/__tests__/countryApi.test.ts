import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '../../tests/msw/server'
import { fetchCountries, fetchEuropeCountries } from '../countryApi'

const API_URL = 'https://restcountries.com/v3.1/alpha'
const SECONDARY_API_URL = 'https://restcountries.com/v2/alpha'

const v3Payload = [
  {
    cca2: 'FR',
    name: { common: 'France' },
    translations: { fra: { common: 'France' } },
    capital: ['Paris'],
    capitalInfo: { latlng: [48.8566, 2.3522] },
    region: 'Europe',
    subregion: 'Western Europe',
    flags: { svg: 'https://example.com/fr.svg', alt: 'Flag of France' },
  },
]

const v2Payload = [
  {
    alpha2Code: 'FR',
    name: 'France',
    translations: { fr: 'France' },
    capital: 'Paris',
    latlng: [48.8566, 2.3522],
    region: 'Europe',
    subregion: 'Western Europe',
    flag: 'https://example.com/fr.png',
  },
]

describe('countryApi', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('maps v3 API data', async () => {
    server.use(
      http.get(API_URL, () => HttpResponse.json(v3Payload))
    )

    const data = await fetchEuropeCountries()
    expect(data.FR).toBeTruthy()
    const france = data.FR!
    expect(france.name).toBe('France')
    expect(france.capital).toBe('Paris')
    expect(france.capitalLatLng?.lat).toBe(48.8566)
  })

  it('falls back to v2 API when v3 fails', async () => {
    server.use(
      http.get(API_URL, () => new HttpResponse(null, { status: 500 })),
      http.get(SECONDARY_API_URL, () => HttpResponse.json(v2Payload))
    )

    const data = await fetchEuropeCountries()
    expect(data.FR).toBeTruthy()
    expect(data.FR!.flagUrl).toContain('fr.png')
  })

  it('uses cached data when all requests fail', async () => {
    localStorage.setItem(
      'learn-countries:europe-cache-v2',
      JSON.stringify({
        FR: {
          code: 'FR',
          name: 'France',
          capital: 'Paris',
        },
      })
    )

    server.use(
      http.get(API_URL, () => new HttpResponse(null, { status: 500 })),
      http.get(SECONDARY_API_URL, () => new HttpResponse(null, { status: 500 }))
    )

    const data = await fetchEuropeCountries()
    expect(data.FR).toBeTruthy()
    expect(data.FR!.name).toBe('France')
  })

  it('filters non-european codes and tolerates missing capital data', async () => {
    server.use(
      http.get(API_URL, () => HttpResponse.json([
        {
          cca2: 'FR',
          name: { common: 'France' },
          capital: ['Paris'],
        },
        {
          cca2: 'US',
          name: { common: 'United States' },
        },
      ]))
    )

    const data = await fetchEuropeCountries()
    expect('US' in data).toBe(false)
    expect(data.FR).toBeTruthy()
    expect(data.FR!.capitalLatLng).toBeUndefined()
  })

  it('writes mapped data to the cache on success', async () => {
    server.use(
      http.get(API_URL, () => HttpResponse.json(v3Payload))
    )

    await fetchEuropeCountries()

    const cached = localStorage.getItem('learn-countries:europe-cache-v2')
    expect(cached).toBeTruthy()
    expect(cached).toContain('France')
  })

  it('supports custom code lists and cache keys', async () => {
    const customCacheKey = 'learn-countries:custom-cache'

    server.use(
      http.get(API_URL, () => HttpResponse.json([
        {
          cca2: 'US',
          name: { common: 'United States' },
          capital: ['Washington, D.C.'],
        },
      ]))
    )

    const data = await fetchCountries(['US'], customCacheKey)
    expect(data.US).toBeTruthy()
    expect(data.US!.name).toBe('United States')
    expect(localStorage.getItem(customCacheKey)).toContain('United States')
  })
})
