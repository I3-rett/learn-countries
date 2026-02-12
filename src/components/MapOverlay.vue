<script setup lang="ts">
import { computed } from 'vue'

type QuickSelectTone = 'default' | 'found' | 'partial' | 'failed'

type QuickSelectItem = {
  code: string
  name: string
  disabled: boolean
  tone: QuickSelectTone
}

type ScoreSnapshot = {
  nameScore: number
  nameTotal: number
  flagScore: number
  flagTotal: number
  capitalScore: number
  capitalTotal: number
  flagsEnabled: boolean
  capitalsEnabled: boolean
}

type Props = {
  quickSelectItems: QuickSelectItem[]
  uiState: {
    actionLabel: string
    actionDisabled: boolean
    actionHighlight: boolean
    statusLabel: string
    score: ScoreSnapshot
    flagsEnabled: boolean
    capitalsEnabled: boolean
  }
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (event: 'quick-select', code: string): void
  (event: 'toggle-flags', value: boolean): void
  (event: 'toggle-capitals', value: boolean): void
  (event: 'action'): void
  (event: 'reset'): void
}>()

const actionButtonLabel = computed(() =>
  props.uiState.actionDisabled ? props.uiState.statusLabel : props.uiState.actionLabel
)

const quickSelectButtonClass = (item: QuickSelectItem) => {
  if (item.tone === 'found') {
    return 'border-emerald-400/60 bg-emerald-100 text-emerald-900'
  }

  if (item.tone === 'partial') {
    return 'border-orange-400/60 bg-orange-100 text-orange-900'
  }

  if (item.tone === 'failed') {
    return 'border-red-400/60 bg-red-100 text-red-900'
  }

  return item.disabled
    ? 'cursor-not-allowed bg-ink/5 text-ink/40'
    : 'bg-white hover:border-ink/30 hover:bg-ink/5'
}

const handleAction = () => {
  if (props.uiState.actionDisabled) {
    return
  }

  emit('action')
}

const handleQuickSelect = (code: string, disabled: boolean) => {
  if (disabled) {
    return
  }

  emit('quick-select', code)
}

const handleFlagsToggle = (event: Event) => {
  const target = event.target as HTMLInputElement | null
  if (!target) {
    return
  }

  emit('toggle-flags', target.checked)
}

const handleCapitalsToggle = (event: Event) => {
  const target = event.target as HTMLInputElement | null
  if (!target) {
    return
  }

  emit('toggle-capitals', target.checked)
}

const handleReset = () => {
  emit('reset')
}
</script>

<template>
  <div class="absolute right-4 top-4 z-10 flex flex-col items-end gap-3">
    <button
      type="button"
      class="m-0 h-11 rounded-full border border-ink/10 px-6 text-sm font-semibold text-ink transition"
      :class="{
        'bg-ink text-white hover:bg-ink/90': !uiState.actionDisabled,
        'cursor-not-allowed bg-white text-ink/40': uiState.actionDisabled,
        'ring-2 ring-emerald-300/70': uiState.actionHighlight,
      }"
      :disabled="uiState.actionDisabled"
      @click="handleAction"
    >
      {{ actionButtonLabel }}
    </button>
    <div class="rounded-2xl border border-ink/10 bg-white/95 px-4 py-3 text-xs text-ink shadow-2xl backdrop-blur">
      <p class="text-[10px] font-semibold uppercase tracking-[0.28em] text-ink/70">Score</p>
      <p class="mt-2 font-semibold">Names: {{ uiState.score.nameScore }}/{{ uiState.score.nameTotal }}</p>
      <p v-if="uiState.score.flagsEnabled" class="font-semibold">
        Flags: {{ uiState.score.flagScore }}/{{ uiState.score.flagTotal }}
      </p>
      <p v-if="uiState.score.capitalsEnabled" class="font-semibold">
        Capitals: {{ uiState.score.capitalScore }}/{{ uiState.score.capitalTotal }}
      </p>
    </div>
  </div>

  <div class="absolute bottom-4 left-4 right-4 z-10 flex items-center justify-between gap-3">
    <div class="flex flex-wrap gap-3">
      <div class="self-end rounded-2xl bg-white/90 p-2 shadow-lg backdrop-blur">
        <div class="flex flex-wrap gap-2">
          <button
            v-for="item in quickSelectItems"
            :key="item.code"
            type="button"
            class="rounded-full border border-ink/10 px-3 py-1 text-xs font-semibold text-ink transition"
            :class="quickSelectButtonClass(item)"
            @click="handleQuickSelect(item.code, item.disabled)"
          >
            {{ item.name }}
          </button>
        </div>
      </div>
    </div>
  </div>

  <div class="absolute bottom-4 right-4 z-10 rounded-2xl bg-white/90 p-3 shadow-lg backdrop-blur">
    <p class="text-[10px] font-semibold uppercase tracking-[0.28em] text-ink/70">Difficulty</p>
    <div class="mt-2 flex flex-col gap-2">
      <label class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink/70">
        <input
          type="checkbox"
          class="h-4 w-4 rounded border-ink/30"
          :checked="uiState.flagsEnabled"
          @change="handleFlagsToggle"
        />
        Flags
      </label>
      <label class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink/70">
        <input
          type="checkbox"
          class="h-4 w-4 rounded border-ink/30"
          :checked="uiState.capitalsEnabled"
          @change="handleCapitalsToggle"
        />
        Capitals
      </label>
    </div>
    <button
      type="button"
      class="mt-3 w-full rounded-full border border-ink/15 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink/70 transition hover:border-ink/30 hover:text-ink"
      @click="handleReset"
    >
      New Game
    </button>
  </div>
</template>
