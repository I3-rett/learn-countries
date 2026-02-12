import { describe, expect, it, vi } from 'vitest'
import { createCapitalLayer } from '../capitalMarkers'

const createdMarkers: Array<{ handlers: Record<string, () => void>; setStyle: ReturnType<typeof vi.fn> }> = []

vi.mock('leaflet', () => {
  const layerGroup = () => {
    const layer: { addTo?: (map: any) => any } = {}
    layer.addTo = (map: any) => {
      map.addLayer(layer)
      return layer
    }
    return layer
  }

  const circleMarker = () => {
    const handlers: Record<string, () => void> = {}
    const marker = {
      handlers,
      on: (event: string, cb: () => void) => {
        handlers[event] = cb
      },
      setStyle: vi.fn(),
      addTo: (layer: any) => layer,
    }
    createdMarkers.push(marker)
    return marker
  }

  return {
    default: {
      layerGroup,
      circleMarker,
    },
  }
})

describe('createCapitalLayer', () => {
  it('toggles layer visibility and handles selection', () => {
    const map = {
      layers: new Set<unknown>(),
      hasLayer(layer: unknown) {
        return this.layers.has(layer)
      },
      addLayer(layer: unknown) {
        this.layers.add(layer)
      },
      removeLayer(layer: unknown) {
        this.layers.delete(layer)
      },
    }

    const onSelect = vi.fn()
    const layer = createCapitalLayer({
      map: map as any,
      getMarkerStyle: () => ({ radius: 5 }),
      canSelect: () => true,
      isInteractive: () => true,
      onSelect,
    })

    layer.rebuild([{ code: 'FR', name: 'Paris', lat: 1, lng: 2 }])
    layer.setVisible(true)

    expect(map.layers.size).toBe(1)

    createdMarkers[0].handlers.click()
    expect(onSelect).toHaveBeenCalledWith('FR')

    layer.setVisible(false)
    expect(map.layers.size).toBe(0)
  })
})
