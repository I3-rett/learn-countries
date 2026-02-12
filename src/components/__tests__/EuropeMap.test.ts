import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EuropeMap from '../EuropeMap.vue'
import { createCapitalLayer } from '../../services/capitalMarkers'

const createdLayers: Array<{
  feature: GeoJSON.Feature
  handlers: Record<string, () => void>
}> = []

vi.mock('leaflet', () => {
  const map = () => ({
    createPane: () => ({ style: {} }),
    setView: vi.fn(),
    invalidateSize: vi.fn(),
    fitBounds: vi.fn(),
    remove: vi.fn(),
  })

  const geoJSON = (
    input: GeoJSON.FeatureCollection | GeoJSON.Feature[],
    options: any
  ) => {
    const features = Array.isArray(input) ? input : input.features
    const layers: any[] = []

    features.forEach((feature) => {
      const handlers: Record<string, () => void> = {}
      let tooltip: unknown = null
      const layer = {
        feature,
        options: {},
        on: (event: string, handler: () => void) => {
          handlers[event] = handler
        },
        setStyle: vi.fn(),
        bindTooltip: vi.fn((text: string) => {
          tooltip = { text }
        }),
        unbindTooltip: vi.fn(() => {
          tooltip = null
        }),
        getTooltip: () => tooltip,
      }

      createdLayers.push({ feature, handlers })

      if (options?.onEachFeature) {
        options.onEachFeature(feature, layer)
      }

      layers.push(layer)
    })

    return {
      addTo: vi.fn(),
      eachLayer: (cb: (layer: any) => void) => layers.forEach(cb),
      getBounds: vi.fn(() => ({})),
    }
  }

  const tileLayer = () => ({ addTo: vi.fn() })

  return {
    default: {
      map,
      geoJSON,
      tileLayer,
    },
  }
})

vi.mock('../../services/capitalMarkers', () => ({
  createCapitalLayer: vi.fn(),
}))

const geojsonPayload: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        ISO_A2: 'FR',
        NAME: 'France',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [],
      },
    },
  ],
}

const baseProps = {
  targetCode: 'FR',
  selectedCode: null,
  reveal: false,
  foundCodes: [],
  partialCodes: [],
  failedCodes: [],
  capitalPoints: [],
  stage: 'name' as const,
  uiState: {
    actionLabel: 'Confirm',
    actionDisabled: false,
    actionHighlight: false,
    statusLabel: 'Make your pick',
    flagsEnabled: false,
    capitalsEnabled: false,
    score: {
      nameScore: 0,
      nameTotal: 1,
      flagScore: 0,
      flagTotal: 0,
      capitalScore: 0,
      capitalTotal: 0,
      flagsEnabled: false,
      capitalsEnabled: false,
    },
  },
}

const makeFetchResponse = (payload: GeoJSON.FeatureCollection) =>
  Promise.resolve({
    ok: true,
    json: async () => payload,
  }) as Promise<Response>

describe('EuropeMap', () => {
  beforeEach(() => {
    createdLayers.length = 0

    vi.mocked(createCapitalLayer).mockReturnValue({
      rebuild: vi.fn(),
      applyStyles: vi.fn(),
      setVisible: vi.fn(),
      dispose: vi.fn(),
    })

    vi.stubGlobal('fetch', vi.fn(() => makeFetchResponse(geojsonPayload)))
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('emits country-selected when a map feature is clicked', async () => {
    const wrapper = mount(EuropeMap, {
      props: baseProps,
      global: { stubs: { MapOverlay: true } },
    })

    await flushPromises()

    const layerEntry = createdLayers.find((entry) =>
      (entry.feature.properties as { ISO_A2?: string }).ISO_A2 === 'FR'
    )

    expect(layerEntry).toBeTruthy()
    layerEntry?.handlers.click?.()

    expect(wrapper.emitted('country-selected')).toBeTruthy()
    expect(wrapper.emitted('country-selected')?.[0]).toEqual(['FR'])
  })

  it('ignores country clicks during the capital stage', async () => {
    const wrapper = mount(EuropeMap, {
      props: { ...baseProps, stage: 'capital' as const },
      global: { stubs: { MapOverlay: true } },
    })

    await flushPromises()

    const layerEntry = createdLayers.find((entry) =>
      (entry.feature.properties as { ISO_A2?: string }).ISO_A2 === 'FR'
    )

    layerEntry?.handlers.click?.()

    expect(wrapper.emitted('country-selected')).toBeFalsy()
  })

  it('toggles capital marker visibility with the difficulty setting', async () => {
    const setVisible = vi.fn()
    vi.mocked(createCapitalLayer).mockReturnValue({
      rebuild: vi.fn(),
      applyStyles: vi.fn(),
      setVisible,
      dispose: vi.fn(),
    })

    const wrapper = mount(EuropeMap, {
      props: baseProps,
      global: { stubs: { MapOverlay: true } },
    })

    await flushPromises()

    expect(setVisible).toHaveBeenCalledWith(false)

    await wrapper.setProps({
      uiState: {
        ...baseProps.uiState,
        capitalsEnabled: true,
      },
    })

    expect(setVisible).toHaveBeenCalledWith(true)
  })
})
