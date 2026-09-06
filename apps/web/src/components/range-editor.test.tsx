import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { RangeRead } from '@poker-range-trainer/contracts'

import { ApiClientError, createRange, getRange, updateRange } from '@/lib/api-client'

import { RangeEditor } from './range-editor'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-client')>()
  return { ...actual, getRange: vi.fn(), updateRange: vi.fn(), createRange: vi.fn() }
})

const rangeId = '7a7e6f3e-17be-4b69-a31b-1f902417c560'
const loadedRange = {
  id: rangeId,
  version: 2,
  name: 'BTN open',
  hands: ['AA'],
  metadata: { gameType: 'cash', position: 'btn' },
  displayOrder: 0,
  archived: false,
  favorite: false,
  createdAt: '2026-01-02T03:04:05.000Z',
  updatedAt: '2026-01-02T03:04:05.000Z',
  deletedAt: null,
} satisfies RangeRead

const read = vi.mocked(getRange)
const update = vi.mocked(updateRange)
const create = vi.mocked(createRange)

function problem(status: number, code: 'CONFLICT' | 'NOT_FOUND') {
  return new ApiClientError('problem', code, {
    status,
    problem: {
      type: 'about:blank',
      title: code,
      status,
      instance: '/api/v1/ranges/id',
      requestId: '7a7e6f3e-17be-4b69-a31b-1f902417c560',
      code,
    },
  })
}

function selectHand(hand = 'AA') {
  const cell = screen.getByRole('button', { name: hand, pressed: false })
  fireEvent.pointerDown(cell, { clientX: 1, clientY: 1, pointerId: 1 })
  fireEvent.pointerUp(cell.parentElement!, { pointerId: 1 })
}

describe('RangeEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    HTMLElement.prototype.setPointerCapture = vi.fn()
    read.mockResolvedValue({ data: loadedRange })
    update.mockResolvedValue({ data: loadedRange })
    create.mockResolvedValue({ data: loadedRange })
  })

  afterEach(cleanup)

  it('prevents an empty create, then creates with the selected hands and navigates to the range', async () => {
    render(<RangeEditor />)
    expect(screen.getByRole('button', { name: 'Create range' })).toBeDisabled()
    expect(screen.queryByRole('link', { name: 'Practice this range' })).not.toBeInTheDocument()
    selectHand()
    expect(screen.getByRole('button', { name: 'AA', pressed: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create range' })).toBeEnabled()
    const user = userEvent.setup()
    await user.type(screen.getByRole('textbox', { name: 'Range name' }), '  BTN open ')
    await user.click(screen.getByRole('button', { name: 'Create range' }))
    await waitFor(() => expect(create).toHaveBeenCalledWith({ name: 'BTN open', hands: ['AA'] }))
    expect(push).toHaveBeenCalledWith(`/app/library/${rangeId}`)
  })

  it('offers the domain scenario vocabulary as labelled options', () => {
    render(<RangeEditor />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include context' }))
    expect(screen.getByRole('option', { name: 'Sit & Go' })).toHaveValue('sitAndGo')
    expect(screen.getByRole('option', { name: '3-bet' })).toHaveValue('threeBet')
    expect(screen.getAllByRole('option', { name: 'BTN' })).toHaveLength(2)
  })

  it('loads an edit, clears whole metadata explicitly, and submits the loaded version', async () => {
    render(<RangeEditor rangeId={rangeId} />)
    expect(await screen.findByDisplayValue('BTN open')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Practice this range' })).toHaveAttribute(
      'href',
      `/app/practice?range=${rangeId}`,
    )
    expect(screen.getByRole('combobox', { name: 'Game' })).toHaveValue('cash')
    const user = userEvent.setup()
    await user.click(screen.getByRole('checkbox', { name: 'Include context' }))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        rangeId,
        expect.objectContaining({ version: 2, metadata: null }),
      ),
    )
  })

  it('preserves edits after a conflict and lets the user review the current saved range', async () => {
    update.mockRejectedValueOnce(problem(409, 'CONFLICT'))
    render(<RangeEditor rangeId={rangeId} />)
    const input = await screen.findByDisplayValue('BTN open')
    const user = userEvent.setup()
    await user.clear(input)
    await user.type(input, 'Changed locally')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Your unsaved edits are still here.')
    expect(screen.getByDisplayValue('Changed locally')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reload current saved range' }))
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
    expect(await screen.findByDisplayValue('BTN open')).toBeInTheDocument()
  })

  it('handles a missing edited range without attempting an overwrite', async () => {
    read.mockRejectedValueOnce(problem(404, 'NOT_FOUND'))
    render(<RangeEditor rangeId={rangeId} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Range not found')
    expect(update).not.toHaveBeenCalled()
  })
})
