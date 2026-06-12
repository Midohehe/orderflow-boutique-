const DEFAULT_PAGE_SIZE = 1000;

/** Paginate a Supabase select until all rows are fetched (bypasses 1000-row default cap). */
export async function fetchAllRows<T>(
  runQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await runQuery(from, from + pageSize - 1);
    if (error) throw error;
    const batch = data ?? [];
    if (batch.length === 0) break;
    all.push(...batch);
    if (batch.length < pageSize) break;
  }
  return all;
}
