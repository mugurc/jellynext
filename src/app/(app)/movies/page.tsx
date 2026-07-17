import { getTranslations } from "next-intl/server";
import { LibraryView } from "@/components/library/library-view";

export default async function MoviesPage() {
  const t = await getTranslations("Nav");
  return (
    <LibraryView
      title={t("movies")}
      collectionType="movies"
      includeItemTypes="Movie"
    />
  );
}
