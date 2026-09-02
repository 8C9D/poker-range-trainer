import { z } from 'zod'

/** Query parameters accepted by collection endpoints after HTTP query parsing. */
export const paginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()
export type PaginationQuery = z.infer<typeof paginationQuerySchema>

/** Cursor-independent collection metadata returned alongside every paginated result. */
export const paginationMetaSchema = z
  .object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(100),
    totalItems: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .strict()
export type PaginationMeta = z.infer<typeof paginationMetaSchema>

/** Build a consistent envelope for a paginated collection response. */
export function paginatedResponseSchema<Item extends z.ZodType>(itemSchema: Item) {
  return z
    .object({
      data: z.array(itemSchema),
      meta: paginationMetaSchema,
    })
    .strict()
}
