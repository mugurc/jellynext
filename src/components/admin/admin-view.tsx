"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Activity,
  AlertTriangle,
  Archive,
  Check,
  CheckCircle2,
  Clapperboard,
  Clock,
  Copy,
  Cpu,
  DownloadCloud,
  Film,
  FolderTree,
  HardDrive,
  Info,
  Key,
  ListChecks,
  Loader2,
  MessageSquare,
  MonitorSmartphone,
  Music2,
  Pause,
  Pencil,
  Play,
  Plus,
  Power,
  Puzzle,
  RefreshCw,
  RotateCw,
  Send,
  Server,
  SlidersHorizontal,
  Square,
  Trash2,
  Tv,
  Users,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type {
  ActivityLogEntry,
  DeviceInfoDto,
  PluginInfo,
  SessionInfoDto,
  SystemInfo,
  TaskInfo,
  TaskTriggerInfo,
  UserDto,
  VirtualFolderInfo,
} from "@jellyfin/sdk/lib/generated-client";
import {
  useActivityLog,
  useAddLibrary,
  useApiKeys,
  useBackups,
  useCreateApiKey,
  useCreateBackup,
  useCreateUser,
  useDeleteDevice,
  useDeleteUser,
  useDevices,
  useInstallPackage,
  useItemCounts,
  useLibraries,
  usePackageCatalog,
  usePluginEnable,
  usePlugins,
  useRemoveLibrary,
  useRenameDevice,
  useRevokeApiKey,
  useUninstallPlugin,
  useUpdateTaskTriggers,
  useRestartServer,
  useRunTask,
  useScanAllLibraries,
  useScheduledTasks,
  useServerUsers,
  useSessionCommand,
  useSessionMessage,
  useSessions,
  useShutdownServer,
  useSystemInfo,
  useTaskDetail,
} from "@/lib/jellyfin/admin-queries";
import { useCurrentUser } from "@/lib/auth/current-user";
import { FolderPicker } from "./folder-picker";
import { SettingsTab } from "./settings-tab";
import { Avatar } from "@/components/common/avatar";
import { Portal } from "@/components/common/portal";
import { useTimeAgo } from "@/lib/hooks/use-time-ago";
import { cn } from "@/lib/utils";

type Tab =
  | "overview"
  | "libraries"
  | "users"
  | "devices"
  | "tasks"
  | "activity"
  | "settings"
  | "system";

const TABS: { key: Tab; icon: LucideIcon }[] = [
  { key: "overview", icon: Server },
  { key: "libraries", icon: FolderTree },
  { key: "users", icon: Users },
  { key: "devices", icon: MonitorSmartphone },
  { key: "tasks", icon: ListChecks },
  { key: "activity", icon: Activity },
  { key: "settings", icon: SlidersHorizontal },
  { key: "system", icon: Cpu },
];

export function AdminView() {
  const t = useTranslations("Admin");
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="px-10 pt-8 pb-16">
      <div className="mb-6 flex items-center gap-3">
        <Server className="size-7 text-accent" />
        <h1 className="text-3xl font-extrabold tracking-tight">{t("title")}</h1>
      </div>

      <div className="no-scrollbar mb-7 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((x) => (
          <button
            key={x.key}
            type="button"
            onClick={() => setTab(x.key)}
            className={cn(
              "relative -mb-px flex flex-none items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors",
              tab === x.key ? "text-text" : "text-muted hover:text-bright",
            )}
          >
            <x.icon className="size-4" />
            {t(x.key)}
            {tab === x.key && (
              <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent" />
            )}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab />}
      {tab === "libraries" && <LibrariesTab />}
      {tab === "users" && <UsersTab />}
      {tab === "devices" && <DevicesTab />}
      {tab === "tasks" && <TasksTab />}
      {tab === "activity" && <ActivityTab />}
      {tab === "settings" && <SettingsTab />}
      {tab === "system" && <SystemTab />}
    </div>
  );
}

// ── Overview ─────────────────────────────────────────────────────────

