import { z } from 'zod'

import {
  ACTION_TYPES,
  GAME_TYPES,
  POSITIONS,
  TABLE_SIZES,
} from '@poker-range-trainer/domain/types/range'

import { TOTAL_HOLDEM_COMBOS } from '@poker-range-trainer/domain/domain/rangeMath'

import { handCodeSchema, idSchema, successResponseSchema, timestampSchema } from './common.js'
import { paginatedResponseSchema, paginationQuerySchema } from './pagination.js'

const nameSchema = z.string().trim().min(1).max(120)
const notesSchema = z.string().trim().max(2_000)

export const scenarioMetadataSchema = z
  .object({
    gameType: z.enum(GAME_TYPES).optional(),
    tableSize: z.enum(TABLE_SIZES).optional(),
    // The persistence layer stores depth as NUMERIC(8, 2); do not silently
    // discard a legitimate shallow-stack value such as 12.5bb.
    stackDepthBb: z.number().min(0.01).max(10_000).multipleOf(0.01).optional(),
    position: z.enum(POSITIONS).optional(),
    versusPosition: z.enum(POSITIONS).optional(),
    actionType: z.enum(ACTION_TYPES).optional(),
    notes: notesSchema.optional(),
  })
  .strict()
  .refine((metadata) => Object.keys(metadata).length > 0, {
    message: 'Scenario metadata must contain at least one field.',
  })
export type ScenarioMetadata = z.infer<typeof scenarioMetadataSchema>

function rejectDuplicateHands(hands: string[], context: z.RefinementCtx): void {
  const seen = new Set<string>()
  hands.forEach((hand, index) => {
    if (seen.has(hand)) {
      context.addIssue({ code: 'custom', message: 'Hands must not contain duplicates.', path: [index] })
    }
    seen.add(hand)
  })
}

/** A canonical, non-empty range selection. Membership is server-authoritative after submission. */
export const rangeHandsSchema = z
  .array(handCodeSchema)
  .min(1)
  .max(169)
  .superRefine(rejectDuplicateHands)

export const rangeVersionSchema = z.number().int().min(1)
export type RangeVersion = z.infer<typeof rangeVersionSchema>
export const displayOrderSchema = z.number().int().nonnegative().max(1_000_000)

export const rangeCreateRequestSchema = z
  .object({
    name: nameSchema,
    hands: rangeHandsSchema,
    metadata: scenarioMetadataSchema.optional(),
  })
  .strict()
export type RangeCreateRequest = z.infer<typeof rangeCreateRequestSchema>

export const rangeUpdateRequestSchema = z
  .object({
    version: rangeVersionSchema,
    name: nameSchema.optional(),
    hands: rangeHandsSchema.optional(),
    metadata: scenarioMetadataSchema.nullable().optional(),
  })
  .strict()
  .superRefine((request, context) => {
    if (
      request.name === undefined &&
      request.hands === undefined &&
      request.metadata === undefined
    ) {
      context.addIssue({ code: 'custom', message: 'Provide at least one field to update.' })
    }
  })
export type RangeUpdateRequest = z.infer<typeof rangeUpdateRequestSchema>

