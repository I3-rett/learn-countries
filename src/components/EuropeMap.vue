<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import { EUROPE_CODES } from '../data/europe'

type Stage = 'name' | 'flag' | 'capital'

type Props = {
  targetCode: string | null
  selectedCode: string | null
  reveal: boolean
  foundCodes: string[]
  partialCodes: string[]
  failedCodes: string[]
  capitalPoints: Array<{ code: string; name: string; lat: number; lng: number }>
  showCapitals: boolean
  stage: Stage
  actionLabel: string
  actionDisabled: boolean
  statusLabel: string
  statusTone: string
  hintLabel: string
  flagsEnabled: boolean
  capitalsEnabled: boolean
  nameScore: number
  nameTotal: number
  flagScore: number
  flagTotal: number
  capitalScore: number
  capitalTotal: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (event: 'country-selected', code: string): void
  (event: 'confirm-action'): void
  (event: 'update:flags-enabled', value: boolean): void
  (event: 'update:capitals-enabled', value: boolean): void
}>()

const mapEl = ref<HTMLDivElement | null>(null)
const mapCenter = ref<{ lat: number; lng: number } | null>(null)
const mapZoom = ref<number | null>(null)

let map: L.Map | null = null
let geoLayer: L.GeoJSON | null = null
let capitalLayer: L.LayerGroup | null = null
let capitalMarkers = new Map<string, L.CircleMarker>()

const GEOJSON_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson'

const baseStyle: L.PathOptions = {
  color: '#1a1f2b',
  weight: 1,
  dashArray: '',
  fillColor: '#f5efe6',
  fillOpacity: 0.85,
}

const mutedStyle: L.PathOptions = {
  color: '#1a1f2b',
  weight: 0.6,
  dashArray: '',
  fillColor: '#f5efe6',
  fillOpacity: 0.2,
}

const correctStyle: L.PathOptions = {
  color: '#0d0f14',
  weight: 1.6,
  dashArray: '',
  fillColor: '#2bb673',
  fillOpacity: 0.98,
}

const answerStyle: L.PathOptions = {
  color: '#0d0f14',
  weight: 2.6,
  dashArray: '',
  fillColor: '#d32f2f',
  fillOpacity: 1,
}

const foundStyle: L.PathOptions = {
  color: '#0d0f14',
  weight: 1.2,
  dashArray: '',
  fillColor: '#00d26a',
  fillOpacity: 0.35,
}

const partialStyle: L.PathOptions = {
  color: '#0d0f14',
  weight: 1.2,
  dashArray: '',
  fillColor: '#2bb673',
  fillOpacity: 0.25,
}

const failedStyle: L.PathOptions = {
  color: '#0d0f14',
  weight: 1.2,
  dashArray: '',
  fillColor: '#ff5c3c',
  fillOpacity: 0.5,
}

const selectedStyle: L.PathOptions = {
  color: '#0d0f14',
  weight: 2.4,
  dashArray: '6 4',
  fillColor: '#f5efe6',
  fillOpacity: 0.85,
}

const hoverStyle: L.PathOptions = {
  weight: 2,
  dashArray: '',
}

const capitalBaseStyle: L.CircleMarkerOptions = {
  radius: 5,
  color: '#0d0f14',
  weight: 1.2,
  fillColor: '#ffb08a',
  fillOpacity: 0.85,
  pane: 'capitals',
  className: 'capital-marker',
}

const capitalSelectedStyle: L.CircleMarkerOptions = {
  radius: 7,
  color: '#0d0f14',
  weight: 2,
  fillColor: '#ff8a65',
  fillOpacity: 1,
  pane: 'capitals',
  className: 'capital-marker',
}

const capitalCorrectStyle: L.CircleMarkerOptions = {
  radius: 7,
  color: '#0d0f14',
  weight: 2.4,
  fillColor: '#2bb673',
  fillOpacity: 0.95,
  pane: 'capitals',
  className: 'capital-marker',
}