function OverviewTab() {
  const t = useTranslations("Admin");
  const info = useSystemInfo();
  const counts = useItemCounts();
  const sessions = useSessions();
  const users = useServerUsers();
  const devices = useDevices();
  const plugins = usePlugins();
  const activity = useActivityLog(6);

  const c = counts.data;
  const active = (sessions.data ?? [])
    .filter((s) => s.UserName)
    .sort(
      (a, b) =>
        Date.parse(b.LastActivityDate ?? "") -
        Date.parse(a.LastActivityDate ?? ""),
    );

  const tiles: { icon: LucideIcon; label: string; value?: number }[] = [
    { icon: Film, label: t("movies"), value: c?.MovieCount },
    { icon: Tv, label: t("series"), value: c?.SeriesCount },
    { icon: Clapperboard, label: t("episodes"), value: c?.EpisodeCount },
    ...(c?.SongCount
      ? [{ icon: Music2, label: t("songs"), value: c.SongCount }]
      : []),
    { icon: Users, label: t("users"), value: users.data?.length },
    {
      icon: MonitorSmartphone,
      label: t("devices"),
      value: devices.data?.Items?.length,
    },
    { icon: Puzzle, label: t("plugins"), value: plugins.data?.length },
  ];

  return (
    <div className="flex flex-col gap-6">
      <ServerCard info={info.data} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((tile) => (
          <StatTile key={tile.label} {...tile} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card icon={Activity} title={t("activeSessions")}>
          {active.length ? (
            <div className="flex flex-col divide-y divide-border/60">
              {active.map((s) => (
                <SessionRow key={s.Id} session={s} />
              ))}
            </div>
          ) : (
            <Empty text={t("noSessions")} />
          )}
        </Card>

        <Card icon={Activity} title={t("recentActivity")}>
          {activity.data?.Items?.length ? (
            <div className="flex flex-col divide-y divide-border/60">
              {activity.data.Items.map((e) => (
                <ActivityRow key={e.Id} entry={e} />
              ))}
            </div>
          ) : (
            <Empty text={t("noActivity")} />
          )}
        </Card>
      </div>
    </div>
  );
}

function ServerCard({ info }: { info?: SystemInfo }) {
  const t = useTranslations("Admin");
  const status = info?.HasPendingRestart
    ? { label: t("restartPending"), tone: "warn" as const }
    : info?.HasUpdateAvailable
      ? { label: t("updateAvailable"), tone: "warn" as const }
      : { label: t("upToDate"), tone: "ok" as const };

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="text-2xl font-extrabold">{info?.ServerName ?? "—"}</div>
        <Pill tone={status.tone}>{status.label}</Pill>
      </div>
      <div className="grid gap-x-8 gap-y-3 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
        <InfoRow label={t("productName")} value={info?.ProductName} />
        <InfoRow label={t("version")} value={info?.Version} />
        <InfoRow
          label={t("os")}
          value={info?.OperatingSystemDisplayName ?? info?.OperatingSystem}
        />
        <InfoRow label={t("architecture")} value={info?.SystemArchitecture} />
        <InfoRow label={t("encoder")} value={info?.EncoderLocation} />
        <InfoRow label={t("address")} value={info?.LocalAddress} />
      </div>
    </div>
  );
}

// ── Libraries ────────────────────────────────────────────────────────

function LibrariesTab() {
  const t = useTranslations("Admin");
  const { data } = useLibraries();
  const remove = useRemoveLibrary();
  const [addOpen, setAddOpen] = useState(false);
  const libs = data ?? [];

  return (
    <>
      <TabHeader
        title={t("libraries")}
        action={t("addLibrary")}
        onAction={() => setAddOpen(true)}
      />
      {libs.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {libs.map((lib) => (
            <LibraryCard
              key={lib.ItemId ?? lib.Name}
              lib={lib}
              onDelete={lib.Name ? () => remove.mutate(lib.Name!) : undefined}
              deleting={remove.isPending}
            />
          ))}
        </div>
      ) : (
        <Empty text={t("noLibraries")} />
      )}
      {addOpen && <AddLibraryModal onClose={() => setAddOpen(false)} />}
    </>
  );
}

function LibraryCard({
  lib,
  onDelete,
  deleting,
}: {
  lib: VirtualFolderInfo;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  const t = useTranslations("Admin");
  return (
    <div className="rounded-xl border border-border bg-card/60 p-4 transition-colors hover:border-accent/50">
      <div className="mb-1 flex items-center gap-2">
        <Link
          href={`/admin/libraries/${encodeURIComponent(lib.Name ?? "")}`}
          className="flex min-w-0 flex-1 items-center gap-2"
        >
          <FolderTree className="size-4 flex-none text-accent" />
          <span className="min-w-0 flex-1 truncate text-[15px] font-bold">
            {lib.Name}
          </span>
        </Link>
        {onDelete && <DeleteButton onConfirm={onDelete} pending={deleting} />}
      </div>
      <div className="text-[12px] text-muted capitalize">
        {lib.CollectionType ?? "mixed"}
      </div>
      <div className="mt-2 text-[11.5px] text-dim">
        {lib.Locations?.length ?? 0} {t("paths")}
      </div>
      {lib.Locations?.map((p) => (
        <div key={p} className="mt-1 truncate font-mono text-[11px] text-dim">
          {p}
        </div>
      ))}
    </div>
  );
}

// ── Users ────────────────────────────────────────────────────────────

function UsersTab() {
  const t = useTranslations("Admin");
  const { data } = useServerUsers();
  const del = useDeleteUser();
  const me = useCurrentUser();
  const [addOpen, setAddOpen] = useState(false);
  const users = data ?? [];

  return (
    <>
      <TabHeader
        title={t("users")}
        action={t("addUser")}
        onAction={() => setAddOpen(true)}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {users.map((u) => (
          <UserRow
            key={u.Id}
            user={u}
            label={t("admin")}
            onDelete={
              u.Id && u.Id !== me.userId ? () => del.mutate(u.Id!) : undefined
            }
            deleting={del.isPending}
          />
        ))}
      </div>
      {addOpen && <AddUserModal onClose={() => setAddOpen(false)} />}
    </>
  );
}

function UserRow({
  user,
  label,
  onDelete,
  deleting,
}: {
  user: UserDto;
  label: string;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  const t = useTranslations("Admin");
  const timeAgo = useTimeAgo();
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3.5 transition-colors hover:border-accent/50">
      <Link
        href={`/admin/users/${user.Id}`}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <Avatar
          userId={user.Id}
          imageTag={user.PrimaryImageTag}
          name={user.Name}
          size={44}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-bold">{user.Name}</div>
          <div className="text-[11.5px] text-muted">
            {t("lastActive")}: {timeAgo(user.LastActivityDate)}
          </div>
        </div>
      </Link>
      <div className="flex flex-none items-center gap-2">
        <div className="flex flex-col items-end gap-1">
          {user.Policy?.IsAdministrator && (
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10.5px] font-bold text-accent">
              {label}
            </span>
          )}
          {user.Policy?.IsDisabled && (
            <span className="rounded-full bg-danger-soft/15 px-2 py-0.5 text-[10.5px] font-bold text-danger-soft">
              {t("disabled")}
            </span>
          )}
        </div>
        {onDelete && <DeleteButton onConfirm={onDelete} pending={deleting} />}
      </div>
    </div>
  );
}

