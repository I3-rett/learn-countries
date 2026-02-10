<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import { EUROPE_CODES } from '../data/europe'

type Props = {
  targetCode: string | null
  selectedCode: string | null
  reveal: boolean
  foundCodes: string[]
}

const props = defineProps<Props>()
const emit = defineEmits<{ (event: 'country-selected', code: string): void }>()

const mapEl = ref<HTMLDivElement | null>(null)

let map: L.Map | null = null
let geoLayer: L.GeoJSON | null = null

const GEOJSON_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson'

const baseStyle: L.PathOptions = {
  color: '#1a1f2b',
  weight: 1,
  fillColor: '#f5efe6',
  fillOpacity: 0.85,
}

const mutedStyle: L.PathOptions = {
  color: '#1a1f2b',
  weight: 0.6,
  fillColor: '#f5efe6',
  fillOpacity: 0.2,
}

const correctStyle: L.PathOptions = {
  color: '#0d0f14',
  weight: 1.6,
  fillColor: '#2bb673',
  fillOpacity: 0.9,
}

const foundStyle: L.PathOptions = {
  color: '#0d0f14',
  weight: 1.2,
  fillColor: '#2bb673',
  fillOpacity: 0.35,
}

const wrongStyle: L.PathOptions = {
  color: '#0d0f14',
  weight: 1.6,
  fillColor: '#ff5c3c',
  fillOpacity: 0.9,
}

const selectedStyle: L.PathOptions = {
  color: '#0d0f14',
  weight: 2,
  fillColor: '#ffb48a',
  fillOpacity: 0.9,
}

const hoverStyle: L.PathOptions = {
  weight: 2,
  fillOpacity: 0.95,
}

const aliasMap: Record<string, string> = {
  UK: 'GB',
  EL: 'GR',
  FX: 'FR',
}

const europeSet = new Set(EUROPE_CODES)
const isEuropeCode = (code: string) => europeSet.has(code as (typeof EUROPE_CODES)[number])

const normalizeCode = (value: string) => {
  const upperCode = value.toUpperCase()
  return aliasMap[upperCode] ?? upperCode
}

const pickCodeFromProperties = (properties: Record<string, unknown> | undefined) => {
  if (!properties) {
    return ''
  }

  for (const value of Object.values(properties)) {
    if (typeof value !== 'string') {
      continue
    }

    const trimmed = value.trim()

    if (trimmed.length !== 2) {
      continue
    }

    const normalized = normalizeCode(trimmed)

    if (isEuropeCode(normalized)) {
      return normalized
    }
  }

  return ''
}

const getFeatureCode = (feature: GeoJSON.Feature | undefined) => {
  if (!feature) {
    return ''
  }

  const properties = feature.properties as
    | {
        iso_a2?: string
        ISO_A2?: string
        ISO_A2_EH?: string
        ISO2?: string
        iso2?: string
        ADM0_A3?: string
        SOV_A3?: string
      }
    | undefined

  const rawCode =
    properties?.ISO_A2 ||
    properties?.ISO_A2_EH ||
    properties?.iso_a2 ||
    properties?.ISO2 ||
    properties?.iso2 ||
    (feature.id as string | undefined)

  if (rawCode && rawCode !== '-99') {
    return normalizeCode(rawCode)
  }

  const adm0 = properties?.ADM0_A3 || properties?.SOV_A3

  if (adm0 === 'XKX') {
    return 'XK'
  }

  return pickCodeFromProperties(properties as Record<string, unknown> | undefined)
}

const getStyleForCode = (code: string) => {
  if (code && !isEuropeCode(code)) {
    return mutedStyle
  }

  if (props.foundCodes.includes(code)) {
    return foundStyle
  }

  if (props.reveal && props.targetCode && code === props.targetCode) {
    return correctStyle
  }

  if (props.reveal && props.selectedCode && code === props.selectedCode) {
    return wrongStyle
  }

  if (!props.reveal && props.selectedCode && code === props.selectedCode) {
    return selectedStyle
  }

  return baseStyle
}

const applyLayerStyles = () => {
  if (!geoLayer) {
    return
  }

  geoLayer.eachLayer((layer) => {
    const featureLayer = layer as L.Path & { feature?: GeoJSON.Feature }
    const code = getFeatureCode(featureLayer.feature)
    featureLayer.setStyle(getStyleForCode(code))
  })
}

const buildLayer = (geojson: GeoJSON.FeatureCollection) => {
  const europeFeatures = geojson.features.filter((feature) => {
    const code = getFeatureCode(feature)
    return EUROPE_CODES.includes(code as (typeof EUROPE_CODES)[number])
  })

  const allowAnyClick = !europeFeatures.length
  const featuresToShow = europeFeatures.length ? europeFeatures : geojson.features

  console.info('Map feature stats', {
    total: geojson.features.length,
    europe: europeFeatures.length,
  })

  geoLayer = L.geoJSON(featuresToShow, {
    style: (feature) => getStyleForCode(getFeatureCode(feature as GeoJSON.Feature)),
    onEachFeature: (feature, layer) => {
      const code = getFeatureCode(feature)

      if (!code || (!allowAnyClick && !isEuropeCode(code))) {
        return
      }

      if (props.foundCodes.includes(code)) {
        return
      }

      const pathLayer = layer as L.Path

      pathLayer.on('mouseover', () => {
        pathLayer.setStyle({ ...getStyleForCode(code), ...hoverStyle })
      })

      pathLayer.on('mouseout', () => {
        pathLayer.setStyle(getStyleForCode(code))
      })

      pathLayer.on('click', () => {
        if (!props.reveal) {
          emit('country-selected', code)
        }
      })

      pathLayer.setStyle({ ...pathLayer.options, className: 'leaflet-clickable-countries' })
    },
  })

  geoLayer.addTo(map as L.Map)

  if (europeFeatures.length) {
    map?.fitBounds(geoLayer.getBounds(), { padding: [24, 24] })
  }
}

onMounted(async () => {
  if (!mapEl.value) {
    return
  }

  map = L.map(mapEl.value, {
    zoomControl: false,
    minZoom: 4,
    maxZoom: 10,
    scrollWheelZoom: true,
  })

  map.setView([54.0, 12.0], 4.5)

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 10,
  }).addTo(map)

  L.control.zoom({ position: 'bottomright' }).addTo(map)

  requestAnimationFrame(() => {
    map?.invalidateSize()
  })

  try {
    const response = await fetch(GEOJSON_URL)

    if (!response.ok) {
      throw new Error('Failed to load map data.')
    }

    const geojson = (await response.json()) as GeoJSON.FeatureCollection
    buildLayer(geojson)
  } catch (error) {
    console.error('Map data error:', error)
  }
})

onBeforeUnmount(() => {
  map?.remove()
  map = null
  geoLayer = null
})

watch(
  () => [props.reveal, props.selectedCode, props.targetCode, props.foundCodes],
  () => {
    applyLayerStyles()
  }
)
</script>

<template>
  <div class="relative h-[62vh] min-h-[420px] w-full overflow-hidden rounded-3xl border border-ink/10">
    <div ref="mapEl" class="h-full w-full"></div>
    <div
      class="pointer-events-none absolute left-6 top-6 rounded-full bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-ink"
    >
      Europe Focus
    </div>
  </div>
</template>
