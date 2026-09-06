import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { RangeListItem } from '@poker-range-trainer/contracts'

import {
  bulkMutateRanges,
  deleteRange,
  duplicateRange,
  listRanges,
  restoreRange,
  setRangeArchived,
  setRangeFavorite,
} from '@/lib/api-client'

import { RangeLibrary } from './range-library'

vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-client')>()
  return {
    ...actual,
    listRanges: vi.fn(),
    setRangeFavorite: vi.fn(),
    setRangeArchived: vi.fn(),
    duplicateRange: vi.fn(),
    deleteRange: vi.fn(),
    restoreRange: vi.fn(),
    bulkMutateRanges: vi.fn(),
  }
})

const range: RangeListItem = {
  id: '7a7e6f3e-17be-4b69-a31b-1f902417c560',
  version: 2,
  name: 'BTN open',
  metadata: { gameType: 'cash', tableSize: 'sixMax', position: 'btn', actionType: 'threeBet' },
  displayOrder: 0,
  handCount: 2,
  comboCount: 10,
  rangePercentage: (10 / 1326) * 100,
  archived: false,
  favorite: false,
  updatedAt: '2026-01-02T03:04:05.000Z',
  deletedAt: null,
}
const second: RangeListItem = {
  ...range,
  id: '9f2cae71-d410-4fcf-8fb2-527964db0c2e',
  name: 'CO open',
  metadata: null,
  displayOrder: 1,
}

const response = (data: RangeListItem[] = [range]) => ({
  data,
  meta: { page: 1, pageSize: 20, totalItems: data.length, totalPages: data.length === 0 ? 0 : 1 },
})

const list = vi.mocked(listRanges)
const favorite = vi.mocked(setRangeFavorite)
const archived = vi.mocked(setRangeArchived)
const duplicate = vi.mocked(duplicateRange)
const remove = vi.mocked(deleteRange)
const restore = vi.mocked(restoreRange)
const bulk = vi.mocked(bulkMutateRanges)

describe('RangeLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    list.mockResolvedValue(response())
    favorite.mockResolvedValue({
      data: { ...range, favorite: true, hands: ['AA'], createdAt: range.updatedAt },
    })
    archived.mockResolvedValue({
      data: { ...range, archived: true, hands: ['AA'], createdAt: range.updatedAt },
    })
    duplicate.mockResolvedValue({
      data: { ...second, hands: ['AA'], createdAt: range.updatedAt },
    })
    remove.mockResolvedValue({ data: { id: range.id, version: 3, deletedAt: range.updatedAt } })
    restore.mockResolvedValue({
      data: { ...range, version: 4, hands: ['AA'], createdAt: range.updatedAt },
    })
    bulk.mockResolvedValue({ data: { action: 'archive', atomic: true, items: [range] } })
  })

  afterEach(cleanup)

  it('renders loading, empty, and retryable failure states without fabricated rows', async () => {
    let resolveList: (value: ReturnType<typeof response>) => void
    list.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveList = resolve
      }),
    )
    const { unmount } = render(<RangeLibrary />)
    expect(screen.getByText(/Loading your range library/i)).toBeInTheDocument()
    resolveList!(response([]))
    expect(await screen.findByText('Your library is empty')).toBeInTheDocument()
    unmount()

    list.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response([]))
    render(<RangeLibrary />)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The range library could not be updated.',
    )
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(list).toHaveBeenCalledTimes(3))
    expect(await screen.findByText('Your library is empty')).toBeInTheDocument()
  })

  it('labels scenario metadata with the domain vocabulary', async () => {
    render(<RangeLibrary />)
    expect(await screen.findByText('Cash · 6-max · BTN · 3-bet')).toBeInTheDocument()
  })

  it('applies server filters and sorts, pages, and clears filters', async () => {
    render(<RangeLibrary />)
    await screen.findByText('BTN open')
    const user = userEvent.setup()
    await user.type(screen.getByRole('textbox', { name: 'Search ranges' }), 'BTN')
    await user.click(screen.getByRole('button', { name: 'Apply' }))
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'BTN', page: 1 })),
    )
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort' }), 'updatedAt:desc')
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: 'updatedAt', direction: 'desc' }),
      ),
    )
    await user.selectOptions(screen.getByRole('combobox', { name: 'Position' }), 'CO')
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ position: 'co' })),
    )
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(
        expect.objectContaining({ archived: 'exclude', sort: 'displayOrder' }),
      ),
    )
    expect(list).toHaveBeenLastCalledWith(expect.not.objectContaining({ position: 'co' }))
  })

  it('runs each row action and provides session-local delete undo', async () => {
    render(<RangeLibrary />)
    await screen.findByText('BTN open')
    const user = userEvent.setup()
    expect(screen.getByRole('link', { name: 'Practice' })).toHaveAttribute(
      'href',
      `/app/practice?range=${range.id}`,
    )
    await user.click(screen.getByRole('button', { name: 'Favorite' }))
    await waitFor(() => expect(favorite).toHaveBeenCalledWith(range.id, 2, true))
    await user.click(screen.getByRole('button', { name: 'Archive' }))
    await waitFor(() => expect(archived).toHaveBeenCalledWith(range.id, 2, true))
    await user.click(screen.getByRole('button', { name: 'Duplicate' }))
    await waitFor(() => expect(duplicate).toHaveBeenCalledWith(range.id, { version: 2 }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(
      await screen.findByRole('button', { name: /Undo delete of BTN open/ }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Undo delete of BTN open/ }))
    await waitFor(() => expect(restore).toHaveBeenCalledWith(range.id, 3))
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Undo delete/ })).not.toBeInTheDocument(),
    )
  })

  it('uses atomic bulk actions, clears selection, and restores a bulk delete as one request', async () => {
    list.mockResolvedValue(response([range, second]))
    render(<RangeLibrary />)
    await screen.findByText('BTN open')
    const user = userEvent.setup()
    await user.click(screen.getByRole('checkbox', { name: 'Select BTN open' }))
    await user.click(screen.getByRole('button', { name: 'Archive selected' }))
    await waitFor(() =>
      expect(bulk).toHaveBeenCalledWith({
        action: 'archive',
        items: [{ id: range.id, version: 2 }],
      }),
    )
    expect(screen.getByText('0 selected')).toBeInTheDocument()

    bulk.mockResolvedValueOnce({
      data: {
        action: 'delete',
        atomic: true,
        items: [
          { id: range.id, version: 3, deletedAt: range.updatedAt },
          { id: second.id, version: 3, deletedAt: range.updatedAt },
        ],
      },
    })
    await user.click(screen.getByRole('checkbox', { name: 'Select page' }))
    expect(screen.getByText('2 selected')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete selected' }))
    await user.click(await screen.findByRole('button', { name: 'Undo delete of 2 ranges' }))
    await waitFor(() =>
      expect(bulk).toHaveBeenLastCalledWith({
        action: 'restore',
        items: [
          { id: range.id, version: 3 },
          { id: second.id, version: 3 },
        ],
      }),
    )
    expect(restore).not.toHaveBeenCalled()
  })
})