const capitalAnswerStyle: L.CircleMarkerOptions = {
  radius: 7,
  color: '#0d0f14',
  weight: 2.4,
  fillColor: '#d32f2f',
  fillOpacity: 0.95,
  pane: 'capitals',
  className: 'capital-marker',
}

const capitalFoundStyle: L.CircleMarkerOptions = {
  radius: 5,
  color: '#0d0f14',
  weight: 1.2,
  fillColor: '#2bb673',
  fillOpacity: 0.6,
  pane: 'capitals',
  className: 'capital-marker',
}

const capitalFailedStyle: L.CircleMarkerOptions = {
  radius: 5,
  color: '#0d0f14',
  weight: 1.2,
  fillColor: '#ff5c3c',
  fillOpacity: 0.7,
  pane: 'capitals',
  className: 'capital-marker',
}

const tinyCountryQuickSelect = [
  { code: 'VA', name: 'Vatican City' },
  { code: 'MC', name: 'Monaco' },
  { code: 'SM', name: 'San Marino' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'AD', name: 'Andorra' },
  { code: 'MT', name: 'Malta' },
]

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

const getFeatureName = (feature: GeoJSON.Feature | undefined) => {
  if (!feature?.properties) {
    return ''
  }

  const properties = feature.properties as Record<string, unknown>
  const nameCandidates = [
    properties.NAME,
    properties.NAME_EN,
    properties.NAME_LONG,
    properties.ADMIN,
    properties.name,
  ]

  for (const candidate of nameCandidates) {
    if (typeof candidate === 'string' && candidate.trim().length) {
      return candidate.trim()
    }
  }

  return ''
}

const getStyleForCode = (code: string) => {
  if (code && !isEuropeCode(code)) {
    return mutedStyle
  }

  if (props.foundCodes.includes(code)) {
    return foundStyle
  }

  if (!props.reveal && props.selectedCode && code === props.selectedCode) {
    if (props.partialCodes.includes(code)) {
      return {
        ...selectedStyle,
        fillColor: partialStyle.fillColor,
        fillOpacity: partialStyle.fillOpacity,
      }
    }

    return selectedStyle
  }

  if (props.reveal && props.targetCode && code === props.targetCode) {
    return props.selectedCode === props.targetCode ? correctStyle : answerStyle
  }

  if (props.failedCodes.includes(code)) {
    return failedStyle
  }

  if (props.partialCodes.includes(code)) {
    return partialStyle
  }

  return baseStyle
}

const canQuickSelect = (code: string) => {
  if (props.reveal) {
    return false
  }

  if (props.stage === 'capital') {
    return false
  }

  if (props.foundCodes.includes(code) || props.failedCodes.includes(code)) {
    return false
  }

  return true
}

const handleQuickSelect = (code: string) => {
  if (!canQuickSelect(code)) {
    return
  }

  emit('country-selected', code)
}

const handleConfirmAction = () => {
  if (props.actionDisabled) {
    return
  }

  emit('confirm-action')
}

const actionButtonLabel = computed(() =>
  props.actionDisabled ? props.statusLabel : props.actionLabel
)

const handleFlagsToggle = (event: Event) => {
  const target = event.target as HTMLInputElement | null
  if (!target) {
    return
  }

  emit('update:flags-enabled', target.checked)
}

const handleCapitalsToggle = (event: Event) => {
  const target = event.target as HTMLInputElement | null
  if (!target) {
    return
  }

  emit('update:capitals-enabled', target.checked)
}

const updateMapView = () => {
  if (!map) {
    return
  }

  const center = map.getCenter()
  mapCenter.value = {
    lat: Number(center.lat.toFixed(4)),
    lng: Number(center.lng.toFixed(4)),
  }
  mapZoom.value = Number(map.getZoom().toFixed(2))
}

