<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import type { QuickSelectCountry } from '../data/maps'
import MapOverlay from './MapOverlay.vue'
import { createCapitalLayer } from '../services/capitalMarkers'

type Stage = 'name' | 'flag' | 'capital'

type Props = {
  targetCode: string | null
  selectedCode: string | null
  reveal: boolean
  foundCodes: string[]
  partialCodes: string[]
  failedCodes: string[]
  capitalPoints: Array<{ code: string; name: string; lat: number; lng: number }>
  stage: Stage
  availableCodes: readonly string[]
  quickSelectCountries: readonly QuickSelectCountry[]
  geojsonUrl?: string
  featureCodeKey?: string
  featureNameKey?: string
  mapView?: {
    center: [number, number]
    zoom: number
    minZoom?: number
    maxZoom?: number
  }
  uiState: {
    actionLabel: string
    actionDisabled: boolean
    actionHighlight: boolean
    statusLabel: string
    flagsEnabled: boolean
    capitalsEnabled: boolean
    supportsFlags: boolean
    supportsCapitals: boolean
    score: {
      nameScore: number
      nameTotal: number
      flagScore: number
      flagTotal: number
      capitalScore: number
      capitalTotal: number
      flagsEnabled: boolean
      capitalsEnabled: boolean
    }
  }
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (event: 'country-selected', code: string): void
  (event: 'confirm-action'): void
  (event: 'update:flags-enabled', value: boolean): void
  (event: 'update:capitals-enabled', value: boolean): void
  (event: 'reset-game'): void
}>()

const mapEl = ref<HTMLDivElement | null>(null)
let map: L.Map | null = null
let geoLayer: L.GeoJSON | null = null
let capitalLayer: ReturnType<typeof createCapitalLayer> | null = null

const DEFAULT_GEOJSON_URL =
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

const aliasMap: Record<string, string> = {
  UK: 'GB',
  EL: 'GR',
  FX: 'FR',
}

const allowedSet = computed(() => new Set(props.availableCodes))
const shouldFilterByAllowed = computed(
  () => props.availableCodes.length > 0 && !props.geojsonUrl
)
const isAllowedCode = (code: string) =>
  !shouldFilterByAllowed.value || allowedSet.value.has(code)

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

    if (isAllowedCode(normalized)) {
      return normalized
    }
  }

  return ''
}

