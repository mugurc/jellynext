"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Check, Loader2, Save } from "lucide-react";
import type {
  BrandingOptionsDto,
  ServerConfiguration,
} from "@jellyfin/sdk/lib/generated-client";
import {
  useBranding,
  useCountries,
  useCultures,
  useServerConfig,
  useUpdateBranding,
  useUpdateServerConfig,
} from "@/lib/jellyfin/admin-queries";
import { cn } from "@/lib/utils";

/** Editable dashboard settings: general server config, metadata, branding. */
export function SettingsTab() {
  return (
    <div className="flex flex-col gap-6">
      <GeneralCard />
      <MetadataCard />
      <BrandingCard />
    </div>
  );
}

// ── General server configuration ─────────────────────────────────────

function GeneralCard() {
  const t = useTranslations("Admin");
  const config = useServerConfig();
  const update = useUpdateServerConfig();
  const [draft, setDraft] = useState<ServerConfiguration | null>(null);
  const [syncedAt, setSyncedAt] = useState(0);
  const [saved, setSaved] = useState(false);

  if (config.data && syncedAt !== config.dataUpdatedAt) {
    setSyncedAt(config.dataUpdatedAt);
    setDraft(config.data);
  }
  if (!draft) return <CardSkeleton title={t("generalSettings")} />;

  const set = <K extends keyof ServerConfiguration>(
    key: K,
    value: ServerConfiguration[K],
  ) => {
    setSaved(false);
    setDraft({ ...draft, [key]: value });
  };
  const save = () => update.mutate(draft, { onSuccess: () => setSaved(true) });

  return (
    <Card
      title={t("generalSettings")}
      onSave={save}
      pending={update.isPending}
      saved={saved}
      t={t}
    >
      <TextRow
        label={t("serverName")}
        value={draft.ServerName ?? ""}
        onChange={(v) => set("ServerName", v)}
        placeholder="Jellyfin"
      />
      <NumberRow
        label={t("activityRetention")}
        desc={t("activityRetentionDesc")}
        value={draft.ActivityLogRetentionDays ?? 30}
        onChange={(v) => set("ActivityLogRetentionDays", v)}
      />
      <NumberRow
        label={t("minResume")}
        desc={t("minResumeDesc")}
        value={draft.MinResumePct ?? 5}
        onChange={(v) => set("MinResumePct", v)}
      />
      <NumberRow
        label={t("maxResume")}
        desc={t("maxResumeDesc")}
        value={draft.MaxResumePct ?? 90}
        onChange={(v) => set("MaxResumePct", v)}
      />
      <ToggleRow
        label={t("folderView")}
        desc={t("folderViewDesc")}
        on={!!draft.EnableFolderView}
        onChange={(v) => set("EnableFolderView", v)}
      />
      <ToggleRow
        label={t("groupMovies")}
        desc={t("groupMoviesDesc")}
        on={!!draft.EnableGroupingMoviesIntoCollections}
        onChange={(v) => set("EnableGroupingMoviesIntoCollections", v)}
      />
      <ToggleRow
        label={t("clientLogUpload")}
        desc={t("clientLogUploadDesc")}
        on={!!draft.AllowClientLogUpload}
        onChange={(v) => set("AllowClientLogUpload", v)}
        last
      />
    </Card>
  );
}

// ── Metadata language / country ──────────────────────────────────────

function MetadataCard() {
  const t = useTranslations("Admin");
  const config = useServerConfig();
  const update = useUpdateServerConfig();
  const cultures = useCultures();
  const countries = useCountries();
  const [draft, setDraft] = useState<ServerConfiguration | null>(null);
  const [syncedAt, setSyncedAt] = useState(0);
  const [saved, setSaved] = useState(false);

  if (config.data && syncedAt !== config.dataUpdatedAt) {
    setSyncedAt(config.dataUpdatedAt);
    setDraft(config.data);
  }
  if (!draft) return <CardSkeleton title={t("metadataSettings")} />;

  const save = () => update.mutate(draft, { onSuccess: () => setSaved(true) });

  return (
    <Card
      title={t("metadataSettings")}
      onSave={save}
      pending={update.isPending}
      saved={saved}
      t={t}
    >
      <SelectRow
        label={t("metadataLanguage")}
        desc={t("metadataLanguageDesc")}
        value={draft.PreferredMetadataLanguage ?? "en"}
        onChange={(v) => {
          setSaved(false);
          setDraft({ ...draft, PreferredMetadataLanguage: v });
        }}
        options={(cultures.data ?? []).map((c) => ({
          value: c.TwoLetterISOLanguageName ?? "",
          label: c.DisplayName ?? c.Name ?? "",
        }))}
      />
      <SelectRow
        label={t("metadataCountry")}
        desc={t("metadataCountryDesc")}
        value={draft.MetadataCountryCode ?? "US"}
        onChange={(v) => {
          setSaved(false);
          setDraft({ ...draft, MetadataCountryCode: v });
        }}
        options={(countries.data ?? [])
          .filter((c) => c.TwoLetterISORegionName)
          .map((c) => ({
            value: c.TwoLetterISORegionName ?? "",
            label: c.DisplayName ?? c.Name ?? "",
          }))}
        last
      />
    </Card>
  );
}

