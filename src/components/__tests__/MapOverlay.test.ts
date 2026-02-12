import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MapOverlay from '../MapOverlay.vue'

const baseProps: {
  quickSelectItems: Array<{
    code: string
    name: string
    disabled: boolean
    tone: 'default' | 'found' | 'partial' | 'failed'
  }>
  uiState: {
    actionLabel: string
    actionDisabled: boolean
    actionHighlight: boolean
    statusLabel: string
    flagsEnabled: boolean
    capitalsEnabled: boolean
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
} = {
  quickSelectItems: [
    { code: 'VA', name: 'Vatican City', disabled: false, tone: 'default' },
    { code: 'MC', name: 'Monaco', disabled: true, tone: 'found' },
  ],
  uiState: {
    actionLabel: 'Confirm',
    actionDisabled: true,
    actionHighlight: false,
    statusLabel: 'Make your pick',
    flagsEnabled: false,
    capitalsEnabled: false,
    score: {
      nameScore: 1,
      nameTotal: 5,
      flagScore: 0,
      flagTotal: 2,
      capitalScore: 0,
      capitalTotal: 1,
      flagsEnabled: false,
      capitalsEnabled: false,
    },
  },
}

describe('MapOverlay', () => {
  it('uses status label when action is disabled', () => {
    const wrapper = mount(MapOverlay, { props: baseProps })
    const actionButton = wrapper.find('button')
    expect(actionButton.text()).toBe('Make your pick')
  })

  it('emits action when enabled', async () => {
    const wrapper = mount(MapOverlay, {
      props: {
        ...baseProps,
        uiState: {
          ...baseProps.uiState,
          actionDisabled: false,
          actionLabel: 'Confirm',
        },
      },
    })

    const actionButton = wrapper.find('button')
    await actionButton.trigger('click')

    expect(wrapper.emitted('action')).toBeTruthy()
  })

  it('emits toggle events for difficulty switches', async () => {
    const wrapper = mount(MapOverlay, { props: baseProps })
    const inputs = wrapper.findAll('input[type="checkbox"]')

    expect(inputs.length).toBe(2)

    await inputs[0]!.setValue(true)
    await inputs[1]!.setValue(true)

    expect(wrapper.emitted('toggle-flags')).toBeTruthy()
    expect(wrapper.emitted('toggle-capitals')).toBeTruthy()
  })

  it('emits reset when the new game button is clicked', async () => {
    const wrapper = mount(MapOverlay, { props: baseProps })
    const buttons = wrapper.findAll('button')
    const resetButton = buttons.find((btn) => btn.text() === 'New Game')

    expect(resetButton).toBeTruthy()
    await resetButton?.trigger('click')

    expect(wrapper.emitted('reset')).toBeTruthy()
  })

  it('ignores quick select when disabled', async () => {
    const wrapper = mount(MapOverlay, { props: baseProps })
    const monacoButton = wrapper.findAll('button').find((btn) => btn.text() === 'Monaco')

    expect(monacoButton).toBeTruthy()
    await monacoButton?.trigger('click')

    expect(wrapper.emitted('quick-select')).toBeFalsy()
  })

  it('renders flags and capitals scores when enabled', () => {
    const wrapper = mount(MapOverlay, {
      props: {
        ...baseProps,
        uiState: {
          ...baseProps.uiState,
          score: {
            ...baseProps.uiState.score,
            flagsEnabled: true,
            capitalsEnabled: true,
          },
        },
      },
    })

    const text = wrapper.text()
    expect(text).toContain('Flags:')
    expect(text).toContain('Capitals:')
  })

  it('styles quick select buttons based on tone', () => {
    const wrapper = mount(MapOverlay, { props: baseProps })
    const monacoButton = wrapper.findAll('button').find((btn) => btn.text() === 'Monaco')

    expect(monacoButton).toBeTruthy()
    expect(monacoButton?.classes()).toContain('border-emerald-400/60')
  })
})