const applyLayerStyles = () => {
  if (!geoLayer) {
    return
  }

  geoLayer.eachLayer((layer) => {
    const featureLayer = layer as L.Path & { feature?: GeoJSON.Feature; getTooltip?: () => L.Tooltip | undefined }
    const code = getFeatureCode(featureLayer.feature)
    featureLayer.setStyle(getStyleForCode(code))

    const isFailed = props.failedCodes.includes(code)
    const hasTooltip = typeof featureLayer.getTooltip === 'function' && !!featureLayer.getTooltip()

    if (isFailed && !hasTooltip) {
      const featureName = getFeatureName(featureLayer.feature) || code
      featureLayer.bindTooltip(featureName, {
        direction: 'top',
        offset: [0, -6],
        className: 'map-tooltip',
      })
    }

    if (!isFailed && hasTooltip) {
      featureLayer.unbindTooltip()
    }
  })
}

const getCapitalMarkerStyle = (code: string) => {
  if (!props.showCapitals) {
    return { ...capitalBaseStyle, fillOpacity: 0, opacity: 0 }
  }

  if (props.foundCodes.includes(code)) {
    return capitalFoundStyle
  }

  if (props.failedCodes.includes(code)) {
    return capitalFailedStyle
  }

  if (props.stage !== 'capital') {
    return capitalBaseStyle
  }

  if (!props.reveal && props.selectedCode && code === props.selectedCode) {
    return capitalSelectedStyle
  }

  if (props.reveal && props.targetCode && code === props.targetCode) {
    return props.selectedCode === props.targetCode ? capitalCorrectStyle : capitalAnswerStyle
  }

  return capitalBaseStyle
}

const updateCapitalLayerVisibility = () => {
  if (!map || !capitalLayer) {
    return
  }

  if (!props.showCapitals) {
    if (map.hasLayer(capitalLayer)) {
      map.removeLayer(capitalLayer)
    }
    return
  }

  if (!map.hasLayer(capitalLayer)) {
    capitalLayer.addTo(map)
  }
}

const rebuildCapitalMarkers = () => {
  if (!map) {
    return
  }

  if (capitalLayer) {
    map.removeLayer(capitalLayer)
  }

  capitalLayer = L.layerGroup()
  capitalMarkers = new Map()

  props.capitalPoints.forEach((point) => {
    const marker = L.circleMarker([point.lat, point.lng], getCapitalMarkerStyle(point.code))

    marker.on('click', () => {
      if (props.stage !== 'capital' || props.reveal) {
        return
      }

      if (props.foundCodes.includes(point.code) || props.failedCodes.includes(point.code)) {
        return
      }

      emit('country-selected', point.code)
    })

    marker.on('mouseover', () => {
      if (props.stage !== 'capital' || props.reveal) {
        return
      }

      marker.setStyle({ ...getCapitalMarkerStyle(point.code), radius: 7 })
    })

    marker.on('mouseout', () => {
      marker.setStyle(getCapitalMarkerStyle(point.code))
    })

    marker.addTo(capitalLayer as L.LayerGroup)
    capitalMarkers.set(point.code, marker)
  })

  updateCapitalLayerVisibility()
}

const applyCapitalStyles = () => {
  capitalMarkers.forEach((marker, code) => {
    marker.setStyle(getCapitalMarkerStyle(code))
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

      const isFailed = props.failedCodes.includes(code)

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

      if (!isFailed) {
        pathLayer.on('click', () => {
          if (!props.reveal && props.stage !== 'capital') {
            emit('country-selected', code)
          }
        })
      } else {
        const featureName = getFeatureName(feature) || code
        pathLayer.bindTooltip(featureName, {
          direction: 'top',
          offset: [0, -6],
          className: 'map-tooltip',
        })
      }

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

  const capitalPane = map.createPane('capitals')
  capitalPane.style.zIndex = '650'

  map.setView([49.5822, 2.714], 4.5)

  updateMapView()
  map.on('moveend zoomend', updateMapView)

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
    rebuildCapitalMarkers()
  } catch (error) {
    console.error('Map data error:', error)
  }
})

onBeforeUnmount(() => {
  map?.off('moveend zoomend', updateMapView)
  map?.remove()
  map = null
  geoLayer = null
  capitalLayer = null
  capitalMarkers = new Map()
})

watch(
  () => [
    props.reveal,
    props.selectedCode,
    props.targetCode,
    props.foundCodes,
    props.partialCodes,
    props.failedCodes,
    props.stage,
    props.showCapitals,
  ],
  () => {
    applyLayerStyles()
    applyCapitalStyles()
    updateCapitalLayerVisibility()
  }
)

