"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Check,
  KeyRound,
  Loader2,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import type {
  UserConfiguration,
  UserPolicy,
} from "@jellyfin/sdk/lib/generated-client";
import {
  useDeleteUser,
  useLibraries,
  useSetUserPassword,
  useUpdateUser,
  useUpdateUserPolicy,
  useUser,
} from "@/lib/jellyfin/admin-queries";
import { useCurrentUser } from "@/lib/auth/current-user";
import { Avatar } from "@/components/common/avatar";
import { cn } from "@/lib/utils";

const POLICY_GROUPS: { title: string; keys: string[] }[] = [
  {
    title: "administration",
    keys: ["IsAdministrator", "IsDisabled", "IsHidden"],
  },
  {
    title: "playbackPerms",
    keys: [
      "EnableMediaPlayback",
      "EnableAudioPlaybackTranscoding",
      "EnableVideoPlaybackTranscoding",
      "EnablePlaybackRemuxing",
      "EnableSyncTranscoding",
      "EnableMediaConversion",
      "ForceRemoteSourceTranscoding",
    ],
  },
  {
    title: "accessPerms",
    keys: [
      "EnableRemoteAccess",
      "EnableContentDownloading",
      "EnableContentDeletion",
      "EnableCollectionManagement",
      "EnableSubtitleManagement",
      "EnableLyricManagement",
      "EnableRemoteControlOfOtherUsers",
      "EnableSharedDeviceControl",
      "EnablePublicSharing",
      "EnableUserPreferenceAccess",
    ],
  },
  {
    title: "liveTvPerms",
    keys: ["EnableLiveTvAccess", "EnableLiveTvManagement"],
  },
];

const CONFIG_TOGGLES = [
  "PlayDefaultAudioTrack",
  "EnableNextEpisodeAutoPlay",
  "DisplayMissingEpisodes",
  "DisplayCollectionsView",
  "HidePlayedInLatest",
  "RememberAudioSelections",
  "RememberSubtitleSelections",
  "EnableLocalPassword",
];

const SYNCPLAY = ["CreateAndJoinGroups", "JoinGroups", "None"];
const SUBTITLE_MODES = ["Default", "Always", "OnlyForced", "Smart", "None"];

interface Draft {
  name: string;
  policy: UserPolicy;
  config: UserConfiguration;
}