// ── Add / delete controls ────────────────────────────────────────────

function TabHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-lg font-bold">{title}</h2>
      <button
        type="button"
        onClick={onAction}
        className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-bold text-on-accent transition-[filter] hover:brightness-110"
      >
        <Plus className="size-4" /> {action}
      </button>
    </div>
  );
}

function DeleteButton({
  onConfirm,
  pending,
}: {
  onConfirm: () => void;
  pending?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <span className="flex flex-none items-center gap-1">
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          aria-label="Confirm delete"
          className="flex size-7 items-center justify-center rounded-md bg-danger-soft/20 text-danger-soft hover:bg-danger-soft/30 disabled:opacity-50"
        >
          <Check className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          aria-label="Cancel"
          className="flex size-7 items-center justify-center rounded-md bg-white/[0.06] text-muted hover:bg-white/[0.12]"
        >
          <X className="size-4" />
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      aria-label="Delete"
      className="flex size-7 flex-none items-center justify-center rounded-md text-dim transition-colors hover:bg-danger-soft/15 hover:text-danger-soft"
    >
      <Trash2 className="size-4" />
    </button>
  );
}

// ── Modals & forms ───────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <Portal>
      <div
        className="animate-jn-fade fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className={cn(
            "animate-jn-pop max-h-[88vh] w-full overflow-y-auto rounded-2xl border border-border-strong bg-bg p-6 shadow-2xl",
            wide ? "max-w-[540px]" : "max-w-[440px]",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-extrabold">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-white/[0.06] hover:text-text"
            >
              <X className="size-5" />
            </button>
          </div>
          {children}
        </div>
      </div>
    </Portal>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoFocus,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        placeholder={placeholder}
        autoComplete="off"
        className="h-11 rounded-[10px] border border-border-strong bg-white/[0.04] px-3.5 text-[14px] text-text outline-none focus:border-accent"
      />
    </label>
  );
}

function AddUserModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("Admin");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const create = useCreateUser();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate({ name: name.trim(), password }, { onSuccess: onClose });
  }

  return (
    <Modal title={t("addUser")} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <Field
          label={t("username")}
          value={name}
          onChange={setName}
          autoFocus
        />
        <Field
          label={t("password")}
          value={password}
          onChange={setPassword}
          type="password"
        />
        {create.isError && (
          <p className="text-[13px] font-semibold text-danger-soft">
            {t("createFailed")}
          </p>
        )}
        <button
          type="submit"
          disabled={!name.trim() || create.isPending}
          className="mt-1 flex h-11 items-center justify-center rounded-[10px] bg-accent text-[14px] font-extrabold text-on-accent transition-[filter] hover:brightness-110 disabled:opacity-50"
        >
          {create.isPending ? "…" : t("create")}
        </button>
      </form>
    </Modal>
  );
}

const LIB_TYPES = [
  { value: "movies", key: "typeMovies" },
  { value: "tvshows", key: "typeTv" },
  { value: "music", key: "typeMusic" },
  { value: "homevideos", key: "typeHomeVideos" },
  { value: "books", key: "typeBooks" },
  { value: "", key: "typeMixed" },
] as const;

function AddLibraryModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("Admin");
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("movies");
  const [path, setPath] = useState("");
  const add = useAddLibrary();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    add.mutate(
      { name: name.trim(), collectionType: type, path: path.trim() },
      { onSuccess: onClose },
    );
  }

  return (
    <Modal title={t("addLibrary")} onClose={onClose} wide>
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <Field
          label={t("libraryName")}
          value={name}
          onChange={setName}
          autoFocus
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted">
            {t("contentType")}
          </span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-11 rounded-[10px] border border-border-strong bg-white/[0.04] px-3 text-[14px] text-text outline-none focus:border-accent"
          >
            {LIB_TYPES.map((x) => (
              <option key={x.key} value={x.value} className="bg-bg">
                {t(x.key)}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted">
            {t("folderPath")}
          </span>
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="/media/movies"
            autoComplete="off"
            spellCheck={false}
            className="h-11 rounded-[10px] border border-border-strong bg-white/[0.04] px-3.5 font-mono text-[13px] text-text outline-none focus:border-accent"
          />
          <FolderPicker value={path} onChange={setPath} />
        </div>
        {add.isError && (
          <p className="text-[13px] font-semibold text-danger-soft">
            {t("createFailed")}
          </p>
        )}
        <button
          type="submit"
          disabled={!name.trim() || !path.trim() || add.isPending}
          className="mt-1 flex h-11 items-center justify-center rounded-[10px] bg-accent text-[14px] font-extrabold text-on-accent transition-[filter] hover:brightness-110 disabled:opacity-50"
        >
          {add.isPending ? "…" : t("create")}
        </button>
      </form>
    </Modal>
  );
}

// ── Devices ──────────────────────────────────────────────────────────

function DevicesTab() {
  const t = useTranslations("Admin");
  const { data } = useDevices();
  const devices = data?.Items ?? [];
  if (!devices.length) return <Empty text={t("noDevices")} />;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {devices.map((d) => (
        <DeviceRow key={d.Id} device={d} />
      ))}
    </div>
  );
}

function DeviceRow({ device }: { device: DeviceInfoDto }) {
  const t = useTranslations("Admin");
  const timeAgo = useTimeAgo();
  const { deviceId } = useCurrentUser();
  const rename = useRenameDevice();
  const del = useDeleteDevice();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(device.Name ?? device.CustomName ?? "");
  const [confirming, setConfirming] = useState(false);
  const isThis = device.Id === deviceId;

  const save = () => {
    if (device.Id && name.trim())
      rename.mutate({ id: device.Id, name: name.trim() });
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3.5">
      <MonitorSmartphone className="size-6 flex-none text-accent" />
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
            onBlur={save}
            className="w-full rounded-md border border-accent bg-white/[0.06] px-2 py-1 text-[14px] font-bold outline-none"
          />
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-bold">
              {device.Name || device.AppName}
            </span>
            {isThis && (
              <span className="flex-none rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold text-accent">
                {t("thisDevice")}
              </span>
            )}
          </div>
        )}
        <div className="truncate text-[12px] text-muted">
          {[device.AppName, device.AppVersion].filter(Boolean).join(" · ")}
        </div>
        <div className="text-[11px] text-dim">
          {device.LastUserName} · {t("lastActive")}:{" "}
          {timeAgo(device.DateLastActivity)}
        </div>
      </div>
      <div className="flex flex-none items-center gap-1">
        <button
          type="button"
          onClick={() => {
            setName(device.Name ?? device.CustomName ?? "");
            setEditing(true);
          }}
          aria-label={t("rename")}
          className="flex size-8 items-center justify-center rounded-lg text-dim hover:bg-white/10 hover:text-text"
        >
          <Pencil className="size-4" />
        </button>
        {!isThis &&
          (confirming ? (
            <button
              type="button"
              onClick={() => device.Id && del.mutate(device.Id)}
              className="flex h-8 items-center gap-1 rounded-lg bg-danger/15 px-2 text-[11px] font-bold text-danger-soft"
            >
              {del.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                t("confirm")
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              aria-label={t("delete")}
              className="flex size-8 items-center justify-center rounded-lg text-dim hover:bg-danger/15 hover:text-danger-soft"
            >
              <Trash2 className="size-4" />
            </button>
          ))}
      </div>
    </div>
  );
}

