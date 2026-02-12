import { defineComponent, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGameState } from '../useGameState'
import type { CountryInfo } from '../../services/countryApi'

const mockCountries: Record<string, CountryInfo> = {
  FR: {
    code: 'FR',
    name: 'France',
    capital: 'Paris',
    capitalLatLng: { lat: 48.8566, lng: 2.3522 },
    flagUrl: 'https://example.com/fr.svg',
  },
}

vi.mock('../../services/countryApi', () => ({
  fetchEuropeCountries: vi.fn(async () => mockCountries),
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
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('updates score after a correct name guess', async () => {
    const wrapper = mount(createHarness())
    await flushPromises()

    const vm = wrapper.vm as unknown as ReturnType<typeof useGameState>
    const code = vm.targetCode
    expect(code).toBe('FR')

    vm.handleGuess(code as string)
    vm.handlePrimaryAction()

    expect(vm.nameScore).toBe(1)
    expect(vm.flagScore).toBe(0)
    expect(vm.capitalScore).toBe(0)
  })

  it('advances to a different stage when flags and capitals are enabled', async () => {
    const wrapper = mount(createHarness())
    await flushPromises()

    const vm = wrapper.vm as unknown as ReturnType<typeof useGameState>
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

  it('resets progress and state on new game', async () => {
    const wrapper = mount(createHarness())
    await flushPromises()

    const vm = wrapper.vm as unknown as ReturnType<typeof useGameState>
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

    const vm = wrapper.vm as unknown as ReturnType<typeof useGameState>
    expect(vm.flagsEnabled).toBe(true)
    expect(vm.capitalsEnabled).toBe(true)
  })
})
