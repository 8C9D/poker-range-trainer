import { describe, expect, it, vi } from 'vitest'

import { RangeVersionConflictError, type RangeRepository } from './repository.js'
import { RangeService } from './service.js'

describe('RangeService', () => {
  it('keeps authenticated owner and optimistic version at the application boundary', async () => {
    const repository = {
      setArchived: vi.fn().mockResolvedValue({ id: 'range-id', archived: true }),
      update: vi.fn().mockRejectedValue(new RangeVersionConflictError()),
    } as unknown as RangeRepository
    const service = new RangeService(repository)

    await expect(service.archive('owner-id', 'range-id', 7)).resolves.toMatchObject({
      archived: true,
    })
    await expect(
      service.update('owner-id', 'range-id', { version: 6, name: 'New name' }),
    ).rejects.toBeInstanceOf(RangeVersionConflictError)

    expect(repository.setArchived).toHaveBeenCalledWith('owner-id', 'range-id', 7, true)
    expect(repository.update).toHaveBeenCalledWith('owner-id', 'range-id', {
      version: 6,
      name: 'New name',
    })
  })
})
