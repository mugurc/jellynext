import { getTranslations } from "next-intl/server";
import { ComingSoon } from "@/components/common/coming-soon";

export default async function SearchPage() {
  const t = await getTranslations("Nav");
  return (
    <ComingSoon
      title={t("search")}
      note="Instant search with type filters, people row, and browse-by-genre arrives in step 4."
    />
  );
}
