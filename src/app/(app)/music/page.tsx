import { getTranslations } from "next-intl/server";
import { ComingSoon } from "@/components/common/coming-soon";

export default async function MusicPage() {
  const t = await getTranslations("Nav");
  return (
    <ComingSoon
      title={t("music")}
      note="Artists, albums, the album/artist detail views, and the now-playing bar arrive in step 4."
    />
  );
}
