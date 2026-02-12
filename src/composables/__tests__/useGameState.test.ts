import { defineComponent, nextTick, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGameState } from '../useGameState'
import type { CountryInfo } from '../../services/countryApi'
import { fetchCountries } from '../../services/countryApi'
import type { ContinentConfig } from '../../data/continents'

type GameState = ReturnType<typeof useGameState>
type GameStateVm = {
  [K in keyof GameState]: GameState[K] extends { value: infer V } ? V : GameState[K]
}

const mockCountries: Record<string, CountryInfo> = {
  FR: {
    code: 'FR',
    name: 'France',
    capital: 'Paris',
    capitalLatLng: { lat: 48.8566, lng: 2.3522 },
    flagUrl: 'https://example.com/fr.svg',
  },
  DE: {
    code: 'DE',
    name: 'Germany',
    capital: 'Berlin',
    capitalLatLng: { lat: 52.52, lng: 13.405 },
    flagUrl: 'https://example.com/de.svg',
  },
}

vi.mock('../../services/countryApi', () => ({
  fetchCountries: vi.fn(async () => mockCountries),
}))

const createHarness = () =>
  defineComponent({
    setup() {
      return useGameState()
    },
    template: '<div />',
  })


describe('useGameState', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    vi.mocked(fetchCountries).mockResolvedValue(mockCountries)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('updates score after a correct name guess', async () => {
    const wrapper = mount(createHarness())
    await flushPromises()

    const vm = wrapper.vm as unknown as GameStateVm
    const code = vm.targetCode
    expect(code).toBe('FR')

    vm.handleGuess(code as string)
    vm.handlePrimaryAction()

    expect(vm.nameScore).toBe(1)
    expect(vm.flagScore).toBe(0)
    expect(vm.capitalScore).toBe(0)
  })

  it('marks failed codes on incorrect guesses', async () => {
    const wrapper = mount(createHarness())
    await flushPromises()

    const vm = wrapper.vm as unknown as GameStateVm
    expect(vm.targetCode).toBe('FR')

    vm.handleGuess('DE')
    vm.handlePrimaryAction()

    expect(vm.isCorrect).toBe(false)
    expect(vm.reveal).toBe(true)
    expect(vm.failedCodesList).toContain('FR')
  })

  it('advances to a different stage when flags and capitals are enabled', async () => {
    const wrapper = mount(createHarness())
    await flushPromises()

    const vm = wrapper.vm as unknown as GameStateVm
    vm.flagsEnabled = true
    vm.capitalsEnabled = true
    await nextTick()

    const firstStage = vm.stage
    const code = vm.targetCode

    vm.handleGuess(code as string)
    vm.handlePrimaryAction()

    vm.handlePrimaryAction()
    await nextTick()

    expect(vm.stage).not.toBe(firstStage)
  })

  it('resets stage and selection when toggles disable the current stage', async () => {
    const wrapper = mount(createHarness())
    await flushPromises()

    const vm = wrapper.vm as unknown as GameStateVm
    vm.flagsEnabled = true
    vm.capitalsEnabled = true
    await nextTick()

    vm.stage = 'flag'
    vm.selectedCode = vm.targetCode as string
    vm.reveal = true
    vm.isCorrect = true

    vm.flagsEnabled = false
    vm.capitalsEnabled = false
    await nextTick()

    expect(vm.stage).toBe('name')
    expect(vm.selectedCode).toBe(null)
    expect(vm.reveal).toBe(false)
    expect(vm.isCorrect).toBe(null)
  })

  it('resets progress and state on new game', async () => {
    const wrapper = mount(createHarness())
    await flushPromises()

    const vm = wrapper.vm as unknown as GameStateVm
    const code = vm.targetCode

    vm.handleGuess(code as string)
    vm.handlePrimaryAction()
    expect(vm.nameScore).toBe(1)

    vm.resetGame()
    expect(vm.nameScore).toBe(0)
    expect(vm.failedCodesList.length).toBe(0)
    expect(vm.foundCodesList.length).toBe(0)
  })

  it('hydrates difficulty toggles from localStorage', async () => {
    localStorage.setItem(
      'learn-countries:settings',
      JSON.stringify({ flagsEnabled: true, capitalsEnabled: true })
    )

    const wrapper = mount(createHarness())
    await flushPromises()

    const vm = wrapper.vm as unknown as GameStateVm
    expect(vm.flagsEnabled).toBe(true)
    expect(vm.capitalsEnabled).toBe(true)
  })

  it('confirms guess on space key', async () => {
    const wrapper = mount(createHarness())
    await flushPromises()

    const vm = wrapper.vm as unknown as GameStateVm
    const code = vm.targetCode
    vm.handleGuess(code as string)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space' }))

    expect(vm.nameScore).toBe(1)
    expect(vm.reveal).toBe(true)
  })

  it('exposes a load error when country data fails', async () => {
    vi.mocked(fetchCountries).mockRejectedValueOnce(new Error('Boom'))

    const wrapper = mount(createHarness())
    await flushPromises()

    const vm = wrapper.vm as unknown as GameStateVm
    expect(vm.errorMessage).toBe('Boom')
    expect(vm.actionDisabled).toBe(true)
  })

  it('reloads data when the continent changes', async () => {
    const baseContinent: ContinentConfig = {
      id: 'europe',
      label: 'Europe',
      editionLabel: 'Europe Edition',
      codes: ['FR', 'DE'],
      quickSelect: [],
      mapView: { center: [0, 0], zoom: 2, minZoom: 1, maxZoom: 6 },
      cacheKey: 'test-europe-cache',
    }

    const nextContinent: ContinentConfig = {
      id: 'custom',
      label: 'Custom',
      editionLabel: 'Custom Edition',
      codes: ['DE'],
      quickSelect: [],
      mapView: { center: [5, 5], zoom: 3, minZoom: 1, maxZoom: 6 },
      cacheKey: 'test-custom-cache',
    }

    const wrapper = mount(
      defineComponent({
        setup() {
          const continent = ref(baseContinent)
          const state = useGameState({ continent })
          return { continent, ...state }
        },
        template: '<div />',
      })
    )

    await flushPromises()

    const vm = wrapper.vm as unknown as GameStateVm & { continent: ContinentConfig }
    expect(vm.targetCode).toBe('FR')
    expect(fetchCountries).toHaveBeenCalledWith(['FR', 'DE'], 'test-europe-cache')

    vm.continent = nextContinent
    await flushPromises()

    expect(fetchCountries).toHaveBeenCalledWith(['DE'], 'test-custom-cache')
    wrapper.unmount()
  })
})
