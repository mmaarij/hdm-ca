import { Schema as S } from "effect";

/**
 * Pagination parameters for list operations
 */
export const PaginationParams = S.Struct({
  page: S.Number.pipe(
    S.int(),
    S.filter((n) => n >= 1, { message: () => "Page must be >= 1" })
  ),
  limit: S.Number.pipe(
    S.int(),
    S.filter((n) => n >= 1 && n <= 100, {
      message: () => "Limit must be between 1 and 100",
    })
  ),
});

export type PaginationParams = S.Schema.Type<typeof PaginationParams>;

/**
 * Pagination metadata
 */
export const PaginationMeta = S.Struct({
  page: S.Number,
  limit: S.Number,
  totalItems: S.Number,
  totalPages: S.Number,
  hasNextPage: S.Boolean,
  hasPreviousPage: S.Boolean,
});

export type PaginationMeta = S.Schema.Type<typeof PaginationMeta>;

/**
 * Paginated response wrapper
 */
export const Paginated = <A, I, R>(itemSchema: S.Schema<A, I, R>) =>
  S.Struct({
    data: S.Array(itemSchema),
    meta: PaginationMeta,
  });

export type Paginated<T> = {
  readonly data: readonly T[];
  readonly meta: PaginationMeta;
};

/**
 * Create pagination metadata from params and total count
 */
export const createPaginationMeta = (
  params: PaginationParams,
  totalItems: number
): PaginationMeta => {
  const totalPages = Math.ceil(totalItems / params.limit);
  return {
    page: params.page,
    limit: params.limit,
    totalItems,
    totalPages,
    hasNextPage: params.page < totalPages,
    hasPreviousPage: params.page > 1,
  };
};

/**
 * Default pagination parameters
 */
export const DEFAULT_PAGINATION: PaginationParams = {
  page: 1,
  limit: 20,
};

/**
 * Calculate offset for SQL queries
 */
export const calculateOffset = (params: PaginationParams): number =>
  (params.page - 1) * params.limit;

/**
 * Validate and sanitize pagination params
 */
export const sanitizePaginationParams = (input: {
  page?: unknown;
  limit?: unknown;
}): PaginationParams => {
  const page = Math.max(1, Number(input.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(input.limit) || 20));
  return { page, limit };
};
