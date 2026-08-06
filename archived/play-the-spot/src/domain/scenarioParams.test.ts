import { describe, expect, it } from 'vitest'
import { encodeScenarioParams, parseScenarioParams } from './scenarioParams'

describe('parseScenarioParams', () => {
  it('returns nothing when no parameter is usable', () => {
    expect(parseScenarioParams({})).toBeNull()
    expect(parseScenarioParams({ position: 'lojack', stack: 'deep' })).toBeNull()
  })

  it('reads every supported field', () => {
    expect(
      parseScenarioParams({
        position: 'bb',
        action: 'defend',
        vs: 'co',
        table: 'sixMax',
        stack: '40',
      }),
    ).toEqual({
      position: 'bb',
      actionType: 'defend',
      versusPosition: 'co',
      tableSize: 'sixMax',
      stackDepthBb: 40,
    })
  })

  it('drops values outside their vocabulary and keeps the rest', () => {
    expect(parseScenarioParams({ position: 'sb', action: 'snap', stack: '-5' })).toEqual({
      position: 'sb',
    })
  })

  it('takes the first value when a router repeats a parameter', () => {
    expect(parseScenarioParams({ position: ['btn', 'co'] })).toEqual({ position: 'btn' })
  })
})

describe('encodeScenarioParams', () => {
  it('round-trips through parseScenarioParams', () => {
    const metadata = {
      position: 'btn',
      actionType: 'open',
      tableSize: 'headsUp',
      stackDepthBb: 20,
    } as const

    expect(parseScenarioParams(encodeScenarioParams(metadata))).toEqual(metadata)
  })

  it('omits fields the metadata does not carry', () => {
    expect(encodeScenarioParams({ position: 'utg' })).toEqual({ position: 'utg' })
  })

  it('ignores metadata fields that do not describe a spot', () => {
    expect(encodeScenarioParams({ notes: 'from a coach', gameType: 'cash' })).toEqual({})
  })
})
