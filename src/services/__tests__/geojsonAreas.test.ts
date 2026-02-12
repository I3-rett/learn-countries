import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchGeojsonAreas } from '../geojsonAreas'

const baseConfig = {
  url: 'https://example.com/areas.geojson',
  codeKey: 'code',
  nameKey: 'nom',
  cacheKey: 'learn-countries:fr-test-cache',
}

describe('geojsonAreas', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps geojson features to area records', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        features: [
          { properties: { code: '11', nom: 'Ile-de-France' } },
          { properties: { code: '75', nom: 'Paris' } },
        ],
      }),
    })))

    const data = await fetchGeojsonAreas(baseConfig)

    expect(data['11']?.name).toBe('Ile-de-France')
    expect(data['75']?.name).toBe('Paris')
  })

  it('reads from cache when available', async () => {
    localStorage.setItem(
      baseConfig.cacheKey,
      JSON.stringify({
        '11': { code: '11', name: 'Ile-de-France', capital: 'Unknown' },
      })
    )

    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const data = await fetchGeojsonAreas(baseConfig)

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(data['11']?.name).toBe('Ile-de-France')
  })
})
