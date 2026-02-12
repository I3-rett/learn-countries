<script setup lang="ts">
import { computed, ref } from 'vue'
import ContinentMap from './components/ContinentMap.vue'
import { CONTINENTS, EUROPE_CONTINENT } from './data/continents'
import { useGameState } from './composables/useGameState'

const continents = CONTINENTS
const selectedContinentId = ref(continents[0]?.id ?? EUROPE_CONTINENT.id)
const continent = computed(
  () => continents.find((entry) => entry.id === selectedContinentId.value) ?? EUROPE_CONTINENT
)

const {
  actionDisabled,
  actionLabel,
  answerSummary,
  capitalPoints,
  capitalScore,
  capitalTotal,
  capitalsEnabled,
  errorMessage,
  failedCodesList,
  flagScore,
  flagTotal,
  flagsEnabled,
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
  selectedCountry,
  stage,
  statusLabel,
  targetCode,
  targetCountry,
  targetTitle,
  selectedCode,
} = useGameState({ continent })

const mapUiState = computed(() => ({
  actionLabel: actionLabel.value,
  actionDisabled: actionDisabled.value,
  actionHighlight: !actionDisabled.value && actionLabel.value === 'Confirm',
  statusLabel: statusLabel.value,
  flagsEnabled: flagsEnabled.value,
  capitalsEnabled: capitalsEnabled.value,
  score: {
    nameScore: nameScore.value,
    nameTotal: nameTotal.value,
    flagScore: flagScore.value,
    flagTotal: flagTotal.value,
    capitalScore: capitalScore.value,
    capitalTotal: capitalTotal.value,
    flagsEnabled: flagsEnabled.value,
    capitalsEnabled: capitalsEnabled.value,
  },
}))
</script>

<template>
  <div class="min-h-screen px-6 py-8 lg:px-10">
    <header class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
      <div class="max-w-2xl">
        <div class="flex flex-wrap gap-2">
          <button
            v-for="entry in continents"
            :key="entry.id"
            type="button"
            class="tag border border-transparent transition"
            :class="
              entry.id === continent.id
                ? 'border-ink/20 bg-ink text-white'
                : 'border-ink/15 bg-white text-ink/70 hover:border-ink/30'
            "
            @click="selectedContinentId = entry.id"
          >
            {{ entry.label }}
          </button>
        </div>
        <h1 class="mt-4 text-5xl text-ink md:text-6xl">Map Mentor</h1>
        <p class="mt-4 text-base text-ink/70 md:text-lg">
          Find the highlighted country by clicking its outline. Each round reveals the
          answer and a quick geography fact.
        </p>
      </div>
    </header>

    <main class="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-stretch">
      <section class="panel h-full p-5 md:p-6">
        <ContinentMap
          :target-code="targetCode"
          :selected-code="selectedCode"
          :reveal="reveal"
          :found-codes="foundCodesList"
          :partial-codes="partialCodesList"
          :failed-codes="failedCodesList"
          :capital-points="capitalPoints"
          :stage="stage"
          :available-codes="continent.codes"
          :quick-select-countries="continent.quickSelect"
          :map-view="continent.mapView"
          :ui-state="mapUiState"
          @update:flags-enabled="flagsEnabled = $event"
          @update:capitals-enabled="capitalsEnabled = $event"
          @country-selected="handleGuess"
          @confirm-action="handlePrimaryAction"
          @reset-game="resetGame"
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
                    {{ targetCountry?.subregion || targetCountry?.region || continent.label }}
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
