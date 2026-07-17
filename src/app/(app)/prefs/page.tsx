import { SignOutButton } from "@/components/auth/sign-out-button";
import { ComingSoon } from "@/components/common/coming-soon";

export default function PrefsPage() {
  return (
    <div className="flex flex-col items-center gap-8 py-8">
      <ComingSoon
        title="Preferences"
        note="Playback, subtitles, audio, parental, and general preferences arrive in step 6."
      />
      <SignOutButton />
    </div>
  );
}
