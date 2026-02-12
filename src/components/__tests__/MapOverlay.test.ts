import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MapOverlay from '../MapOverlay.vue'

const baseProps = {
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

  it('emits toggle events for difficulty switches', async () => {
    const wrapper = mount(MapOverlay, { props: baseProps })
    const inputs = wrapper.findAll('input[type="checkbox"]')

    await inputs[0].setValue(true)
    await inputs[1].setValue(true)

    expect(wrapper.emitted('toggle-flags')).toBeTruthy()
    expect(wrapper.emitted('toggle-capitals')).toBeTruthy()
  })

  it('styles quick select buttons based on tone', () => {
    const wrapper = mount(MapOverlay, { props: baseProps })
    const monacoButton = wrapper.findAll('button').find((btn) => btn.text() === 'Monaco')

    expect(monacoButton).toBeTruthy()
    expect(monacoButton?.classes()).toContain('border-emerald-400/60')
  })
})