const getFeatureCode = (feature: GeoJSON.Feature | undefined) => {
  if (!feature) {
    return ''
  }

  if (props.featureCodeKey && feature.properties) {
    const value = (feature.properties as Record<string, unknown>)[props.featureCodeKey]
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value).trim()
    }
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

  if (props.featureNameKey) {
    const value = (feature.properties as Record<string, unknown>)[props.featureNameKey]
    if (typeof value === 'string' && value.trim().length) {
      return value.trim()
    }
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
  if (code && shouldFilterByAllowed.value && !isAllowedCode(code)) {
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
  if (props.uiState.actionDisabled) {
    return
  }

  emit('confirm-action')
}

const handleResetGame = () => {
  emit('reset-game')
}

const quickSelectItems = computed(() =>
  props.quickSelectCountries.map((country) => {
    const disabled = !canQuickSelect(country.code)
    let tone: 'default' | 'found' | 'partial' | 'failed' = 'default'

    if (props.foundCodes.includes(country.code)) {
      tone = 'found'
    } else if (props.partialCodes.includes(country.code)) {
      tone = 'partial'
    } else if (props.failedCodes.includes(country.code)) {
      tone = 'failed'
    }

    return {
      code: country.code,
      name: country.name,
      disabled,
      tone,
    }
  })
)

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
  if (!props.uiState.capitalsEnabled) {
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

const isCapitalInteractive = () => props.stage === 'capital' && !props.reveal

const canSelectCapital = (code: string) =>
  isCapitalInteractive() &&
  !props.foundCodes.includes(code) &&
  !props.failedCodes.includes(code)

const ensureCapitalLayer = () => {
  if (!map) {
    return
  }

  if (!capitalLayer) {
    capitalLayer = createCapitalLayer({
      map,
      getMarkerStyle: getCapitalMarkerStyle,
      canSelect: canSelectCapital,
      isInteractive: isCapitalInteractive,
      onSelect: (code) => emit('country-selected', code),
    })
  }
}

const buildLayer = (geojson: GeoJSON.FeatureCollection) => {
  if (geoLayer && map) {
    map.removeLayer(geoLayer)
  }

  const allowedFeatures = geojson.features.filter((feature) => {
    const code = getFeatureCode(feature)
    return isAllowedCode(code)
  })

  const allowAnyClick = !allowedFeatures.length && !shouldFilterByAllowed.value
  const featuresToShow = allowedFeatures.length ? allowedFeatures : geojson.features

  console.info('Map feature stats', {
    total: geojson.features.length,
    allowed: allowedFeatures.length,
  })

  geoLayer = L.geoJSON(featuresToShow, {
    style: (feature) => getStyleForCode(getFeatureCode(feature as GeoJSON.Feature)),
    onEachFeature: (feature, layer) => {
      const code = getFeatureCode(feature)

      if (!code || (!allowAnyClick && !isAllowedCode(code))) {
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

  if (allowedFeatures.length) {
    map?.fitBounds(geoLayer.getBounds(), { padding: [24, 24] })
  }
}

const updateView = (view: {
  center: [number, number]
  zoom: number
  minZoom?: number
  maxZoom?: number
}) => {
  if (!map) {
    return
  }

  map.setMinZoom(view.minZoom ?? 4)
  map.setMaxZoom(view.maxZoom ?? 10)
  map.setView(view.center, view.zoom)
}

const loadGeojson = async () => {
  if (!map) {
    return
  }

  try {
    const response = await fetch(props.geojsonUrl ?? DEFAULT_GEOJSON_URL)

    if (!response.ok) {
      throw new Error('Failed to load map data.')
    }

    const geojson = (await response.json()) as GeoJSON.FeatureCollection
    buildLayer(geojson)
    capitalLayer?.rebuild(props.capitalPoints)
    capitalLayer?.setVisible(props.uiState.capitalsEnabled)
  } catch (error) {
    console.error('Map data error:', error)
  }
}

onMounted(async () => {
  if (!mapEl.value) {
    return
  }

  const view = props.mapView ?? {
    center: [49.5822, 2.714] as [number, number],
    zoom: 4.5,
    minZoom: 4,
    maxZoom: 10,
  }

  map = L.map(mapEl.value, {
    zoomControl: false,
    minZoom: view.minZoom ?? 4,
    maxZoom: view.maxZoom ?? 10,
    scrollWheelZoom: true,
  })

  const capitalPane = map.createPane('capitals')
  capitalPane.style.zIndex = '650'

  ensureCapitalLayer()
  updateView(view)

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 10,
  }).addTo(map)

  requestAnimationFrame(() => {
    map?.invalidateSize()
  })

  await loadGeojson()
})

onBeforeUnmount(() => {
  map?.remove()
  map = null
  geoLayer = null
  capitalLayer?.dispose()
  capitalLayer = null
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
    props.uiState.capitalsEnabled,
    props.availableCodes,
  ],
  () => {
    applyLayerStyles()
    capitalLayer?.applyStyles()
    capitalLayer?.setVisible(props.uiState.capitalsEnabled)
  }
)

watch(
  () => [props.geojsonUrl, props.featureCodeKey, props.featureNameKey],
  () => {
    void loadGeojson()
  }
)

watch(
  () => props.mapView,
  (next) => {
    if (!next) {
      return
    }

    updateView(next)
  },
  { deep: true }
)

watch(
  () => props.capitalPoints,
  () => {
    ensureCapitalLayer()
    capitalLayer?.rebuild(props.capitalPoints)
    capitalLayer?.applyStyles()
  },
  { deep: true }
)
</script>

<template>
  <div class="relative h-[62vh] min-h-[420px] w-full overflow-hidden rounded-3xl border border-ink/10">
    <div ref="mapEl" class="relative z-0 h-full w-full"></div>
    <MapOverlay
      :quick-select-items="quickSelectItems"
      :ui-state="props.uiState"
      @quick-select="handleQuickSelect"
      @toggle-flags="emit('update:flags-enabled', $event)"
      @toggle-capitals="emit('update:capitals-enabled', $event)"
      @action="handleConfirmAction"
      @reset="handleResetGame"
    />
  </div>
</template>
