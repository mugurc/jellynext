import { getTranslations } from "next-intl/server";
import { ComingSoon } from "@/components/common/coming-soon";

export default async function LivePage() {
  const t = await getTranslations("Nav");
  return (
    <ComingSoon
      title={t("live")}
      note="The EPG guide grid, channels, recordings, and timers arrive in step 4."
    />
  );
}
