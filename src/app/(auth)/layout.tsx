import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { LanguageToggle } from "@/components/common/language-toggle";
import { getSession } from "@/lib/jellyfin/session";

export default async function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSession();
  if (session) redirect("/home");

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 85% -20%, #12384a, transparent 55%), radial-gradient(110% 90% at -10% 120%, #0e2a3a, transparent 55%), var(--login-bg)",
        }}
      />
      <LanguageToggle className="absolute top-7 right-8 z-10 !bg-white/[0.07]" />
      <div className="relative z-[1] w-full">{children}</div>
    </div>
  );
}
