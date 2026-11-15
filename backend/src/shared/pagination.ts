import type { PaginationMeta } from '../types/domain.js';

export type PaginationLimitOption = '10' | '20' | '50' | 'all';

export function buildPaginationMeta(options: {
  page: number;
  limit: PaginationLimitOption;
  total: number;
}): PaginationMeta {
  const { page, limit, total } = options;
  const numericLimit = limit === 'all' ? Math.max(total, 1) : Number(limit);
  return {
    page: limit === 'all' ? 1 : page,
    limit: numericLimit,
    total,
    totalPages: Math.max(1, Math.ceil(total / numericLimit)),
  };
}

export function buildOffsetClause(page: number, limit: PaginationLimitOption): string {
  if (limit === 'all') {
    return '';
  }
  const size = Number(limit);
  return `OFFSET ${(page - 1) * size} ROWS FETCH NEXT ${size} ROWS ONLY`;
}
