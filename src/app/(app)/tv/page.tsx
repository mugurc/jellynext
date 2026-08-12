import { getTranslations } from "next-intl/server";
import { LibraryView } from "@/components/library/library-view";

export default async function TvPage() {
  const t = await getTranslations("Nav");
  return (
    <LibraryView
      title={t("series")}
      collectionType="tvshows"
      includeItemTypes="Series"
    />
  );
}
