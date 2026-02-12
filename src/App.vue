<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import EuropeMap from './components/EuropeMap.vue'
import { fetchEuropeCountries, type CountryInfo } from './services/countryApi'

const loading = ref(true)
const errorMessage = ref('')
const countries = ref<Record<string, CountryInfo>>({})
const flagsEnabled = ref(false)
const capitalsEnabled = ref(false)

type Stage = 'name' | 'flag' | 'capital'

const targetCode = ref<string | null>(null)
const selectedCode = ref<string | null>(null)
const reveal = ref(false)
const isCorrect = ref<boolean | null>(null)
const foundCodes = ref(new Set<string>())
const failedCodes = ref(new Set<string>())
const stage = ref<Stage>('name')
const progressByCode = ref<Record<string, { name: boolean; flag: boolean; capital: boolean }>>({})

const targetCountry = computed(() =>
  targetCode.value ? countries.value[targetCode.value] : undefined
)
const selectedCountry = computed(() =>
  selectedCode.value ? countries.value[selectedCode.value] : undefined
)
const isFlagStage = computed(() => stage.value === 'flag')
const isCapitalStage = computed(() => stage.value === 'capital')
const targetTitle = computed(() => {
  if (isFlagStage.value) {
    return 'Which country is this flag?'
  }

  if (isCapitalStage.value) {
    return targetCountry.value?.capital
      ? `Find "${targetCountry.value.capital}".`
      : 'Find the capital city.'
  }

  return promptLabel.value
})

const statusLabel = computed(() => {
  if (!reveal.value) {
    return 'Make your pick'
  }

  return isCorrect.value ? 'Correct' : 'Try again'
})

const statusTone = computed(() => {
  if (!reveal.value) {
    return 'bg-white/70 text-ink'
  }

  return isCorrect.value ? 'bg-jade/90 text-white' : 'bg-ember text-white'
})

const promptLabel = computed(() => {
  if (loading.value) {
    return 'Loading country data...'
  }

  if (errorMessage.value) {
    return 'Unable to load countries.'
  }

  return targetCountry.value?.name ?? 'Ready for a new round?'
})

const instructionLabel = computed(() =>
  isCapitalStage.value
    ? 'Click the capital city marker that matches the prompt, then confirm your choice.'
    : 'Click the country that matches the prompt, then confirm your choice.'
)

const hintLabel = computed(() => {
  if (loading.value || errorMessage.value) {
    return isCapitalStage.value
      ? 'Click the capital city marker.'
      : 'Click the country outline on the map.'
  }

  if (!reveal.value || !targetCountry.value) {
    return isCapitalStage.value
      ? 'Click the capital city marker.'
      : 'Click the country outline on the map.'
  }

  return `Capital: ${targetCountry.value.capital}`
})

const answerSummary = computed(() => {
  if (!reveal.value || !targetCountry.value) {
    return 'Pick a country to reveal its details.'
  }

  if (isCorrect.value) {
    const progress = targetCode.value ? progressByCode.value[targetCode.value] : undefined
    const completed = progress && targetCode.value
      ? isCodeComplete(targetCode.value, progress)
      : false
    return completed
      ? `You completed ${targetCountry.value.name}.`
      : `Correct!`
  }

  return `The correct answer was ${targetCountry.value.name}.`
})

const PLONKIT_OVERRIDES: Record<string, string> = {
  BA: 'bosnia-and-herzegovina',
  CZ: 'czechia',
  GB: 'united-kingdom',
  MK: 'north-macedonia',
  VA: 'vatican-city',
  XK: 'kosovo',
}

const toPlonkitSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/['.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

const plonkitUrl = computed(() => {
  if (!targetCountry.value || !targetCode.value) {
    return ''
  }

  const override = PLONKIT_OVERRIDES[targetCode.value]
  const slug = override ?? toPlonkitSlug(targetCountry.value.name)
  return `https://www.plonkit.net/${slug}`
})

const nameTotal = computed(() => Object.keys(countries.value).length)
const flagTotal = computed(() =>
  Object.values(countries.value).filter((country) => country.flagUrl).length
)
const capitalTotal = computed(() =>
  Object.values(countries.value).filter((country) => country.capitalLatLng).length
)

const nameScore = computed(() =>
  Object.entries(progressByCode.value).reduce(
    (sum, [, progress]) => sum + (progress.name ? 1 : 0),
    0
  )
)
const flagScore = computed(() =>
  Object.entries(countries.value).reduce((sum, [code, country]) => {
    if (!country.flagUrl) {
      return sum
    }
    return sum + (progressByCode.value[code]?.flag ? 1 : 0)
  }, 0)
)
const capitalScore = computed(() =>
  Object.entries(countries.value).reduce((sum, [code, country]) => {
    if (!country.capitalLatLng) {
      return sum
    }
    return sum + (progressByCode.value[code]?.capital ? 1 : 0)
  }, 0)
)

const foundCodesList = computed(() => Array.from(foundCodes.value))
const failedCodesList = computed(() => Array.from(failedCodes.value))
const partialCodesList = computed(() =>
  Object.entries(progressByCode.value)
    .filter(([code, progress]) => {
      const completed = isCodeComplete(code, progress)
      const anyProgress =
        progress.name ||
        (flagsEnabled.value && progress.flag) ||
        (capitalsEnabled.value && progress.capital)
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

const getProgress = (code: string) => {
  if (!progressByCode.value[code]) {
    progressByCode.value[code] = { name: false, flag: false, capital: false }
  }

  return progressByCode.value[code]
}

const getAvailableStages = (code: string) => {
  const stages: Stage[] = ['name']

  if (flagsEnabled.value && countries.value[code]?.flagUrl) {
    stages.push('flag')
  }

  if (capitalsEnabled.value && countries.value[code]?.capitalLatLng) {
    stages.push('capital')
  }

  return stages
}

const isStageComplete = (
  progress: { name: boolean; flag: boolean; capital: boolean },
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

const isCodeComplete = (code: string, progress: { name: boolean; flag: boolean; capital: boolean }) => {
  const hasFlag = flagsEnabled.value && !!countries.value[code]?.flagUrl
  const hasCapital = capitalsEnabled.value && !!countries.value[code]?.capitalLatLng
  return (
    progress.name &&
    (!hasFlag || progress.flag) &&
    (!hasCapital || progress.capital)
  )
}

const getInitialStage = (code: string): Stage => {
  const stages = getAvailableStages(code)
  return stages[Math.floor(Math.random() * stages.length)] ?? 'name'
}

const getStageForCode = (code: string): Stage => {
  const progress = getProgress(code)
  const remainingStages = getAvailableStages(code).filter(
    (stageValue) => !isStageComplete(progress, stageValue)
  )

  if (!remainingStages.length) {
    return getInitialStage(code)
  }

  if (remainingStages.length === 1) {
    return remainingStages[0] ?? 'name'
  }

  return remainingStages[Math.floor(Math.random() * remainingStages.length)] ?? 'name'
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
  Object.entries(progressByCode.value).forEach(([code, progress]) => {
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


onMounted(async () => {
  window.addEventListener('keydown', handleSpaceKey)

  try {
    countries.value = await fetchEuropeCountries()
    pickNewTarget()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load data.'
  } finally {
    loading.value = false
  }
})

watch([flagsEnabled, capitalsEnabled], () => {
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
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleSpaceKey)
})
</script>

<template>
  <div class="min-h-screen px-6 py-8 lg:px-10">
    <header class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
      <div class="max-w-2xl">
        <span class="tag">Europe Edition</span>
        <h1 class="mt-4 text-5xl text-ink md:text-6xl">Map Mentor</h1>
        <p class="mt-4 text-base text-ink/70 md:text-lg">
          Find the highlighted country by clicking its outline. Each round reveals the
          answer and a quick geography fact.
        </p>
      </div>
      <div class="panel flex min-w-[260px] flex-col gap-3 px-6 py-4">
        <p class="text-xs uppercase tracking-[0.3em] text-ink/60">Round Status</p>
        <div
          class="flex h-12 items-center rounded-2xl px-4 text-center text-lg font-semibold"
          :class="statusTone"
        >
          {{ statusLabel }}
        </div>
        <div class="text-sm text-ink/70">
          <p class="font-semibold">Names: {{ nameScore }}/{{ nameTotal }}</p>
          <p v-if="flagsEnabled" class="font-semibold">Flags: {{ flagScore }}/{{ flagTotal }}</p>
          <p v-if="capitalsEnabled" class="font-semibold">Capitals: {{ capitalScore }}/{{ capitalTotal }}</p>
        </div>
        <p class="text-sm text-ink/70">{{ hintLabel }}</p>
        <div class="mt-2 flex flex-col gap-2">
          <p class="text-xs uppercase tracking-[0.3em] text-ink/50">Difficulty</p>
          <label class="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink/70">
            <input v-model="flagsEnabled" type="checkbox" class="h-4 w-4 rounded border-ink/30" />
            Flags
          </label>
          <label class="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink/70">
            <input v-model="capitalsEnabled" type="checkbox" class="h-4 w-4 rounded border-ink/30" />
            Capitals
          </label>
        </div>
      </div>
    </header>

    <main class="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-stretch">
      <section class="panel h-full p-5 md:p-6">
        <EuropeMap
          :target-code="targetCode"
          :selected-code="selectedCode"
          :reveal="reveal"
          :found-codes="foundCodesList"
          :partial-codes="partialCodesList"
          :failed-codes="failedCodesList"
          :capital-points="capitalPoints"
          :show-capitals="capitalsEnabled"
          :stage="stage"
          :action-label="actionLabel"
          :action-disabled="actionDisabled"
          @country-selected="handleGuess"
          @confirm-action="handlePrimaryAction"
        />
      </section>

      <section class="flex h-full min-h-0 flex-col gap-6">
        <div class="panel p-6">
          <p class="text-xs uppercase tracking-[0.3em] text-ink/60">
            {{ reveal ? 'Answer' : 'Target' }}
          </p>
          <div v-if="!reveal">
            <h2 class="mt-3 text-4xl text-ink">{{ targetTitle }}</h2>
            <p
              v-if="!isFlagStage && !isCapitalStage && targetCountry?.frenchName"
              class="mt-2 text-lg text-ink/60"
            >
              {{ targetCountry.frenchName }}
            </p>
            <div
              v-if="isFlagStage"
              class="mt-4 flex min-h-[140px] items-center justify-center rounded-2xl border border-ink/10 bg-white/70"
            >
              <img
                v-if="targetCountry?.flagUrl"
                :src="targetCountry.flagUrl"
                :alt="targetCountry.flagAlt || `Flag of ${targetCountry.name}`"
                class="h-full w-full rounded-2xl object-cover"
                loading="lazy"
              />
              <span v-else class="text-xs uppercase tracking-[0.3em] text-ink/40">Flag</span>
            </div>
            <p class="mt-3 text-base text-ink/70">
              {{ instructionLabel }}
            </p>
          </div>
          <div
            v-else
            class="mt-3 flex flex-col gap-6 rounded-2xl border border-ink/10 p-4 md:flex-row md:items-stretch md:justify-between"
            :class="{
              'border-2 border-jade/70 bg-jade/10': isCorrect === true,
              'border-2 border-ember/70 bg-ember/10': isCorrect === false,
            }"
          >
            <div class="md:w-1/2">
              <p class="text-xl text-ink md:text-2xl">{{ answerSummary }}</p>
              <p
                v-if="isCorrect === false && selectedCountry"
                class="mt-2 text-sm text-ink/70 md:text-base"
              >
                Your guess: <span class="font-semibold text-ink">{{ selectedCountry.name }}</span>
              </p>
              <div class="mt-4 grid gap-3 sm:grid-cols-2">
                <div class="rounded-2xl border border-ink/10 bg-white/80 px-4 py-3">
                  <p class="text-[10px] font-semibold uppercase tracking-[0.3em] text-ink/50">
                    Capital City
                  </p>
                  <p class="mt-2 text-xl font-semibold text-ink md:text-2xl">
                    {{ targetCountry?.capital || 'Unknown' }}
                  </p>
                </div>
                <div class="rounded-2xl border border-ink/10 bg-white/70 px-4 py-3">
                  <p class="text-[10px] font-semibold uppercase tracking-[0.3em] text-ink/50">
                    Region
                  </p>
                  <p class="mt-2 text-sm font-semibold text-ink md:text-base">
                    {{ targetCountry?.subregion || targetCountry?.region || 'Europe' }}
                  </p>
                </div>
              </div>
              <div class="mt-4">
                <a
                  v-if="plonkitUrl"
                  :href="plonkitUrl"
                  class="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-ink/70 transition hover:border-ink/30 hover:text-ink"
                  target="_blank"
                  rel="noopener"
                >
                  Plonk It guide
                </a>
              </div>
            </div>
            <div
              class="flex min-h-[150px] w-full items-center justify-center rounded-2xl border border-ink/10 bg-white/70 md:w-1/2"
            >
              <img
                v-if="targetCountry?.flagUrl"
                :src="targetCountry.flagUrl"
                :alt="targetCountry.flagAlt || `Flag of ${targetCountry.name}`"
                class="h-full w-full rounded-2xl object-cover"
                loading="lazy"
              />
              <span v-else class="text-xs uppercase tracking-[0.3em] text-ink/40">Flag</span>
            </div>
          </div>
        </div>

        <div v-if="errorMessage" class="panel border-ember/40 bg-white/90 p-5">
          <p class="text-sm font-semibold text-ember">{{ errorMessage }}</p>
          <p class="mt-2 text-sm text-ink/70">
            Try refreshing the page. The REST Countries API may be temporarily unavailable.
          </p>
        </div>
      </section>
    </main>
  </div>
</template>
