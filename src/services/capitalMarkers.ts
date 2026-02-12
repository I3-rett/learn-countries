import L from 'leaflet'

export type CapitalPoint = { code: string; name: string; lat: number; lng: number }

type Options = {
  map: L.Map
  getMarkerStyle: (code: string) => L.CircleMarkerOptions
  canSelect: (code: string) => boolean
  isInteractive: () => boolean
  onSelect: (code: string) => void
}

type CapitalLayer = {
  rebuild: (points: CapitalPoint[]) => void
  applyStyles: () => void
  setVisible: (show: boolean) => void
  dispose: () => void
}

export const createCapitalLayer = (options: Options): CapitalLayer => {
  let layer: L.LayerGroup | null = null
  let visible = true
  const markers = new Map<string, L.CircleMarker>()

  const setVisible = (show: boolean) => {
    visible = show
    if (!layer) {
      return
    }

    if (show) {
      if (!options.map.hasLayer(layer)) {
        layer.addTo(options.map)
      }
    } else if (options.map.hasLayer(layer)) {
      options.map.removeLayer(layer)
    }
  }

  const rebuild = (points: CapitalPoint[]) => {
    if (layer) {
      options.map.removeLayer(layer)
    }

    layer = L.layerGroup()
    markers.clear()

    points.forEach((point) => {
      const marker = L.circleMarker([point.lat, point.lng], options.getMarkerStyle(point.code))

      marker.on('click', () => {
        if (!options.isInteractive()) {
          return
        }

        if (!options.canSelect(point.code)) {
          return
        }

        options.onSelect(point.code)
      })

      marker.on('mouseover', () => {
        if (!options.isInteractive()) {
          return
        }

        marker.setStyle({ ...options.getMarkerStyle(point.code), radius: 7 })
      })

      marker.on('mouseout', () => {
        marker.setStyle(options.getMarkerStyle(point.code))
      })

      marker.addTo(layer as L.LayerGroup)
      markers.set(point.code, marker)
    })

    setVisible(visible)
  }

  const applyStyles = () => {
    markers.forEach((marker, code) => {
      marker.setStyle(options.getMarkerStyle(code))
    })
  }

  const dispose = () => {
    if (layer && options.map.hasLayer(layer)) {
      options.map.removeLayer(layer)
    }
    markers.clear()
    layer = null
  }

  return {
    rebuild,
    applyStyles,
    setVisible,
    dispose,
  }
}