export const rangeReadSchema = z
  .object({
    id: idSchema,
    version: rangeVersionSchema,
    name: nameSchema,
    hands: rangeHandsSchema,
    metadata: scenarioMetadataSchema.nullable(),
    displayOrder: displayOrderSchema,
    archived: z.boolean(),
    favorite: z.boolean(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    deletedAt: timestampSchema.nullable(),
  })
  .strict()
export type RangeRead = z.infer<typeof rangeReadSchema>

export const rangeCreateResponseSchema = successResponseSchema(rangeReadSchema)
export const rangeReadResponseSchema = successResponseSchema(rangeReadSchema)
export const rangeUpdateResponseSchema = successResponseSchema(rangeReadSchema)

export const rangeSortValues = [
  'displayOrder',
  'updatedAt',
  'createdAt',
  'name',
  'accuracy',
  'lastPracticedAt',
] as const
export const rangeSortSchema = z.enum(rangeSortValues)

const booleanQuerySchema = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((value) => value === true || value === 'true')

export const rangeListQuerySchema = paginationQuerySchema
  .extend({
    search: z.string().trim().min(1).max(100).optional(),
    gameType: z.enum(GAME_TYPES).optional(),
    tableSize: z.enum(TABLE_SIZES).optional(),
    position: z.enum(POSITIONS).optional(),
    versusPosition: z.enum(POSITIONS).optional(),
    actionType: z.enum(ACTION_TYPES).optional(),
    stackDepthBb: z.coerce.number().min(0.01).max(10_000).multipleOf(0.01).optional(),
    archived: z.enum(['exclude', 'include', 'only']).default('exclude'),
    favorite: booleanQuerySchema.optional(),
    sort: rangeSortSchema.default('displayOrder'),
    direction: z.enum(['asc', 'desc']).default('asc'),
  })
  .strict()
export type RangeListQuery = z.infer<typeof rangeListQuerySchema>

export const rangeListItemSchema = z
  .object({
    id: idSchema,
    version: rangeVersionSchema,
    name: nameSchema,
    metadata: scenarioMetadataSchema.nullable(),
    displayOrder: displayOrderSchema,
    handCount: z.number().int().min(1).max(169),
    comboCount: z.number().int().min(1).max(TOTAL_HOLDEM_COMBOS),
    rangePercentage: z.number().min(0).max(100),
    archived: z.boolean(),
    favorite: z.boolean(),
    updatedAt: timestampSchema,
    deletedAt: timestampSchema.nullable(),
  })
  .strict()
  .superRefine((range, context) => {
    const expectedPercentage = (range.comboCount / TOTAL_HOLDEM_COMBOS) * 100
    if (range.rangePercentage !== expectedPercentage) {
      context.addIssue({
        code: 'custom',
        message: 'rangePercentage must be computed from comboCount.',
        path: ['rangePercentage'],
      })
    }
  })
export type RangeListItem = z.infer<typeof rangeListItemSchema>

/**
 * A collection response cannot claim a different number of pages than its
 * totals imply, nor return more rows than the requested page can hold.
 */
export const rangeListResponseSchema = paginatedResponseSchema(rangeListItemSchema).superRefine(
  (response, context) => {
    if (response.data.length > response.meta.pageSize) {
      context.addIssue({
        code: 'custom',
        message: 'A page cannot contain more items than its page size.',
        path: ['data'],
      })
    }

    const expectedTotalPages = Math.ceil(response.meta.totalItems / response.meta.pageSize)
    if (response.meta.totalPages !== expectedTotalPages) {
      context.addIssue({
        code: 'custom',
        message: 'Pagination totalPages must match totalItems and pageSize.',
        path: ['meta', 'totalPages'],
      })
    }
  },
)

const versionedRangeMutationRequestSchema = z.object({ version: rangeVersionSchema }).strict()

export const rangeArchiveRequestSchema = versionedRangeMutationRequestSchema
  .extend({ archived: z.boolean() })
  .strict()
export const rangeFavoriteRequestSchema = versionedRangeMutationRequestSchema
  .extend({ favorite: z.boolean() })
  .strict()
export const rangeDeleteRequestSchema = versionedRangeMutationRequestSchema
export const rangeRestoreRequestSchema = versionedRangeMutationRequestSchema

/** Duplicate a range atomically; only the copied range's display name may be overridden. */
export const rangeDuplicateRequestSchema = versionedRangeMutationRequestSchema
  .extend({ name: nameSchema.optional() })
  .strict()
export type RangeDuplicateRequest = z.infer<typeof rangeDuplicateRequestSchema>

const bulkRangeMutationItemSchema = z
  .object({ id: idSchema, version: rangeVersionSchema })
  .strict()

const bulkRangeMutationItemsSchema = z
  .array(bulkRangeMutationItemSchema)
  .min(1)
  .max(100)
  .superRefine((items, context) => {
    const seen = new Set<string>()
    items.forEach((item, index) => {
      if (seen.has(item.id)) {
        context.addIssue({
          code: 'custom',
          message: 'A bulk mutation can include each range only once.',
          path: [index, 'id'],
        })
      }
      seen.add(item.id)
    })
  })

export const bulkRangeMutationActionValues = [
  'archive',
  'unarchive',
  'favorite',
  'unfavorite',
  'delete',
  'restore',
] as const
export const bulkRangeMutationActionSchema = z.enum(bulkRangeMutationActionValues)

/** The server applies every listed optimistic mutation or applies none of them. */
export const bulkRangeMutationRequestSchema = z
  .object({
    action: bulkRangeMutationActionSchema,
    items: bulkRangeMutationItemsSchema,
  })
  .strict()
export type BulkRangeMutationRequest = z.infer<typeof bulkRangeMutationRequestSchema>

export const rangeArchiveResponseSchema = successResponseSchema(rangeReadSchema)
export const rangeFavoriteResponseSchema = successResponseSchema(rangeReadSchema)
export const rangeRestoreResponseSchema = successResponseSchema(rangeReadSchema)
export const rangeDuplicateResponseSchema = successResponseSchema(rangeReadSchema)
export const rangeDeleteResponseSchema = successResponseSchema(
  z
    .object({
      id: idSchema,
      version: rangeVersionSchema,
      deletedAt: timestampSchema,
    })
    .strict(),
)

const bulkRangeDeletionSchema = z
  .object({
    id: idSchema,
    version: rangeVersionSchema,
    deletedAt: timestampSchema,
  })
  .strict()

const bulkRangeMutationResponseDataSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('archive'),
      atomic: z.literal(true),
      items: z.array(rangeListItemSchema).min(1).max(100),
    })
    .strict(),
  z
    .object({
      action: z.literal('unarchive'),
      atomic: z.literal(true),
      items: z.array(rangeListItemSchema).min(1).max(100),
    })
    .strict(),
  z
    .object({
      action: z.literal('favorite'),
      atomic: z.literal(true),
      items: z.array(rangeListItemSchema).min(1).max(100),
    })
    .strict(),
  z
    .object({
      action: z.literal('unfavorite'),
      atomic: z.literal(true),
      items: z.array(rangeListItemSchema).min(1).max(100),
    })
    .strict(),
  z
    .object({
      action: z.literal('restore'),
      atomic: z.literal(true),
      items: z.array(rangeListItemSchema).min(1).max(100),
    })
    .strict(),
  z
    .object({
      action: z.literal('delete'),
      atomic: z.literal(true),
      items: z.array(bulkRangeDeletionSchema).min(1).max(100),
    })
    .strict(),
])

export const bulkRangeMutationResponseSchema = successResponseSchema(bulkRangeMutationResponseDataSchema)
export type BulkRangeMutationResponse = z.infer<typeof bulkRangeMutationResponseSchema>