// ── Tasks ────────────────────────────────────────────────────────────

function TasksTab() {
  const { data } = useScheduledTasks();
  const run = useRunTask();
  const tasks = (data ?? []).filter((x) => !x.IsHidden);
  if (!tasks.length) return <Empty text="—" />;
  return (
    <div className="flex flex-col gap-2.5">
      {tasks.map((task) => (
        <TaskRow
          key={task.Id}
          task={task}
          onRun={() => task.Id && run.mutate(task.Id)}
          running={run.isPending}
        />
      ))}
    </div>
  );
}

function TaskRow({
  task,
  onRun,
  running,
}: {
  task: TaskInfo;
  onRun: () => void;
  running: boolean;
}) {
  const t = useTranslations("Admin");
  const timeAgo = useTimeAgo();
  const isRunning = String(task.State) === "Running";
  const last = task.LastExecutionResult;
  const status = last?.Status ? String(last.Status) : null;
  const [scheduling, setScheduling] = useState(false);

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card/60 p-4">
      {scheduling && task.Id && (
        <TaskTriggersModal
          taskId={task.Id}
          taskName={task.Name ?? ""}
          onClose={() => setScheduling(false)}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[14.5px] font-bold">{task.Name}</span>
          {task.Category && (
            <span className="flex-none rounded-full bg-white/[0.06] px-2 py-0.5 text-[10.5px] font-semibold text-muted">
              {task.Category}
            </span>
          )}
        </div>
        {task.Description && (
          <div className="mt-0.5 truncate text-[12px] text-muted">
            {task.Description}
          </div>
        )}
        {isRunning ? (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-accent transition-[width]"
                style={{ width: `${task.CurrentProgressPercentage ?? 0}%` }}
              />
            </div>
            <span className="text-[11px] font-semibold text-accent tabular-nums">
              {Math.round(task.CurrentProgressPercentage ?? 0)}%
            </span>
          </div>
        ) : (
          status && (
            <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-dim">
              {status === "Completed" ? (
                <CheckCircle2 className="size-3.5 text-emerald-400" />
              ) : (
                <XCircle className="size-3.5 text-danger-soft" />
              )}
              {t("lastRun")}: {timeAgo(last?.EndTimeUtc)}
            </div>
          )
        )}
      </div>
      <button
        type="button"
        onClick={() => setScheduling(true)}
        aria-label={t("schedule")}
        className="flex size-9 flex-none items-center justify-center rounded-lg border border-border-strong text-dim transition-colors hover:bg-white/[0.06] hover:text-text"
      >
        <Clock className="size-4" />
      </button>
      <button
        type="button"
        onClick={onRun}
        disabled={isRunning || running}
        className="flex flex-none items-center gap-1.5 rounded-lg border border-border-strong px-3.5 py-2 text-[12.5px] font-bold text-bright transition-colors hover:bg-white/[0.06] disabled:opacity-50"
      >
        {isRunning ? (
          <>
            <RefreshCw className="size-3.5 animate-spin" /> {t("taskRunning")}
          </>
        ) : (
          <>
            <Play className="size-3.5 fill-current" /> {t("run")}
          </>
        )}
      </button>
    </div>
  );
}

const TICKS_PER_SEC = 10_000_000;
const TICKS_PER_HOUR = 3600 * TICKS_PER_SEC;
const DOW = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Convert TimeOfDayTicks → "HH:MM" and back. */
function ticksToHHMM(ticks?: number | null): string {
  const secs = Math.floor((ticks ?? 0) / TICKS_PER_SEC);
  const h = Math.floor(secs / 3600) % 24;
  const m = Math.floor((secs % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function hhmmToTicks(v: string): number {
  const [h, m] = v.split(":").map(Number);
  return ((h || 0) * 3600 + (m || 0) * 60) * TICKS_PER_SEC;
}

function triggerSummary(
  tr: TaskTriggerInfo,
  t: ReturnType<typeof useTranslations>,
): string {
  const type = String(tr.Type);
  if (type === "DailyTrigger")
    return `${t("daily")} · ${ticksToHHMM(tr.TimeOfDayTicks)}`;
  if (type === "WeeklyTrigger")
    return `${t("weekly")} · ${String(tr.DayOfWeek)} ${ticksToHHMM(tr.TimeOfDayTicks)}`;
  if (type === "IntervalTrigger")
    return `${t("everyInterval", { hours: Math.round((tr.IntervalTicks ?? 0) / TICKS_PER_HOUR) })}`;
  if (type === "StartupTrigger") return t("onStartup");
  return type;
}

/** Add/remove the schedule triggers that fire a scheduled task. */
function TaskTriggersModal({
  taskId,
  taskName,
  onClose,
}: {
  taskId: string;
  taskName: string;
  onClose: () => void;
}) {
  const t = useTranslations("Admin");
  const detail = useTaskDetail(taskId);
  const update = useUpdateTaskTriggers();
  const [triggers, setTriggers] = useState<TaskTriggerInfo[] | null>(null);
  const [syncedId, setSyncedId] = useState<string | null>(null);
  const [newType, setNewType] = useState("DailyTrigger");
  const [time, setTime] = useState("03:00");
  const [day, setDay] = useState("Sunday");
  const [interval, setInterval] = useState("24");

  // Seed the local draft from the loaded task once.
  if (detail.data && syncedId !== taskId) {
    setSyncedId(taskId);
    setTriggers(detail.data.Triggers ?? []);
  }

  const list = triggers ?? [];

  const add = () => {
    const tr: TaskTriggerInfo = { Type: newType as TaskTriggerInfo["Type"] };
    if (newType === "DailyTrigger") tr.TimeOfDayTicks = hhmmToTicks(time);
    else if (newType === "WeeklyTrigger") {
      tr.TimeOfDayTicks = hhmmToTicks(time);
      tr.DayOfWeek = day as TaskTriggerInfo["DayOfWeek"];
    } else if (newType === "IntervalTrigger")
      tr.IntervalTicks = Math.max(1, Number(interval) || 1) * TICKS_PER_HOUR;
    setTriggers([...list, tr]);
  };

  const save = () =>
    update.mutate({ id: taskId, triggers: list }, { onSuccess: onClose });

  return (
    <Modal title={taskName || t("schedule")} onClose={onClose} wide>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          {detail.isLoading && !triggers ? (
            <div className="py-6 text-center text-dim">
              <Loader2 className="mx-auto size-5 animate-spin" />
            </div>
          ) : list.length ? (
            list.map((tr, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border border-border bg-card/60 px-3.5 py-2.5"
              >
                <Clock className="size-4 flex-none text-accent" />
                <span className="flex-1 text-[13px] font-semibold">
                  {triggerSummary(tr, t)}
                </span>
                <button
                  type="button"
                  onClick={() => setTriggers(list.filter((_, j) => j !== i))}
                  aria-label={t("delete")}
                  className="flex size-7 items-center justify-center rounded-md text-dim hover:bg-danger/15 hover:text-danger-soft"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))
          ) : (
            <p className="py-2 text-[12.5px] text-muted">{t("noTriggers")}</p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-white/[0.02] p-3.5">
          <div className="mb-2.5 text-[12px] font-bold text-muted">
            {t("addTrigger")}
          </div>
          <div className="flex flex-wrap items-end gap-2.5">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-dim">{t("triggerType")}</span>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="h-10 rounded-lg border border-border-strong bg-white/[0.04] px-2.5 text-[13px] outline-none focus:border-accent"
              >
                <option value="DailyTrigger">{t("daily")}</option>
                <option value="WeeklyTrigger">{t("weekly")}</option>
                <option value="IntervalTrigger">{t("interval")}</option>
                <option value="StartupTrigger">{t("onStartup")}</option>
              </select>
            </label>
            {newType === "WeeklyTrigger" && (
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-dim">{t("dayOfWeek")}</span>
                <select
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  className="h-10 rounded-lg border border-border-strong bg-white/[0.04] px-2.5 text-[13px] outline-none focus:border-accent"
                >
                  {DOW.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {(newType === "DailyTrigger" || newType === "WeeklyTrigger") && (
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-dim">{t("timeOfDay")}</span>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="h-10 rounded-lg border border-border-strong bg-white/[0.04] px-2.5 text-[13px] outline-none focus:border-accent"
                />
              </label>
            )}
            {newType === "IntervalTrigger" && (
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-dim">{t("everyHours")}</span>
                <input
                  type="number"
                  min={1}
                  value={interval}
                  onChange={(e) => setInterval(e.target.value)}
                  className="h-10 w-24 rounded-lg border border-border-strong bg-white/[0.04] px-2.5 text-[13px] outline-none focus:border-accent"
                />
              </label>
            )}
            <button
              type="button"
              onClick={add}
              className="flex h-10 items-center gap-1.5 rounded-lg border border-border-strong px-3 text-[12.5px] font-bold text-bright hover:bg-white/[0.06]"
            >
              <Plus className="size-4" /> {t("add")}
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2.5 text-[13px] font-semibold text-muted hover:text-text"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={update.isPending}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-[13px] font-extrabold text-on-accent disabled:opacity-50"
          >
            {update.isPending && <Loader2 className="size-4 animate-spin" />}
            {t("saveSchedule")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Activity ─────────────────────────────────────────────────────────

function ActivityTab() {
  const t = useTranslations("Admin");
  const { data } = useActivityLog(40);
  const entries = data?.Items ?? [];
  if (!entries.length) return <Empty text={t("noActivity")} />;
  return (
    <div className="rounded-2xl border border-border bg-surface">
      <div className="flex flex-col divide-y divide-border/60 px-5">
        {entries.map((e) => (
          <ActivityRow key={e.Id} entry={e} />
        ))}
      </div>
    </div>
  );
}

function ActivityRow({ entry }: { entry: ActivityLogEntry }) {
  const timeAgo = useTimeAgo();
  const sev = String(entry.Severity);
  const Icon =
    sev === "Error" || sev === "Critical"
      ? XCircle
      : sev === "Warning"
        ? AlertTriangle
        : Info;
  const tone =
    sev === "Error" || sev === "Critical"
      ? "text-danger-soft"
      : sev === "Warning"
        ? "text-amber-400"
        : "text-dim";
  return (
    <div className="flex items-start gap-3 py-3">
      <Icon className={cn("mt-0.5 size-4 flex-none", tone)} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-semibold">{entry.Name}</div>
        {entry.ShortOverview && (
          <div className="truncate text-[12px] text-muted">
            {entry.ShortOverview}
          </div>
        )}
      </div>
      <span className="flex-none text-[11px] text-dim">
        {timeAgo(entry.Date)}
      </span>
    </div>
  );
}

// ── System ───────────────────────────────────────────────────────────

function ServerControls() {
  const t = useTranslations("Admin");
  const scanAll = useScanAllLibraries();
  const restart = useRestartServer();
  const shutdown = useShutdownServer();

  return (
    <Card icon={Server} title={t("serverControls")}>
      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={() => scanAll.mutate()}
          disabled={scanAll.isPending}
          className="flex items-center gap-1.5 rounded-lg border border-border-strong px-3.5 py-2 text-[13px] font-bold text-bright transition-colors hover:bg-white/[0.06] disabled:opacity-50"
        >
          {scanAll.isSuccess ? (
            <Check className="size-4 text-emerald-400" />
          ) : (
            <RefreshCw
              className={cn("size-4", scanAll.isPending && "animate-spin")}
            />
          )}
          {t("scanAll")}
        </button>
        <ConfirmAction
          icon={RotateCw}
          label={t("restart")}
          onConfirm={() => restart.mutate()}
          pending={restart.isPending}
        />
        <ConfirmAction
          icon={Power}
          label={t("shutdown")}
          onConfirm={() => shutdown.mutate()}
          pending={shutdown.isPending}
          danger
        />
      </div>
    </Card>
  );
}

function ConfirmAction({
  icon: Icon,
  label,
  onConfirm,
  pending,
  danger,
}: {
  icon: LucideIcon;
  label: string;
  onConfirm: () => void;
  pending?: boolean;
  danger?: boolean;
}) {
  const t = useTranslations("Admin");
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <div className="flex items-center gap-1 rounded-lg border border-border-strong px-2 py-1">
        <span className="px-1 text-[12px] font-semibold text-muted">
          {t("confirmQ")}
        </span>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            onConfirm();
          }}
          className={cn(
            "rounded-md px-2 py-1 text-[12px] font-bold",
            danger ? "text-danger-soft" : "text-accent",
          )}
        >
          {t("yes")}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-md px-2 py-1 text-[12px] font-bold text-muted"
        >
          {t("no")}
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      disabled={pending}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border border-border-strong px-3.5 py-2 text-[13px] font-bold text-bright transition-colors hover:bg-white/[0.06] disabled:opacity-50",
        danger && "hover:border-danger-soft/60 hover:text-danger-soft",
      )}
    >
      <Icon className="size-4" /> {label}
    </button>
  );
}

function SystemTab() {
  const t = useTranslations("Admin");
  const info = useSystemInfo();
  const plugins = usePlugins();
  const d = info.data;

  const general: [string, string | undefined | null][] = [
    [t("serverId"), d?.Id],
    [t("productName"), d?.ProductName],
    [t("version"), d?.Version],
    [t("os"), d?.OperatingSystemDisplayName ?? d?.OperatingSystem],
    [t("architecture"), d?.SystemArchitecture],
    [t("encoder"), d?.EncoderLocation],
    [t("address"), d?.LocalAddress],
    [t("webSocket"), d?.WebSocketPortNumber?.toString()],
  ];
  const paths: [string, string | undefined | null][] = [
    ["Program data", d?.ProgramDataPath],
    ["Cache", d?.CachePath],
    ["Logs", d?.LogPath],
    ["Metadata", d?.InternalMetadataPath],
    ["Transcodes", d?.TranscodingTempPath],
    ["Web", d?.WebPath],
  ];

  return (
    <div className="flex flex-col gap-6">
      <ServerControls />

      <Card icon={Info} title={t("generalInfo")}>
        <div className="grid gap-x-8 gap-y-3 text-[13px] sm:grid-cols-2">
          {general.map(([k, v]) => (
            <InfoRow key={k} label={k} value={v} />
          ))}
        </div>
      </Card>

      <Card icon={HardDrive} title={t("pathsTitle")}>
        <div className="flex flex-col gap-2.5 text-[12.5px]">
          {paths.map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5">
              <span className="text-muted">{k}</span>
              <span className="truncate font-mono text-[11.5px] text-bright">
                {v || "—"}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card icon={Puzzle} title={t("pluginsTitle")}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(plugins.data ?? []).map((p) => (
            <PluginRow key={p.Id ?? p.Name} plugin={p} />
          ))}
        </div>
      </Card>

      <PluginCatalogCard />
      <ApiKeysCard />
      <BackupCard />
    </div>
  );
}

function PluginCatalogCard() {
  const t = useTranslations("Admin");
  const catalog = usePackageCatalog();
  const plugins = usePlugins();
  const install = useInstallPackage();
  const [query, setQuery] = useState("");

  const installed = new Set(
    (plugins.data ?? []).map((p) => (p.Name ?? "").toLowerCase()),
  );
  const q = query.trim().toLowerCase();
  const available = (catalog.data ?? [])
    .filter((p) => !q || (p.name ?? "").toLowerCase().includes(q))
    .slice(0, 40);

  return (
    <Card icon={DownloadCloud} title={t("pluginCatalog")}>
      <div className="relative mb-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlugins")}
          className="h-9 w-full rounded-lg border border-border-strong bg-white/[0.04] px-3 text-[13px] text-text outline-none focus:border-accent"
        />
      </div>
      <div className="grid max-h-[360px] grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
        {available.map((p) => {
          const already = installed.has((p.name ?? "").toLowerCase());
          const busy = install.isPending && install.variables?.name === p.name;
          return (
            <div
              key={p.guid ?? p.name}
              className="flex items-center gap-3 rounded-lg border border-border bg-card/60 px-3.5 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-bold">{p.name}</div>
                <div className="truncate text-[11px] text-muted">
                  {p.category ?? p.owner}
                </div>
              </div>
              <button
                type="button"
                onClick={() => install.mutate(p)}
                disabled={already || busy}
                className={cn(
                  "flex flex-none items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-bold transition-colors",
                  already
                    ? "text-muted"
                    : "bg-accent/15 text-accent hover:bg-accent/25",
                )}
              >
                {busy ? (
                  <RefreshCw className="size-3.5 animate-spin" />
                ) : already ? (
                  <Check className="size-3.5" />
                ) : (
                  <DownloadCloud className="size-3.5" />
                )}
                {already ? t("installed") : t("install")}
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ApiKeysCard() {
  const t = useTranslations("Admin");
  const keys = useApiKeys();
  const create = useCreateApiKey();
  const revoke = useRevokeApiKey();
  const [app, setApp] = useState("");
  const [copied, setCopied] = useState("");

  return (
    <Card icon={Key} title={t("apiKeys")}>
      <form
        className="mb-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (app.trim())
            create.mutate(app.trim(), { onSuccess: () => setApp("") });
        }}
      >
        <input
          value={app}
          onChange={(e) => setApp(e.target.value)}
          placeholder={t("apiKeyApp")}
          className="h-9 flex-1 rounded-lg border border-border-strong bg-white/[0.04] px-3 text-[13px] text-text outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={!app.trim() || create.isPending}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-[12.5px] font-bold text-on-accent disabled:opacity-50"
        >
          <Plus className="size-3.5" /> {t("create")}
        </button>
      </form>
      <div className="flex flex-col gap-2">
        {(keys.data?.Items ?? []).length === 0 ? (
          <Empty text={t("noApiKeys")} />
        ) : (
          (keys.data?.Items ?? []).map((k) => (
            <div
              key={k.AccessToken}
              className="flex items-center gap-3 rounded-lg border border-border bg-card/60 px-3.5 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-bold">
                  {k.AppName}
                </div>
                <div className="truncate font-mono text-[11px] text-muted">
                  {copied === k.AccessToken ? t("copied") : k.AccessToken}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard
                    ?.writeText(k.AccessToken ?? "")
                    .then(() => {
                      setCopied(k.AccessToken ?? "");
                      setTimeout(() => setCopied(""), 1500);
                    })
                    .catch(() => {});
                }}
                aria-label={t("copy")}
                className="flex size-8 flex-none items-center justify-center rounded-md text-muted hover:bg-white/10 hover:text-bright"
              >
                <Copy className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => k.AccessToken && revoke.mutate(k.AccessToken)}
                aria-label={t("revoke")}
                className="flex size-8 flex-none items-center justify-center rounded-md text-muted hover:bg-danger/20 hover:text-danger-soft"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function BackupCard() {
  const t = useTranslations("Admin");
  const backups = useBackups();
  const create = useCreateBackup();

  return (
    <Card icon={Archive} title={t("backups")}>
      <button
        type="button"
        onClick={() => create.mutate()}
        disabled={create.isPending}
        className="mb-3 flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[12.5px] font-bold text-on-accent disabled:opacity-50"
      >
        {create.isPending ? (
          <RefreshCw className="size-3.5 animate-spin" />
        ) : (
          <Archive className="size-3.5" />
        )}
        {t("createBackup")}
      </button>
      <div className="flex flex-col gap-2">
        {(backups.data ?? []).length === 0 ? (
          <Empty text={t("noBackups")} />
        ) : (
          (backups.data ?? []).map((b, i) => (
            <div
              key={b.Path ?? i}
              className="flex items-center gap-3 rounded-lg border border-border bg-card/60 px-3.5 py-2.5"
            >
              <Archive className="size-4 flex-none text-accent" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-bold">
                  {b.Name ?? b.Path?.split("/").pop()}
                </div>
                <div className="truncate text-[11px] text-muted">
                  {[b.Version, b.DateCreated?.slice(0, 16).replace("T", " ")]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function PluginRow({ plugin }: { plugin: PluginInfo }) {
  const t = useTranslations("Admin");
  const toggle = usePluginEnable();
  const uninstall = useUninstallPlugin();
  const active = String(plugin.Status) === "Active";
  const id = plugin.Id;
  const version = plugin.Version;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card/60 px-3.5 py-2.5 transition-colors hover:border-accent/50">
      <span
        className={cn(
          "size-2 flex-none rounded-full",
          active ? "bg-emerald-400" : "bg-danger-soft",
        )}
      />
      <Link href={`/admin/plugins/${id ?? ""}`} className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-bold">{plugin.Name}</div>
        <div className="truncate text-[11px] text-muted">
          {plugin.Version} · {plugin.Status}
        </div>
      </Link>
      {id && version && (
        <button
          type="button"
          onClick={() => toggle.mutate({ id, version, enable: !active })}
          disabled={toggle.isPending}
          className="flex-none rounded-md bg-white/[0.06] px-2.5 py-1 text-[11.5px] font-bold text-bright transition-colors hover:bg-white/[0.12] disabled:opacity-50"
        >
          {active ? t("disable") : t("enable")}
        </button>
      )}
      {plugin.CanUninstall && id && (
        <DeleteButton
          onConfirm={() => uninstall.mutate(id)}
          pending={uninstall.isPending}
        />
      )}
    </div>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────

function SessionRow({ session }: { session: SessionInfoDto }) {
  const t = useTranslations("Admin");
  const cmd = useSessionCommand();
  const msg = useSessionMessage();
  const [msgOpen, setMsgOpen] = useState(false);
  const [text, setText] = useState("");

  const now = session.NowPlayingItem?.Name;
  const paused = session.PlayState?.IsPaused;
  const transcoding = Boolean(session.TranscodingInfo);
  const id = session.Id;
  const canControl = Boolean(session.SupportsMediaControl && now && id);
  // A session can be messaged if it's remote-controllable OR advertises the
  // DisplayMessage command (JellyNext registers this over its WebSocket).
  const canMessage = Boolean(
    id &&
    (session.SupportsRemoteControl ||
      session.Capabilities?.SupportedCommands?.includes("DisplayMessage")),
  );

  return (
    <div className="py-3">
      <div className="flex items-center gap-3">
        <Avatar
          userId={session.UserId}
          imageTag={session.UserPrimaryImageTag}
          name={session.UserName}
          size={36}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-bold">
            {session.UserName}
          </div>
          <div className="truncate text-[12px] text-muted">
            {[session.DeviceName, session.Client].filter(Boolean).join(" · ")}
          </div>
        </div>
        {now ? (
          <div className="flex max-w-[45%] flex-col items-end gap-1">
            <span className="truncate rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-bold text-accent">
              {t("watching")}: {now}
            </span>
            {transcoding && (
              <span className="text-[10px] font-semibold text-amber-400">
                {t("transcoding")}
              </span>
            )}
          </div>
        ) : (
          <span className="text-[11.5px] text-dim">{t("idle")}</span>
        )}
      </div>

      {(canControl || canMessage) && (
        <div className="mt-2 flex items-center gap-1.5 pl-12">
          {canControl && (
            <>
              <SessionBtn
                label={paused ? t("resume") : t("pause")}
                onClick={() => cmd.mutate({ id: id!, command: "PlayPause" })}
              >
                {paused ? (
                  <Play className="size-4" />
                ) : (
                  <Pause className="size-4" />
                )}
              </SessionBtn>
              <SessionBtn
                label={t("stop")}
                onClick={() => cmd.mutate({ id: id!, command: "Stop" })}
              >
                <Square className="size-3.5" />
              </SessionBtn>
            </>
          )}
          {canMessage && (
            <SessionBtn
              label={t("sendMessage")}
              active={msgOpen}
              onClick={() => setMsgOpen((o) => !o)}
            >
              <MessageSquare className="size-4" />
            </SessionBtn>
          )}
        </div>
      )}

      {msgOpen && (
        <form
          className="mt-2 flex gap-1.5 pl-12"
          onSubmit={(e) => {
            e.preventDefault();
            if (id && text.trim())
              msg.mutate(
                { id, text: text.trim() },
                {
                  onSuccess: () => {
                    setText("");
                    setMsgOpen(false);
                  },
                },
              );
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("messageText")}
            autoFocus
            className="h-9 flex-1 rounded-lg border border-border-strong bg-white/[0.05] px-3 text-[13px] text-text outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={!text.trim() || msg.isPending}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-[12.5px] font-bold text-on-accent transition-[filter] hover:brightness-110 disabled:opacity-50"
          >
            <Send className="size-3.5" /> {t("send")}
          </button>
        </form>
      )}
    </div>
  );
}

function SessionBtn({
  children,
  onClick,
  label,
  active,
}: {
  children: ReactNode;
  onClick: () => void;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-8 items-center justify-center rounded-lg text-bright transition-colors",
        active
          ? "bg-accent/20 text-accent"
          : "bg-white/[0.06] hover:bg-white/[0.12]",
      )}
    >
      {children}
    </button>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value?: number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <Icon className="mb-3 size-5 text-accent" />
      <div className="text-2xl font-extrabold tabular-nums">
        {value != null ? value.toLocaleString() : "—"}
      </div>
      <div className="text-[12.5px] text-muted">{label}</div>
    </div>
  );
}

function Card({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="size-4 text-accent" />
        <h3 className="text-[13px] font-extrabold tracking-[0.08em] text-accent">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="truncate font-semibold">{value || "—"}</dd>
    </div>
  );
}

function Pill({
  tone,
  children,
}: {
  tone: "ok" | "warn";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-[11px] font-bold",
        tone === "ok"
          ? "bg-emerald-500/15 text-emerald-400"
          : "bg-amber-500/15 text-amber-400",
      )}
    >
      {children}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-10 text-center text-[13px] text-muted">{text}</p>;
}
