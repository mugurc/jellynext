import { SearchView } from "@/components/search/search-view";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return <SearchView initialQuery={q ?? ""} />;
}
