import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCapitalLayer } from '../capitalMarkers'

const createdMarkers: Array<{
  handlers: Record<string, () => void>
  setStyle: ReturnType<typeof vi.fn>
}> = []

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
  beforeEach(() => {
    createdMarkers.length = 0
  })

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

    const marker = createdMarkers[0]
    expect(marker).toBeTruthy()
    marker?.handlers.click?.()
    expect(onSelect).toHaveBeenCalledWith('FR')

    layer.setVisible(false)
    expect(map.layers.size).toBe(0)
  })

  it('respects interactivity and hover styling', () => {
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
      getMarkerStyle: () => ({ radius: 5, color: '#000' }),
      canSelect: () => false,
      isInteractive: () => true,
      onSelect,
    })

    layer.rebuild([{ code: 'FR', name: 'Paris', lat: 1, lng: 2 }])

    const marker = createdMarkers[0]
    expect(marker).toBeTruthy()

    marker?.handlers.click?.()
    expect(onSelect).not.toHaveBeenCalled()

    marker?.handlers.mouseover?.()
    expect(marker?.setStyle).toHaveBeenCalledWith({ radius: 7, color: '#000' })

    marker?.handlers.mouseout?.()
    expect(marker?.setStyle).toHaveBeenCalledWith({ radius: 5, color: '#000' })
  })

  it('applyStyles updates marker styles', () => {
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

    const layer = createCapitalLayer({
      map: map as any,
      getMarkerStyle: (code: string) => ({ radius: code === 'FR' ? 6 : 4 }),
      canSelect: () => true,
      isInteractive: () => true,
      onSelect: vi.fn(),
    })

    layer.rebuild([
      { code: 'FR', name: 'Paris', lat: 1, lng: 2 },
      { code: 'DE', name: 'Berlin', lat: 3, lng: 4 },
    ])

    layer.applyStyles()

    expect(createdMarkers[0]?.setStyle).toHaveBeenCalledWith({ radius: 6 })
    expect(createdMarkers[1]?.setStyle).toHaveBeenCalledWith({ radius: 4 })
  })
})