// ── Branding (login page) ────────────────────────────────────────────

function BrandingCard() {
  const t = useTranslations("Admin");
  const branding = useBranding();
  const update = useUpdateBranding();
  const [draft, setDraft] = useState<BrandingOptionsDto | null>(null);
  const [syncedAt, setSyncedAt] = useState(0);
  const [saved, setSaved] = useState(false);

  if (branding.data && syncedAt !== branding.dataUpdatedAt) {
    setSyncedAt(branding.dataUpdatedAt);
    setDraft(branding.data);
  }
  if (!draft) return <CardSkeleton title={t("brandingSettings")} />;

  const set = (patch: Partial<BrandingOptionsDto>) => {
    setSaved(false);
    setDraft({ ...draft, ...patch });
  };
  const save = () => update.mutate(draft, { onSuccess: () => setSaved(true) });

  return (
    <Card
      title={t("brandingSettings")}
      onSave={save}
      pending={update.isPending}
      saved={saved}
      t={t}
    >
      <TextareaRow
        label={t("loginDisclaimer")}
        desc={t("loginDisclaimerDesc")}
        value={draft.LoginDisclaimer ?? ""}
        onChange={(v) => set({ LoginDisclaimer: v })}
      />
      <TextareaRow
        label={t("customCss")}
        desc={t("customCssDesc")}
        value={draft.CustomCss ?? ""}
        onChange={(v) => set({ CustomCss: v })}
        mono
      />
      <ToggleRow
        label={t("splashscreen")}
        desc={t("splashscreenDesc")}
        on={!!draft.SplashscreenEnabled}
        onChange={(v) => set({ SplashscreenEnabled: v })}
        last
      />
    </Card>
  );
}

// ── Shared layout primitives ─────────────────────────────────────────

function Card({
  title,
  children,
  onSave,
  pending,
  saved,
  t,
}: {
  title: string;
  children: ReactNode;
  onSave: () => void;
  pending: boolean;
  saved: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border/70 px-5 py-3.5">
        <h3 className="text-[14px] font-extrabold">{title}</h3>
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[12.5px] font-extrabold text-on-accent transition-[filter] hover:brightness-110 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : saved ? (
            <Check className="size-3.5" />
          ) : (
            <Save className="size-3.5" />
          )}
          {saved ? t("saved") : t("save")}
        </button>
      </div>
      <div className="px-5">{children}</div>
    </div>
  );
}

function CardSkeleton({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface">
      <div className="border-b border-border/70 px-5 py-3.5 text-[14px] font-extrabold">
        {title}
      </div>
      <div className="flex items-center justify-center py-10 text-dim">
        <Loader2 className="size-5 animate-spin" />
      </div>
    </div>
  );
}

function RowShell({
  label,
  desc,
  children,
  last,
}: {
  label: string;
  desc?: string;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-5 py-4",
        !last && "border-b border-border/60",
      )}
    >
      <div className="flex-1">
        <div className="text-[14px] font-bold">{label}</div>
        {desc && (
          <div className="text-[12px] leading-snug text-muted">{desc}</div>
        )}
      </div>
      <div className="flex-none">{children}</div>
    </div>
  );
}

function TextRow({
  label,
  desc,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  desc?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <RowShell label={label} desc={desc}>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-56 rounded-lg border border-border-strong bg-white/[0.04] px-3 py-2 text-[13px] outline-none focus:border-accent"
      />
    </RowShell>
  );
}

function NumberRow({
  label,
  desc,
  value,
  onChange,
}: {
  label: string;
  desc?: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <RowShell label={label} desc={desc}>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 rounded-lg border border-border-strong bg-white/[0.04] px-3 py-2 text-[13px] outline-none focus:border-accent"
      />
    </RowShell>
  );
}

function SelectRow({
  label,
  desc,
  value,
  onChange,
  options,
  last,
}: {
  label: string;
  desc?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  last?: boolean;
}) {
  return (
    <RowShell label={label} desc={desc} last={last}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-56 rounded-lg border border-border-strong bg-white/[0.04] px-3 py-2 text-[13px] outline-none focus:border-accent"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </RowShell>
  );
}

function TextareaRow({
  label,
  desc,
  value,
  onChange,
  mono,
}: {
  label: string;
  desc?: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
}) {
  return (
    <div className="border-b border-border/60 py-4">
      <div className="mb-2">
        <div className="text-[14px] font-bold">{label}</div>
        {desc && <div className="text-[12px] text-muted">{desc}</div>}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={mono ? 5 : 2}
        className={cn(
          "w-full resize-y rounded-lg border border-border-strong bg-white/[0.04] px-3 py-2 text-[13px] outline-none focus:border-accent",
          mono && "font-mono text-[12px]",
        )}
      />
    </div>
  );
}

function ToggleRow({
  label,
  desc,
  on,
  onChange,
  last,
}: {
  label: string;
  desc?: string;
  on: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <RowShell label={label} desc={desc} last={last}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        className={cn(
          "flex h-6 w-11 items-center rounded-full p-0.5 transition-colors",
          on ? "bg-accent" : "bg-white/15",
        )}
      >
        <span
          className={cn(
            "size-5 rounded-full bg-white transition-transform",
            on && "translate-x-5",
          )}
        />
      </button>
    </RowShell>
  );
}