export function UserDetailView({ userId }: { userId: string }) {
  const t = useTranslations("UserEdit");
  const router = useRouter();
  const me = useCurrentUser();
  const { data: user, isLoading } = useUser(userId);
  const libraries = useLibraries();
  const updateUser = useUpdateUser();
  const updatePolicy = useUpdateUserPolicy();
  const password = useSetUserPassword();
  const del = useDeleteUser();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [syncedId, setSyncedId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [newPw, setNewPw] = useState("");

  // Adopt the loaded user into an editable draft (once per user id).
  if (user?.Id && syncedId !== user.Id) {
    setSyncedId(user.Id);
    setDraft({
      name: user.Name ?? "",
      policy: { ...(user.Policy ?? {}) } as UserPolicy,
      config: { ...(user.Configuration ?? {}) } as UserConfiguration,
    });
  }

  if (isLoading || !draft || !user) {
    return (
      <div className="px-10 pt-8 pb-16">
        <div className="h-8 w-48 animate-pulse rounded bg-card/60" />
        <div className="mt-6 h-64 animate-pulse rounded-2xl bg-card/40" />
      </div>
    );
  }

  const isSelf = user.Id === me.userId;
  const saving = updateUser.isPending || updatePolicy.isPending;

  function patchPolicy(key: string, value: unknown) {
    setDraft((d) =>
      d ? { ...d, policy: { ...d.policy, [key]: value } as UserPolicy } : d,
    );
    setSaved(false);
  }
  function patchConfig(key: string, value: unknown) {
    setDraft((d) =>
      d
        ? { ...d, config: { ...d.config, [key]: value } as UserConfiguration }
        : d,
    );
    setSaved(false);
  }
  const pol = draft.policy as unknown as Record<string, unknown>;
  const cfg = draft.config as unknown as Record<string, unknown>;

  async function save() {
    if (!user) return;
    await Promise.all([
      updateUser.mutateAsync({
        id: userId,
        user: { ...user, Name: draft!.name, Configuration: draft!.config },
      }),
      updatePolicy.mutateAsync({ id: userId, policy: draft!.policy }),
    ]);
    setSaved(true);
  }

  function toggleFolder(id: string) {
    const set = new Set((draft!.policy.EnabledFolders ?? []) as string[]);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    patchPolicy("EnabledFolders", [...set]);
  }

  const libs = (libraries.data ?? []).filter((l) => l.ItemId);
  const enabledFolders = new Set(
    (draft.policy.EnabledFolders ?? []) as string[],
  );

  return (
    <div className="mx-auto max-w-[860px] px-8 pt-8 pb-24">
      {/* Header */}
      <div className="mb-7 flex flex-wrap items-center gap-4">
        <Link
          href="/admin"
          className="flex size-9 flex-none items-center justify-center rounded-lg bg-white/[0.06] text-muted transition-colors hover:bg-white/[0.12] hover:text-text"
          aria-label={t("back")}
        >
          <ArrowLeft className="size-5" />
        </Link>
        <Avatar
          userId={user.Id}
          imageTag={user.PrimaryImageTag}
          name={draft.name}
          size={48}
          className="rounded-xl"
        />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-extrabold tracking-tight">
            {draft.name}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {!isSelf && (
            <button
              type="button"
              onClick={() =>
                del.mutate(userId, { onSuccess: () => router.push("/admin") })
              }
              className="flex items-center gap-1.5 rounded-lg border border-border-strong px-3.5 py-2 text-[13px] font-bold text-danger-soft transition-colors hover:bg-danger-soft/10"
            >
              <Trash2 className="size-4" /> {t("delete")}
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-extrabold text-on-accent transition-[filter] hover:brightness-110 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : saved ? (
              <Check className="size-4" />
            ) : (
              <Save className="size-4" />
            )}
            {saved ? t("saved") : t("save")}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* Profile */}
        <Section title={t("profile")}>
          <TextField
            label={t("name")}
            value={draft.name}
            onChange={(v) => {
              setDraft((d) => (d ? { ...d, name: v } : d));
              setSaved(false);
            }}
          />
        </Section>

        {/* Password */}
        <Section title={t("password")}>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <TextField
                label={t("newPassword")}
                value={newPw}
                onChange={setNewPw}
                type="password"
              />
            </div>
            <button
              type="button"
              onClick={() =>
                password.mutate(
                  { id: userId, newPw },
                  { onSuccess: () => setNewPw("") },
                )
              }
              disabled={!newPw || password.isPending}
              className="flex h-11 items-center gap-1.5 rounded-[10px] bg-accent px-4 text-[13px] font-bold text-on-accent transition-[filter] hover:brightness-110 disabled:opacity-50"
            >
              <KeyRound className="size-4" /> {t("setPassword")}
            </button>
            <button
              type="button"
              onClick={() => password.mutate({ id: userId, reset: true })}
              disabled={password.isPending}
              className="flex h-11 items-center gap-1.5 rounded-[10px] border border-border-strong px-4 text-[13px] font-bold text-bright transition-colors hover:bg-white/[0.06] disabled:opacity-50"
            >
              <RotateCcw className="size-4" /> {t("resetPassword")}
            </button>
          </div>
          {password.isSuccess && (
            <p className="mt-2 text-[12.5px] font-semibold text-emerald-400">
              {t("passwordUpdated")}
            </p>
          )}
        </Section>

        {/* Permissions */}
        {POLICY_GROUPS.map((group) => (
          <Section key={group.title} title={t(group.title)}>
            <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
              {group.keys.map((key) => (
                <ToggleRow
                  key={key}
                  label={t(`perm_${key}`)}
                  on={Boolean(pol[key])}
                  onChange={(v) => patchPolicy(key, v)}
                />
              ))}
            </div>
          </Section>
        ))}

        {/* Limits */}
        <Section title={t("limits")}>
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField
              label={t("maxActiveSessions")}
              value={Number(pol.MaxActiveSessions ?? 0)}
              onChange={(v) => patchPolicy("MaxActiveSessions", v)}
              hint={t("zeroUnlimited")}
            />
            <NumberField
              label={t("loginAttempts")}
              value={Number(pol.LoginAttemptsBeforeLockout ?? -1)}
              onChange={(v) => patchPolicy("LoginAttemptsBeforeLockout", v)}
              hint={t("minusDefault")}
            />
            <NumberField
              label={t("bitrateLimit")}
              value={Number(pol.RemoteClientBitrateLimit ?? 0)}
              onChange={(v) => patchPolicy("RemoteClientBitrateLimit", v)}
              hint={t("zeroUnlimited")}
            />
          </div>
          <div className="mt-4 max-w-[280px]">
            <SelectField
              label={t("syncPlay")}
              value={String(pol.SyncPlayAccess ?? "CreateAndJoinGroups")}
              options={SYNCPLAY.map((v) => ({
                value: v,
                label: t(`sync_${v}`),
              }))}
              onChange={(v) => patchPolicy("SyncPlayAccess", v)}
            />
          </div>
        </Section>

        {/* Library access */}
        <Section title={t("libraryAccess")}>
          <ToggleRow
            label={t("allLibraries")}
            on={Boolean(pol.EnableAllFolders)}
            onChange={(v) => patchPolicy("EnableAllFolders", v)}
          />
          {!pol.EnableAllFolders && (
            <div className="mt-2 grid gap-x-8 gap-y-1 sm:grid-cols-2">
              {libs.map((lib) => (
                <ToggleRow
                  key={lib.ItemId}
                  label={lib.Name ?? lib.ItemId!}
                  on={enabledFolders.has(lib.ItemId!)}
                  onChange={() => toggleFolder(lib.ItemId!)}
                />
              ))}
            </div>
          )}
        </Section>

        {/* Preferences */}
        <Section title={t("preferences")}>
          <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
            {CONFIG_TOGGLES.map((key) => (
              <ToggleRow
                key={key}
                label={t(`cfg_${key}`)}
                on={Boolean(cfg[key])}
                onChange={(v) => patchConfig(key, v)}
              />
            ))}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <SelectField
              label={t("subtitleMode")}
              value={String(cfg.SubtitleMode ?? "Default")}
              options={SUBTITLE_MODES.map((v) => ({
                value: v,
                label: t(`subs_${v}`),
              }))}
              onChange={(v) => patchConfig("SubtitleMode", v)}
            />
            <TextField
              label={t("subtitleLang")}
              value={String(cfg.SubtitleLanguagePreference ?? "")}
              onChange={(v) => patchConfig("SubtitleLanguagePreference", v)}
              placeholder="eng, tur…"
            />
          </div>
        </Section>
      </div>
    </div>
  );
}

// ── Reusable form bits ───────────────────────────────────────────────

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h3 className="mb-4 text-[13px] font-extrabold tracking-[0.08em] text-accent">
        {title}
      </h3>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="flex items-center justify-between gap-4 py-2.5 text-left"
    >
      <span className="text-[13.5px] font-semibold">{label}</span>
      <span
        className={cn(
          "flex h-6 w-11 flex-none items-center rounded-full p-0.5 transition-colors",
          on ? "bg-accent" : "bg-white/15",
        )}
      >
        <span
          className={cn(
            "size-5 rounded-full bg-white transition-transform",
            on && "translate-x-5",
          )}
        />
      </span>
    </button>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className="h-11 rounded-[10px] border border-border-strong bg-white/[0.04] px-3.5 text-[14px] text-text outline-none focus:border-accent"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 rounded-[10px] border border-border-strong bg-white/[0.04] px-3.5 text-[14px] text-text outline-none focus:border-accent"
      />
      {hint && <span className="text-[11px] text-dim">{hint}</span>}
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-[10px] border border-border-strong bg-white/[0.04] px-3 text-[14px] text-text outline-none focus:border-accent"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-bg">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
