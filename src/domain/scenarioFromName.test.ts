import { describe, it, expect } from 'vitest'
import {
  describeScenario,
  inferScenarioFromName,
  scenarioSuggestionFor,
} from './scenarioFromName'

describe('inferScenarioFromName', () => {
  it('reads a seat and an action', () => {
    expect(inferScenarioFromName('UTG open')).toEqual({ position: 'utg', actionType: 'open' })
  })

  it('reads the opponent from the "vs"', () => {
    expect(inferScenarioFromName('SB 3-bet vs BTN')).toEqual({
      position: 'sb',
      actionType: 'threeBet',
      versusPosition: 'btn',
    })
  })

  it('reads the table size and stack depth in parentheses', () => {
    expect(inferScenarioFromName('BTN open (6-max 100bb)')).toEqual({
      position: 'btn',
      actionType: 'open',
      tableSize: 'sixMax',
      stackDepthBb: 100,
    })
  })

  it('takes hero’s action from hero’s side of the "vs"', () => {
    // Two actions are named; "defend" is hero's and "open" is the villain's.
    expect(inferScenarioFromName('BB defend vs CO open')).toMatchObject({
      position: 'bb',
      actionType: 'defend',
      versusPosition: 'co',
    })
  })

  it('never reads a stack depth as the big blind', () => {
    expect(inferScenarioFromName('CO open 100bb')).toEqual({
      position: 'co',
      actionType: 'open',
      stackDepthBb: 100,
    })
  })

  it('reads a fractional stack depth', () => {
    expect(inferScenarioFromName('BTN jam 12.5bb')).toMatchObject({ stackDepthBb: 12.5 })
  })

  it('reads the shorthand and long spellings of a seat', () => {
    expect(inferScenarioFromName('button open')).toMatchObject({ position: 'btn' })
    expect(inferScenarioFromName('Cutoff RFI')).toEqual({ position: 'co', actionType: 'open' })
    expect(inferScenarioFromName('Hijack open')).toMatchObject({ position: 'hj' })
    expect(inferScenarioFromName('UTG+1 open')).toMatchObject({ position: 'utg' })
  })

  it('reads a call of a jam as its own action, not a call and a jam', () => {
    expect(inferScenarioFromName('BB call jam vs SB')).toMatchObject({
      position: 'bb',
      actionType: 'callJam',
      versusPosition: 'sb',
    })
  })

  it('reads the numbered raises in their shorthand spellings', () => {
    expect(inferScenarioFromName('CO 3bet vs UTG')).toMatchObject({ actionType: 'threeBet' })
    expect(inferScenarioFromName('UTG 4-bet vs BTN')).toMatchObject({ actionType: 'fourBet' })
    expect(inferScenarioFromName('BTN 4b vs SB')).toMatchObject({ actionType: 'fourBet' })
  })

  it('reads the heads-up and 9-max table sizes', () => {
    expect(inferScenarioFromName('SB open (HU 40bb)')).toMatchObject({ tableSize: 'headsUp' })
    expect(inferScenarioFromName('UTG open full ring')).toMatchObject({ tableSize: 'nineMax' })
  })

  it('leaves hero’s action unset when only the villain’s is named', () => {
    expect(inferScenarioFromName('BB vs BTN open')).toEqual({
      position: 'bb',
      versusPosition: 'btn',
    })
  })

  it('ignores an opponent that reads as hero’s own seat', () => {
    expect(inferScenarioFromName('BTN 3-bet vs BTN')).toEqual({
      position: 'btn',
      actionType: 'threeBet',
    })
  })

  it('says nothing about a name with no scenario in it', () => {
    expect(inferScenarioFromName('My favourite chart')).toEqual({})
    expect(inferScenarioFromName('')).toEqual({})
  })
})

describe('scenarioSuggestionFor', () => {
  it('offers only the fields the range has not recorded', () => {
    expect(
      scenarioSuggestionFor('SB 3-bet vs BTN (6-max 100bb)', { position: 'sb', tableSize: 'sixMax' }),
    ).toEqual({ actionType: 'threeBet', versusPosition: 'btn', stackDepthBb: 100 })
  })

  it('never contradicts a value the user set', () => {
    // The name says BTN; the range says CO. The range wins, and BTN is not offered.
    expect(scenarioSuggestionFor('BTN open', { position: 'co', actionType: 'open' })).toBeNull()
  })

  it('offers everything when the range has no metadata at all', () => {
    expect(scenarioSuggestionFor('UTG open', undefined)).toEqual({
      position: 'utg',
      actionType: 'open',
    })
  })

  it('offers nothing for a name it cannot read', () => {
    expect(scenarioSuggestionFor('Untitled', undefined)).toBeNull()
  })

  it('treats a recorded stack depth of 0 as already set', () => {
    // 0 is falsy but stored, so a naive check would offer to overwrite it.
    expect(scenarioSuggestionFor('UTG open 100bb', { stackDepthBb: 0 })).toEqual({
      position: 'utg',
      actionType: 'open',
    })
  })
})

describe('describeScenario', () => {
  it('reads the scenario back in the app’s own words', () => {
    expect(describeScenario(inferScenarioFromName('SB 3-bet vs BTN open (6-max 100bb)'))).toBe(
      'SB · 3-bet · vs BTN · 6-max · 100bb',
    )
  })

  it('names only what it was given', () => {
    expect(describeScenario({ actionType: 'open' })).toBe('Open')
    expect(describeScenario({})).toBe('')
  })
})
