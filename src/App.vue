<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import EuropeMap from './components/EuropeMap.vue'
import { fetchEuropeCountries, type CountryInfo } from './services/countryApi'

const loading = ref(true)
const errorMessage = ref('')
const countries = ref<Record<string, CountryInfo>>({})

const targetCode = ref<string | null>(null)
const selectedCode = ref<string | null>(null)
const reveal = ref(false)
const isCorrect = ref<boolean | null>(null)

const targetCountry = computed(() =>
  targetCode.value ? countries.value[targetCode.value] : undefined
)

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

const hintLabel = computed(() => {
  if (loading.value || errorMessage.value) {
    return 'Click the country outline on the map.'
  }

  if (!reveal.value || !targetCountry.value) {
    return 'Click the country outline on the map.'
  }

  return `Capital: ${targetCountry.value.capital}`
})

const answerSummary = computed(() => {
  if (!reveal.value || !targetCountry.value) {
    return 'Pick a country to reveal its details.'
  }

  return isCorrect.value
    ? `You found ${targetCountry.value.name}.`
    : `The correct answer was ${targetCountry.value.name}.`
})

const answerDetail = computed(() => {
  if (!reveal.value || !targetCountry.value) {
    return 'We will show the capital and region after each guess.'
  }

  const regionLabel = targetCountry.value.subregion || targetCountry.value.region || 'Europe'
  return `Capital: ${targetCountry.value.capital} · Region: ${regionLabel}`
})

const pickNewTarget = () => {
  const availableCodes = Object.keys(countries.value)

  if (!availableCodes.length) {
    return
  }

  const nextIndex = Math.floor(Math.random() * availableCodes.length)
  targetCode.value = availableCodes[nextIndex] ?? null
  selectedCode.value = null
  reveal.value = false
  isCorrect.value = null
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
}

const resetRound = () => {
  selectedCode.value = null
  reveal.value = false
  isCorrect.value = null
}

onMounted(async () => {
  try {
    countries.value = await fetchEuropeCountries()
    pickNewTarget()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load data.'
  } finally {
    loading.value = false
  }
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
        <div class="flex items-center justify-between gap-3">
          <button
            class="ghost h-12 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            @click="confirmGuess"
            :disabled="loading || !!errorMessage || reveal || !selectedCode"
          >
            Confirm
          </button>
          <div
            class="flex h-12 items-center rounded-2xl px-4 text-center text-lg font-semibold"
            :class="statusTone"
          >
            {{ statusLabel }}
          </div>
        </div>
        <p class="text-sm text-ink/70">{{ hintLabel }}</p>
      </div>
    </header>

    <main class="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-stretch">
      <section class="panel h-full p-5 md:p-6">
        <EuropeMap
          :target-code="targetCode"
          :selected-code="selectedCode"
          :reveal="reveal"
          @country-selected="handleGuess"
        />
      </section>

      <section class="flex h-full flex-col gap-6">
        <div class="panel p-6">
          <p class="text-xs uppercase tracking-[0.3em] text-ink/60">Target</p>
          <h2 class="mt-3 text-4xl text-ink">{{ promptLabel }}</h2>
          <p class="mt-3 text-base text-ink/70">
            Click the country that matches the prompt, then confirm your choice.
          </p>
        </div>

        <div class="panel flex flex-1 flex-col p-8 md:p-9">
          <p class="text-xs uppercase tracking-[0.3em] text-ink/60">Answer</p>
          <div class="mt-4 flex flex-col gap-6 md:flex-row md:items-stretch md:justify-between">
            <div class="md:w-1/2">
              <p class="text-xl text-ink md:text-2xl">{{ answerSummary }}</p>
              <p v-if="reveal" class="mt-2 text-sm text-ink/70 md:text-base">
                <span class="font-semibold text-ink">Capital:</span>
                <span class="font-semibold text-ink"> {{ targetCountry?.capital || 'Unknown' }}</span>
                <span class="text-ink/60">
                  · Region:
                  {{ targetCountry?.subregion || targetCountry?.region || 'Europe' }}
                </span>
              </p>
            </div>
            <div
              v-if="reveal"
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
