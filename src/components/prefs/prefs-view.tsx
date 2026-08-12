"use client";

import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Camera, Check, Loader2, Smartphone } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Avatar } from "@/components/common/avatar";
import { LanguageToggle } from "@/components/common/language-toggle";
import { useCurrentUser } from "@/lib/auth/current-user";
import { useMe, useUploadAvatar } from "@/lib/jellyfin/queries";
import {
  useAuthorizeQuickConnect,
  useQuickConnectEnabled,
} from "@/lib/jellyfin/admin-queries";
import {
  PREFS_DEFAULTS,
  usePrefs,
  type MaxQuality,
  type SubtitleSize,
} from "@/lib/prefs/store";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};
/** SSR-safe "are we hydrated on the client yet?" — avoids markup mismatch. */
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

const QUALITIES: MaxQuality[] = ["auto", "1080p", "720p", "480p"];
const SIZES: SubtitleSize[] = ["small", "medium", "large"];

export function PrefsView() {
  const t = useTranslations("Prefs");
  const user = useCurrentUser();
  const mounted = useMounted();
  const store = usePrefs();
  // Before hydration, render defaults so server and client markup match.
  const p = mounted ? store : { ...PREFS_DEFAULTS };

  return (
    <div className="animate-jn-fade mx-auto max-w-[840px] px-8 pt-9 pb-24">
      {/* Profile header */}
      <div className="mb-8 flex items-center gap-4">
        <AvatarUpload name={user.userName} />
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold tracking-tight">
            {t("title")}
          </h1>
          <div className="truncate text-[13.5px] text-muted">
            {user.userName} · {user.serverUrl.replace(/^https?:\/\//, "")}
          </div>
        </div>
      </div>

      {/* General */}
      <Section title={t("general")}>
        <Row label={t("language")} desc={t("languageDesc")}>
          <LanguageToggle />
        </Row>
        <Row label={t("autoplayNext")} desc={t("autoplayNextDesc")}>
          <Toggle
            on={p.autoplayNext}
            onChange={(v) => store.set("autoplayNext", v)}
          />
        </Row>
        <Row label={t("reduceMotion")} desc={t("reduceMotionDesc")} last>
          <Toggle
            on={p.reduceMotion}
            onChange={(v) => store.set("reduceMotion", v)}
          />
        </Row>
      </Section>

      {/* Playback */}
      <Section title={t("playback")}>
        <Row label={t("maxQuality")} desc={t("maxQualityDesc")}>
          <ValueChip
            value={p.maxQuality === "auto" ? t("qualityAuto") : p.maxQuality}
            onClick={() =>
              store.set("maxQuality", cycle(QUALITIES, p.maxQuality))
            }
          />
        </Row>
        <Row label={t("autoplayTrailers")} desc={t("autoplayTrailersDesc")}>
          <Toggle
            on={p.autoplayTrailers}
            onChange={(v) => store.set("autoplayTrailers", v)}
          />
        </Row>
        <Row label={t("skipIntros")} desc={t("skipIntrosDesc")} last>
          <Toggle
            on={p.skipIntros}
            onChange={(v) => store.set("skipIntros", v)}
          />
        </Row>
      </Section>

      {/* Subtitles & audio */}
      <Section title={t("subtitles")}>
        <Row label={t("subtitlesDefault")} desc={t("subtitlesDefaultDesc")}>
          <Toggle
            on={p.subtitlesDefault}
            onChange={(v) => store.set("subtitlesDefault", v)}
          />
        </Row>
        <Row label={t("subtitleSize")} desc={t("subtitleSizeDesc")}>
          <ValueChip
            value={t(`size_${p.subtitleSize}`)}
            onClick={() =>
              store.set("subtitleSize", cycle(SIZES, p.subtitleSize))
            }
          />
        </Row>
        <Row label={t("audioNormalize")} desc={t("audioNormalizeDesc")} last>
          <Toggle
            on={p.audioNormalize}
            onChange={(v) => store.set("audioNormalize", v)}
          />
        </Row>
      </Section>

      <QuickConnectSection />

      <SignOutButton />
    </div>
  );
}

function cycle<T>(options: readonly T[], current: T): T {
  const i = options.indexOf(current);
  return options[(i + 1) % options.length];
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-7">
      <h3 className="mb-2.5 text-[13px] font-extrabold tracking-[0.08em] text-accent">
        {title}
      </h3>
      <div className="rounded-2xl border border-border bg-surface px-5">
        {children}
      </div>
    </div>
  );
}

function Row({
  label,
  desc,
  children,
  last = false,
}: {
  label: string;
  desc: string;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-5 py-4",
        !last && "border-b border-border/70",
      )}
    >
      <div className="flex-1">
        <div className="text-[14.5px] font-bold">{label}</div>
        <div className="text-[12.5px] leading-snug text-muted">{desc}</div>
      </div>
      <div className="flex-none">{children}</div>
    </div>
  );
}

function Toggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        "flex h-7 w-12 flex-none items-center rounded-full p-0.5 transition-colors",
        on ? "bg-accent" : "bg-white/15",
      )}
    >
      <span
        className={cn(
          "size-6 rounded-full bg-white transition-transform",
          on && "translate-x-5",
        )}
      />
    </button>
  );
}

function ValueChip({ value, onClick }: { value: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg bg-white/[0.08] px-4 py-2 text-[13px] font-bold text-bright transition-colors hover:bg-white/[0.14]"
    >
      {value}
    </button>
  );
}

/** Clickable avatar tile — shows the user's image or initial; click to upload. */
function AvatarUpload({ name }: { name: string }) {
  const { userId } = useCurrentUser();
  const me = useMe();
  const upload = useUploadAvatar();
  const fileRef = useRef<HTMLInputElement>(null);
  const tag = me.data?.PrimaryImageTag;

  return (
    <button
      type="button"
      onClick={() => fileRef.current?.click()}
      disabled={upload.isPending}
      className="group relative flex size-15 flex-none overflow-hidden rounded-2xl"
      aria-label="Change avatar"
    >
      <Avatar
        userId={userId}
        imageTag={tag}
        name={name}
        size={60}
        className="rounded-2xl"
      />
      <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
        {upload.isPending ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <Camera className="size-5" />
        )}
      </span>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload.mutate(file);
          e.target.value = "";
        }}
      />
    </button>
  );
}

/** Approve a device that's signing in with a Quick Connect code. */
function QuickConnectSection() {
  const t = useTranslations("Prefs");
  const enabled = useQuickConnectEnabled();
  const authorize = useAuthorizeQuickConnect();
  const [code, setCode] = useState("");
  const [done, setDone] = useState(false);

  if (enabled.data !== true) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = code.replace(/\D/g, "");
    if (clean.length < 6) return;
    setDone(false);
    authorize.mutate(clean, {
      onSuccess: () => {
        setDone(true);
        setCode("");
      },
    });
  };

  return (
    <Section title={t("quickConnect")}>
      <div className="py-4">
        <div className="mb-3 flex items-start gap-3">
          <span className="mt-0.5 flex size-9 flex-none items-center justify-center rounded-lg bg-accent/15 text-accent">
            <Smartphone className="size-4.5" />
          </span>
          <p className="text-[12.5px] leading-snug text-muted">
            {t("quickConnectDesc")}
          </p>
        </div>
        <form onSubmit={submit} className="flex items-center gap-2.5">
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => {
              setDone(false);
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
            }}
            placeholder="000000"
            className="w-36 rounded-lg border border-border-strong bg-white/[0.05] px-3.5 py-2.5 text-center font-mono text-lg tracking-[0.3em] text-bright outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={code.replace(/\D/g, "").length < 6 || authorize.isPending}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-[13px] font-bold text-black transition-opacity disabled:opacity-40"
          >
            {authorize.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : done ? (
              <Check className="size-4" />
            ) : null}
            {done ? t("quickConnectDone") : t("quickConnectAuthorize")}
          </button>
        </form>
        {authorize.isError && (
          <p className="mt-2 text-[12px] text-danger-soft">
            {t("quickConnectError")}
          </p>
        )}
      </div>
    </Section>
  );
}
