import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '../../tests/msw/server'
import { fetchEuropeCountries } from '../countryApi'

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
    expect(data.FR.name).toBe('France')
    expect(data.FR.capital).toBe('Paris')
    expect(data.FR.capitalLatLng?.lat).toBe(48.8566)
  })

  it('falls back to v2 API when v3 fails', async () => {
    server.use(
      http.get(API_URL, () => new HttpResponse(null, { status: 500 })),
      http.get(SECONDARY_API_URL, () => HttpResponse.json(v2Payload))
    )

    const data = await fetchEuropeCountries()
    expect(data.FR.flagUrl).toContain('fr.png')
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
    expect(data.FR.name).toBe('France')
  })
})
