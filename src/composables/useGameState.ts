import { computed, onBeforeUnmount, onMounted, reactive, ref, watch, unref, type ComputedRef, type Ref } from 'vue'
import { fetchCountries, type CountryInfo } from '../services/countryApi'
import { fetchGeojsonAreas } from '../services/geojsonAreas'
import { EUROPE_MAP, type MapConfig } from '../data/maps'

export type Stage = 'name' | 'flag' | 'capital'

const toPlonkitSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/['.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

const COPY = {
  loading: 'Loading country data...',
  loadError: 'Unable to load countries.',
  ready: 'Ready for a new round?',
  statusReady: 'Make your pick',
  statusCorrect: 'Correct',
  statusRetry: 'Try again',
  flagPrompt: 'Which country is this flag?',
  capitalPromptFallback: 'Find the capital city.',
  instructionDefault: 'Click the country that matches the prompt, then confirm your choice.',
  instructionCapital: 'Click the capital city marker that matches the prompt, then confirm your choice.',
  mapHintDefault: 'Click the country outline on the map.',
  mapHintCapital: 'Click the capital city marker.',
  answerPending: 'Pick a country to reveal its details.',
  answerCorrect: 'Correct!',
  answerWrong: (name: string) => `The correct answer was ${name}.`,
  answerCompleted: (name: string) => `You completed ${name}.`,
  capitalFact: (capital: string) => `Capital: ${capital}`,
} as const

const SETTINGS_KEY = 'learn-countries:settings'

const readSettings = () => {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(SETTINGS_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as { flagsEnabled?: boolean; capitalsEnabled?: boolean }
  } catch {
    return null
  }
}

const writeSettings = (settings: { flagsEnabled: boolean; capitalsEnabled: boolean }) => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

type Progress = { name: boolean; flag: boolean; capital: boolean }

type MapSource = MapConfig | Ref<MapConfig> | ComputedRef<MapConfig>

type UseGameStateOptions = {
  map?: MapSource
}

export const useGameState = (options: UseGameStateOptions = {}) => {
  const mapSource = options.map ?? EUROPE_MAP
  const activeMap = computed(() => unref(mapSource))
  const persisted = readSettings()
  const loading = ref(true)
  const errorMessage = ref('')
  const countries = ref<Record<string, CountryInfo>>({})
  const flagsEnabled = ref(persisted?.flagsEnabled ?? false)
  const capitalsEnabled = ref(persisted?.capitalsEnabled ?? false)

  const targetCode = ref<string | null>(null)
  const selectedCode = ref<string | null>(null)
  const reveal = ref(false)
  const isCorrect = ref<boolean | null>(null)
  const foundCodes = ref(new Set<string>())
  const failedCodes = ref(new Set<string>())
  const stage = ref<Stage>('name')
  const progressByCode = reactive(new Map<string, Progress>())
  const remainingStagesByCode = reactive(new Map<string, Stage[]>())

  const targetCountry = computed(() =>
    targetCode.value ? countries.value[targetCode.value] : undefined
  )
  const selectedCountry = computed(() =>
    selectedCode.value ? countries.value[selectedCode.value] : undefined
  )
  const isFlagStage = computed(() => stage.value === 'flag')
  const isCapitalStage = computed(() => stage.value === 'capital')

  const statusLabel = computed(() => {
    if (!reveal.value) {
      return COPY.statusReady
    }

    return isCorrect.value ? COPY.statusCorrect : COPY.statusRetry
  })


  const promptLabel = computed(() => {
    if (loading.value) {
      return COPY.loading
    }

    if (errorMessage.value) {
      return COPY.loadError
    }

    return targetCountry.value?.name ?? COPY.ready
  })

  const targetTitle = computed(() => {
    if (isFlagStage.value) {
      return COPY.flagPrompt
    }

    if (isCapitalStage.value) {
      return targetCountry.value?.capital
        ? `Find "${targetCountry.value.capital}".`
        : COPY.capitalPromptFallback
    }

    return promptLabel.value
  })

  const instructionLabel = computed(() =>
    isCapitalStage.value
      ? COPY.instructionCapital
      : COPY.instructionDefault
  )


  const answerSummary = computed(() => {
    if (!reveal.value || !targetCountry.value) {
      return COPY.answerPending
    }

    if (isCorrect.value) {
      const progress = targetCode.value ? progressByCode.get(targetCode.value) : undefined
      const completed = progress && targetCode.value
        ? isCodeComplete(targetCode.value, progress)
        : false
      return completed
        ? COPY.answerCompleted(targetCountry.value.name)
        : COPY.answerCorrect
    }

    return COPY.answerWrong(targetCountry.value.name)
  })

  const plonkitUrl = computed(() => {
    if (!targetCountry.value || !targetCode.value) {
      return ''
    }

    const override = activeMap.value.plonkitOverrides?.[targetCode.value]
    const slug = override ?? toPlonkitSlug(targetCountry.value.name)
    return `https://www.plonkit.net/${slug}`
  })

  const nameTotal = computed(() => Object.keys(countries.value).length)
  const supportsFlags = computed(() => activeMap.value.supportsFlags)
  const supportsCapitals = computed(() => activeMap.value.supportsCapitals)
  const flagsActive = computed(() => flagsEnabled.value && supportsFlags.value)
  const capitalsActive = computed(() => capitalsEnabled.value && supportsCapitals.value)
  const flagTotal = computed(() =>
    Object.values(countries.value).filter((country) => country.flagUrl).length
  )
  const capitalTotal = computed(() =>
    Object.values(countries.value).filter((country) => country.capitalLatLng).length
  )

  const nameScore = computed(() =>
    Array.from(progressByCode.values()).reduce(
      (sum, progress) => sum + (progress.name ? 1 : 0),
      0
    )
  )
  const flagScore = computed(() =>
    Object.entries(countries.value).reduce((sum, [code, country]) => {
      if (!country.flagUrl) {
        return sum
      }
      return sum + (progressByCode.get(code)?.flag ? 1 : 0)
    }, 0)
  )
  const capitalScore = computed(() =>
    Object.entries(countries.value).reduce((sum, [code, country]) => {
      if (!country.capitalLatLng) {
        return sum
      }
      return sum + (progressByCode.get(code)?.capital ? 1 : 0)
    }, 0)
  )

  const foundCodesList = computed(() => Array.from(foundCodes.value))
  const failedCodesList = computed(() => Array.from(failedCodes.value))
  const partialCodesList = computed(() =>
    Array.from(progressByCode.entries())
      .filter(([code, progress]) => {
        const completed = isCodeComplete(code, progress)
        const anyProgress =
          progress.name ||
          (flagsActive.value && progress.flag) ||
          (capitalsActive.value && progress.capital)
        return anyProgress && !completed
      })
      .map(([code]) => code)
  )

  const capitalPoints = computed(() =>
    Object.values(countries.value)
      .filter((country) => country.capitalLatLng)
      .map((country) => ({
        code: country.code,
        name: country.capital,
        lat: country.capitalLatLng?.lat ?? 0,
        lng: country.capitalLatLng?.lng ?? 0,
      }))
  )

  const availableCodes = computed(() => Object.keys(countries.value))

  const getProgress = (code: string) => {
    if (!progressByCode.has(code)) {
      progressByCode.set(code, { name: false, flag: false, capital: false })
    }

    return progressByCode.get(code) as Progress
  }

  const getAvailableStages = (code: string) => {
    const stages: Stage[] = ['name']

    if (flagsActive.value && countries.value[code]?.flagUrl) {
      stages.push('flag')
    }

    if (capitalsActive.value && countries.value[code]?.capitalLatLng) {
      stages.push('capital')
    }

    return stages
  }

  const isStageComplete = (
    progress: Progress,
    stageValue: Stage
  ) => {
    switch (stageValue) {
      case 'name':
        return progress.name
      case 'flag':
        return progress.flag
      case 'capital':
        return progress.capital
      default:
        return false
    }
  }

  const isCodeComplete = (
    code: string,
    progress: Progress
  ) => {
    const hasFlag = flagsActive.value && !!countries.value[code]?.flagUrl
    const hasCapital = capitalsActive.value && !!countries.value[code]?.capitalLatLng
    return (
      progress.name &&
      (!hasFlag || progress.flag) &&
      (!hasCapital || progress.capital)
    )
  }

  const shuffleStages = (stages: Stage[]) => {
    const result = [...stages]
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1))
      const temp = result[index] as Stage
      result[index] = result[swapIndex] as Stage
      result[swapIndex] = temp
    }
    return result
  }

  const syncRemainingStages = (code: string, progress: Progress) => {
    const available = getAvailableStages(code).filter(
      (stageValue) => !isStageComplete(progress, stageValue)
    )

    const existing = remainingStagesByCode.get(code) ?? []
    const filteredExisting = existing.filter((stageValue) => available.includes(stageValue))
    const missing = available.filter((stageValue) => !filteredExisting.includes(stageValue))
    const nextStages = [...filteredExisting, ...shuffleStages(missing)]

    remainingStagesByCode.set(code, nextStages)
    return nextStages
  }

  const getStageForCode = (code: string): Stage => {
    const progress = getProgress(code)
    const remainingStages = syncRemainingStages(code, progress)

    if (!remainingStages.length) {
      const refreshed = shuffleStages(getAvailableStages(code))
      remainingStagesByCode.set(code, refreshed)
      return refreshed[0] ?? 'name'
    }

    return remainingStages[0] ?? 'name'
  }

  const pickNewTarget = () => {
    const availableCodes = Object.keys(countries.value).filter(
      (code) => !foundCodes.value.has(code) && !failedCodes.value.has(code)
    )

    if (!availableCodes.length) {
      return
    }

    const nextIndex = Math.floor(Math.random() * availableCodes.length)
    const nextCode = availableCodes[nextIndex] ?? null
    targetCode.value = nextCode
    selectedCode.value = null
    reveal.value = false
    isCorrect.value = null
    stage.value = nextCode ? getStageForCode(nextCode) : 'name'
  }

  const refreshFoundCodes = () => {
    const refreshed = new Set<string>()
    Array.from(progressByCode.entries()).forEach(([code, progress]) => {
      if (isCodeComplete(code, progress)) {
        refreshed.add(code)
      }
    })
    foundCodes.value = refreshed
  }

  const handleGuess = (code: string) => {
    if (reveal.value) {
      return
    }

    selectedCode.value = code
  }

  const confirmGuess = () => {
    if (!selectedCode.value || !targetCode.value) {
      return
    }

    reveal.value = true
    isCorrect.value = selectedCode.value === targetCode.value
    if (isCorrect.value) {
      const progress = getProgress(targetCode.value)

      if (stage.value === 'name') {
        if (!progress.name) {
          progress.name = true
        }
      } else if (stage.value === 'flag') {
        if (!progress.flag) {
          progress.flag = true
        }
      } else if (stage.value === 'capital') {
        if (!progress.capital) {
          progress.capital = true
        }
      }

      const remainingStages = remainingStagesByCode.get(targetCode.value)
      if (remainingStages) {
        remainingStagesByCode.set(
          targetCode.value,
          remainingStages.filter((stageValue) => stageValue !== stage.value)
        )
      }

      if (isCodeComplete(targetCode.value, progress)) {
        foundCodes.value.add(targetCode.value)
      }
    } else {
      failedCodes.value.add(targetCode.value)
    }
  }

  const advanceRound = () => {
    if (!targetCode.value) {
      pickNewTarget()
      return
    }

    pickNewTarget()
  }

  const resetGame = () => {
    progressByCode.clear()
    remainingStagesByCode.clear()
    foundCodes.value = new Set()
    failedCodes.value = new Set()
    selectedCode.value = null
    reveal.value = false
    isCorrect.value = null
    targetCode.value = null
    stage.value = 'name'
    pickNewTarget()
  }

  const actionLabel = computed(() => (reveal.value ? 'Next' : 'Confirm'))
  const actionDisabled = computed(() => {
    if (loading.value || !!errorMessage.value) {
      return true
    }

    if (reveal.value) {
      return false
    }

    return !selectedCode.value
  })

  const handlePrimaryAction = () => {
    if (actionDisabled.value) {
      return
    }

    if (reveal.value) {
      advanceRound()
    } else {
      confirmGuess()
    }
  }

  const shouldIgnoreSpace = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) {
      return false
    }

    return !!target.closest('input, textarea, select, [contenteditable="true"]')
  }

  const handleSpaceKey = (event: KeyboardEvent) => {
    if (event.code !== 'Space' && event.key !== ' ') {
      return
    }

    if (shouldIgnoreSpace(event.target)) {
      return
    }

    event.preventDefault()
    handlePrimaryAction()
  }

  const resetProgress = () => {
    progressByCode.clear()
    remainingStagesByCode.clear()
    foundCodes.value = new Set()
    failedCodes.value = new Set()
    selectedCode.value = null
    reveal.value = false
    isCorrect.value = null
    targetCode.value = null
    stage.value = 'name'
  }

  const loadMap = async (next: MapConfig) => {
    loading.value = true
    errorMessage.value = ''
    countries.value = {}
    resetProgress()

    if (!next.supportsFlags) {
      flagsEnabled.value = false
    }

    if (!next.supportsCapitals) {
      capitalsEnabled.value = false
    }

    try {
      if (next.kind === 'geojson') {
        if (!next.geojsonUrl || !next.geojsonCodeKey || !next.geojsonNameKey) {
          throw new Error('Missing geojson config.')
        }
        countries.value = await fetchGeojsonAreas({
          url: next.geojsonUrl,
          codeKey: next.geojsonCodeKey,
          nameKey: next.geojsonNameKey,
          cacheKey: next.cacheKey,
        })
      } else {
        countries.value = await fetchCountries(next.codes ?? [], next.cacheKey)
      }
      pickNewTarget()
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Failed to load data.'
    } finally {
      loading.value = false
    }
  }

  onMounted(async () => {
    window.addEventListener('keydown', handleSpaceKey)
    await loadMap(activeMap.value)
  })

  watch(
    () => activeMap.value.id,
    async (nextId, prevId) => {
      if (nextId === prevId) {
        return
      }

      await loadMap(activeMap.value)
    }
  )

  watch([flagsEnabled, capitalsEnabled], () => {
    writeSettings({
      flagsEnabled: flagsEnabled.value,
      capitalsEnabled: capitalsEnabled.value,
    })

    refreshFoundCodes()
    if (!targetCode.value) {
      return
    }

    const availableStages = getAvailableStages(targetCode.value)
    if (!availableStages.includes(stage.value)) {
      stage.value = getStageForCode(targetCode.value)
      selectedCode.value = null
      reveal.value = false
      isCorrect.value = null
    }

    const progress = getProgress(targetCode.value)
    syncRemainingStages(targetCode.value, progress)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleSpaceKey)
  })

  return {
    actionDisabled,
    actionLabel,
    answerSummary,
    availableCodes,
    capitalPoints,
    capitalScore,
    capitalTotal,
    capitalsEnabled,
    capitalsActive,
    errorMessage,
    failedCodesList,
    flagScore,
    flagTotal,
    flagsEnabled,
    flagsActive,
    foundCodesList,
    handleGuess,
    handlePrimaryAction,
    instructionLabel,
    isCapitalStage,
    isCorrect,
    isFlagStage,
    nameScore,
    nameTotal,
    partialCodesList,
    plonkitUrl,
    reveal,
    resetGame,
    selectedCode,
    selectedCountry,
    stage,
    statusLabel,
    supportsCapitals,
    supportsFlags,
    targetCode,
    targetCountry,
    targetTitle,
  }
}
