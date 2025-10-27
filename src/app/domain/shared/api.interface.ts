/**
 * API Response Interface
 *
 * Generic wrapper for API responses.
 * Use this for REST API endpoints to standardize response format.
 *
 * For pagination, see pagination.ts
 */

/**
 * API response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}
