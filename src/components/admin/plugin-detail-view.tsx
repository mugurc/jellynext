"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Loader2,
  Puzzle,
  Save,
  Trash2,
} from "lucide-react";
import {
  useConfigPages,
  usePluginConfig,
  usePluginEnable,
  usePlugins,
  useUninstallPlugin,
  useUpdatePluginConfig,
} from "@/lib/jellyfin/admin-queries";
import { useCurrentUser } from "@/lib/auth/current-user";
import { cn } from "@/lib/utils";

const norm = (s?: string | null) => (s ?? "").replace(/-/g, "").toLowerCase();
const isSecret = (key: string) => /pass|secret|token|api.?key|^key$/i.test(key);
const isSimple = (v: unknown) =>
  typeof v === "boolean" || typeof v === "string" || typeof v === "number";

export function PluginDetailView({ id }: { id: string }) {
  const t = useTranslations("PluginEdit");
  const router = useRouter();
  const me = useCurrentUser();
  const plugins = usePlugins();
  const config = usePluginConfig(id);
  const pages = useConfigPages();
  const toggle = usePluginEnable();
  const uninstall = useUninstallPlugin();
  const saveCfg = useUpdatePluginConfig();

  const plugin = (plugins.data ?? []).find((p) => norm(p.Id) === norm(id));

  const [vals, setVals] = useState<Record<string, unknown>>({});
  const [json, setJson] = useState<Record<string, string>>({});
  const [jsonErr, setJsonErr] = useState<Record<string, boolean>>({});
  const [syncedId, setSyncedId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (config.data && syncedId !== id) {
    setSyncedId(id);
    const s: Record<string, unknown> = {};
    const j: Record<string, string> = {};
    for (const [k, v] of Object.entries(config.data)) {
      if (isSimple(v)) s[k] = v;
      else j[k] = JSON.stringify(v, null, 2);
    }
    setVals(s);
    setJson(j);
    setJsonErr({});
  }

  const active = String(plugin?.Status) === "Active";
  const configKeys = config.data ? Object.keys(config.data) : [];
  const hasErr = Object.values(jsonErr).some(Boolean);

  const page = (pages.data ?? []).find((p) => norm(p.PluginId) === norm(id));
  const server = me.serverUrl.replace(/\/+$/, "");
  const dashUrl = page?.Name
    ? `${server}/web/#/dashboard/plugins/config?name=${encodeURIComponent(page.Name)}`
    : `${server}/web/#/dashboard/plugins`;

  function setVal(key: string, value: unknown) {
    setVals((v) => ({ ...v, [key]: value }));
    setSaved(false);
  }
  function setJsonVal(key: string, text: string) {
    setJson((j) => ({ ...j, [key]: text }));
    let bad = false;
    try {
      JSON.parse(text);
    } catch {
      bad = true;
    }
    setJsonErr((e) => ({ ...e, [key]: bad }));
    setSaved(false);
  }

  function save() {
    if (!config.data || hasErr) return;
    const cfg: Record<string, unknown> = {};
    for (const k of Object.keys(config.data)) {
      if (k in vals) cfg[k] = vals[k];
      else {
        try {
          cfg[k] = JSON.parse(json[k]);
        } catch {
          return;
        }
      }
    }
    saveCfg.mutate({ id, config: cfg }, { onSuccess: () => setSaved(true) });
  }

  return (
    <div className="mx-auto max-w-[820px] px-8 pt-8 pb-24">
      {/* Header */}
      <div className="mb-7 flex flex-wrap items-center gap-4">
        <Link
          href="/admin"
          className="flex size-9 flex-none items-center justify-center rounded-lg bg-white/[0.06] text-muted transition-colors hover:bg-white/[0.12] hover:text-text"
          aria-label={t("back")}
        >
          <ArrowLeft className="size-5" />
        </Link>
        <Puzzle className="size-6 flex-none text-accent" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-extrabold tracking-tight">
            {plugin?.Name ?? "—"}
          </h1>
          <div className="text-[12.5px] text-muted">
            {plugin?.Version} · {plugin?.Status}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={dashUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-border-strong px-3.5 py-2 text-[13px] font-bold text-bright transition-colors hover:bg-white/[0.06]"
          >
            <ExternalLink className="size-4" /> {t("openDashboard")}
          </a>
          {plugin?.Id && plugin.Version && (
            <button
              type="button"
              onClick={() =>
                toggle.mutate({
                  id: plugin.Id!,
                  version: plugin.Version!,
                  enable: !active,
                })
              }
              disabled={toggle.isPending}
              className="rounded-lg border border-border-strong px-3.5 py-2 text-[13px] font-bold text-bright transition-colors hover:bg-white/[0.06] disabled:opacity-50"
            >
              {active ? t("disable") : t("enable")}
            </button>
          )}
          {plugin?.CanUninstall && plugin.Id && (
            <button
              type="button"
              onClick={() =>
                uninstall.mutate(plugin.Id!, {
                  onSuccess: () => router.push("/admin"),
                })
              }
              className="flex items-center gap-1.5 rounded-lg border border-border-strong px-3.5 py-2 text-[13px] font-bold text-danger-soft transition-colors hover:bg-danger-soft/10"
            >
              <Trash2 className="size-4" /> {t("uninstall")}
            </button>
          )}
        </div>
      </div>

      {plugin?.Description && (
        <p className="mb-6 max-w-[640px] text-[13.5px] leading-relaxed text-para">
          {plugin.Description}
        </p>
      )}

      {/* Configuration */}
      <Section title={t("configuration")}>
        {config.isLoading ? (
          <div className="py-6 text-center text-[13px] text-muted">…</div>
        ) : config.isError || !configKeys.length ? (
          <p className="py-2 text-[13px] text-muted">{t("noConfig")}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {configKeys.map((key) => {
              const original = config.data![key];
              if (typeof original === "boolean") {
                return (
                  <ToggleRow
                    key={key}
                    label={key}
                    on={Boolean(vals[key])}
                    onChange={(v) => setVal(key, v)}
                  />
                );
              }
              if (typeof original === "number") {
                return (
                  <FieldRow key={key} label={key}>
                    <input
                      type="number"
                      value={Number(vals[key] ?? 0)}
                      onChange={(e) => setVal(key, Number(e.target.value))}
                      className="h-10 w-full rounded-lg border border-border-strong bg-white/[0.04] px-3 text-[13.5px] text-text outline-none focus:border-accent"
                    />
                  </FieldRow>
                );
              }
              if (typeof original === "string") {
                return (
                  <FieldRow key={key} label={key}>
                    <input
                      type={isSecret(key) ? "password" : "text"}
                      value={String(vals[key] ?? "")}
                      onChange={(e) => setVal(key, e.target.value)}
                      autoComplete="off"
                      className="h-10 w-full rounded-lg border border-border-strong bg-white/[0.04] px-3 text-[13.5px] text-text outline-none focus:border-accent"
                    />
                  </FieldRow>
                );
              }
              return (
                <FieldRow key={key} label={`${key} (JSON)`}>
                  <textarea
                    value={json[key] ?? ""}
                    onChange={(e) => setJsonVal(key, e.target.value)}
                    rows={Math.min(
                      14,
                      (json[key] ?? "").split("\n").length + 1,
                    )}
                    spellCheck={false}
                    className={cn(
                      "w-full rounded-lg border bg-white/[0.04] px-3 py-2 font-mono text-[12px] text-text outline-none focus:border-accent",
                      jsonErr[key]
                        ? "border-danger-soft"
                        : "border-border-strong",
                    )}
                  />
                  {jsonErr[key] && (
                    <span className="text-[11px] font-semibold text-danger-soft">
                      {t("invalidJson")}
                    </span>
                  )}
                </FieldRow>
              );
            })}

            <div className="mt-1 flex items-center gap-3">
              <button
                type="button"
                onClick={save}
                disabled={hasErr || saveCfg.isPending}
                className="flex items-center gap-1.5 rounded-[10px] bg-accent px-5 py-2.5 text-[13px] font-extrabold text-on-accent transition-[filter] hover:brightness-110 disabled:opacity-50"
              >
                {saveCfg.isPending ? (
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
        )}
      </Section>
    </div>
  );
}

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

function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[12px] font-semibold text-muted">
        {label}
      </span>
      {children}
    </label>
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
      className="flex items-center justify-between gap-4 text-left"
    >
      <span className="font-mono text-[12.5px] font-semibold">{label}</span>
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
