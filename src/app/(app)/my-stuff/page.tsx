import { getTranslations } from "next-intl/server";
import { ComingSoon } from "@/components/common/coming-soon";

export default async function MyStuffPage() {
  const t = await getTranslations("Nav");
  return (
    <ComingSoon
      title={t("mystuff")}
      note="Watchlist, Favorites, Downloads, Collections, and Playlists arrive in step 4."
    />
  );
}
