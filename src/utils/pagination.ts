interface PaginationQuery {
  skip: number;
  take: number;
}

interface PaginationResult {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const paginate = (query: { page?: number; limit?: number }, page = 1, limit = 20): PaginationQuery => {
  const skip = (page - 1) * limit;
  return { skip, take: limit };
};

export const getPagination = (total: number, page: number, limit: number): PaginationResult => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
});
