import type {
  BulkRangeMutationRequest,
  RangeCreateRequest,
  RangeDuplicateRequest,
  RangeListQuery,
  RangeUpdateRequest,
} from '@poker-range-trainer/contracts'

import type { RangeRepository } from './repository.js'

/** Application boundary for authenticated range-library operations; routes are intentionally deferred. */
export class RangeService {
  constructor(private readonly repository: RangeRepository) {}

  create(userId: string, input: RangeCreateRequest) {
    return this.repository.create(userId, input)
  }
  list(userId: string, query: RangeListQuery) {
    return this.repository.list(userId, query)
  }
  get(userId: string, rangeId: string) {
    return this.repository.get(userId, rangeId)
  }
  update(userId: string, rangeId: string, input: RangeUpdateRequest) {
    return this.repository.update(userId, rangeId, input)
  }
  archive(userId: string, rangeId: string, version: number) {
    return this.repository.setArchived(userId, rangeId, version, true)
  }
  unarchive(userId: string, rangeId: string, version: number) {
    return this.repository.setArchived(userId, rangeId, version, false)
  }
  favorite(userId: string, rangeId: string, version: number) {
    return this.repository.setFavorite(userId, rangeId, version, true)
  }
  unfavorite(userId: string, rangeId: string, version: number) {
    return this.repository.setFavorite(userId, rangeId, version, false)
  }
  delete(userId: string, rangeId: string, version: number) {
    return this.repository.delete(userId, rangeId, version)
  }
  restore(userId: string, rangeId: string, version: number) {
    return this.repository.restore(userId, rangeId, version)
  }
  duplicate(userId: string, rangeId: string, input: RangeDuplicateRequest) {
    return this.repository.duplicate(userId, rangeId, input)
  }
  bulk(userId: string, input: BulkRangeMutationRequest) {
    return this.repository.bulk(userId, input)
  }
}
