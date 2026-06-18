export type PaginatedMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type Paginated<T> = {
  data: T[];
  meta: PaginatedMeta;
};

/** Build a paginated envelope. Out-of-range pages yield empty data with honest meta. */
export function paginate<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number,
): Paginated<T> {
  return {
    data,
    meta: {
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    },
  };
}

/** Prisma `skip` for a 1-based page. */
export function pageSkip(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}