watch(
  () => props.capitalPoints,
  () => {
    rebuildCapitalMarkers()
    applyCapitalStyles()
  },
  { deep: true }
)
</script>

<template>
  <div class="relative h-[62vh] min-h-[420px] w-full overflow-hidden rounded-3xl border border-ink/10">
    <div ref="mapEl" class="relative z-0 h-full w-full"></div>
    <div class="absolute right-4 top-4 z-10 rounded-2xl border border-ink/10 bg-white/95 px-4 py-3 text-xs text-ink shadow-2xl backdrop-blur">
      <p class="text-[10px] font-semibold uppercase tracking-[0.28em] text-ink/70">Score</p>
      <p class="mt-2 font-semibold">Names: {{ props.nameScore }}/{{ props.nameTotal }}</p>
      <p v-if="props.flagsEnabled" class="font-semibold">Flags: {{ props.flagScore }}/{{ props.flagTotal }}</p>
      <p v-if="props.capitalsEnabled" class="font-semibold">
        Capitals: {{ props.capitalScore }}/{{ props.capitalTotal }}
      </p>
    </div>
    <div class="absolute bottom-4 left-4 z-10 flex flex-wrap gap-3">
      <div class="rounded-2xl bg-white/90 p-3 shadow-lg backdrop-blur">
      <p class="text-[10px] font-semibold uppercase tracking-[0.28em] text-ink/70">
        Quick Select
      </p>
      <div class="mt-2 flex flex-wrap gap-2">
        <button
          v-for="country in tinyCountryQuickSelect"
          :key="country.code"
          type="button"
          class="rounded-full border border-ink/10 px-3 py-1 text-xs font-semibold text-ink transition"
          :class="{
            'bg-white hover:border-ink/30 hover:bg-ink/5': canQuickSelect(country.code),
            'cursor-not-allowed bg-ink/5 text-ink/40': !canQuickSelect(country.code),
            'border-emerald-400/60 bg-emerald-100 text-emerald-900': props.foundCodes.includes(country.code),
            'border-orange-400/60 bg-orange-100 text-orange-900': props.partialCodes.includes(country.code),
            'border-red-400/60 bg-red-100 text-red-900': props.failedCodes.includes(country.code),
          }"
          @click="handleQuickSelect(country.code)"
        >
          {{ country.name }}
        </button>
      </div>
    </div>
      <div class="rounded-2xl bg-white/90 p-3 shadow-lg backdrop-blur">
        <p class="text-[10px] font-semibold uppercase tracking-[0.28em] text-ink/70">Difficulty</p>
        <div class="mt-2 flex flex-col gap-2">
          <label class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink/70">
            <input
              type="checkbox"
              class="h-4 w-4 rounded border-ink/30"
              :checked="props.flagsEnabled"
              @change="handleFlagsToggle"
            />
            Flags
          </label>
          <label class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink/70">
            <input
              type="checkbox"
              class="h-4 w-4 rounded border-ink/30"
              :checked="props.capitalsEnabled"
              @change="handleCapitalsToggle"
            />
            Capitals
          </label>
        </div>
      </div>
    </div>
    <div
      class="absolute bottom-4 right-4 z-10 rounded-2xl border border-ink/10 bg-white/95 p-4 shadow-2xl backdrop-blur"
      :class="{
        'ring-2 ring-emerald-300/70': !props.actionDisabled && props.actionLabel === 'Confirm',
      }"
    >
      <button
        type="button"
        class="mt-3 h-11 rounded-full border border-ink/10 px-6 text-sm font-semibold text-ink transition"
        :class="{
          'bg-ink text-white hover:bg-ink/90': !props.actionDisabled,
          'cursor-not-allowed bg-ink/5 text-ink/40': props.actionDisabled,
        }"
        :disabled="props.actionDisabled"
        @click="handleConfirmAction"
      >
        {{ actionButtonLabel }}
      </button>
    </div>
  </div>
</template>
