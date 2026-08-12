"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ActivityLogEntry,
  BrandingOptionsDto,
  CountryInfo,
  CultureDto,
  DeviceInfoDto,
  ItemCounts,
  ParentalRating,
  PluginInfo,
  ServerConfiguration,
  SessionInfoDto,
  SystemInfo,
  TaskInfo,
  TaskTriggerInfo,
  UserDto,
  UserPolicy,
  VirtualFolderInfo,
} from "@jellyfin/sdk/lib/generated-client";
import { jf } from "./browser";
import { useCurrentUser } from "@/lib/auth/current-user";

/** Server system information (admin). */
export function useSystemInfo() {
  return useQuery({
    queryKey: ["systemInfo"],
    queryFn: () => jf.get<SystemInfo>("/System/Info"),
    staleTime: 60 * 1000,
  });
}

/** Library item counts. */
export function useItemCounts() {
  const { userId } = useCurrentUser();
  return useQuery({
    queryKey: ["itemCounts", userId],
    queryFn: () => jf.get<ItemCounts>("/Items/Counts", { userId }),
    staleTime: 60 * 1000,
  });
}

/** Active playback/control sessions (refreshes periodically). */
export function useSessions() {
  return useQuery({
    queryKey: ["sessions"],
    queryFn: () => jf.get<SessionInfoDto[]>("/Sessions"),
    // Live updates arrive over the WebSocket (RealtimeMessages pushes them
    // into this cache on change); the interval is just a slow fallback.
    refetchInterval: 30 * 1000,
  });
}

/** Configured libraries. */
export function useLibraries() {
  return useQuery({
    queryKey: ["libraries"],
    queryFn: () => jf.get<VirtualFolderInfo[]>("/Library/VirtualFolders"),
    staleTime: 5 * 60 * 1000,
  });
}

/** All server users (admin). */
export function useServerUsers() {
  return useQuery({
    queryKey: ["serverUsers"],
    queryFn: () => jf.get<UserDto[]>("/Users"),
    staleTime: 60 * 1000,
  });
}

/** Scheduled maintenance tasks (refreshes so running progress updates). */
export function useScheduledTasks() {
  return useQuery({
    queryKey: ["scheduledTasks"],
    queryFn: () => jf.get<TaskInfo[]>("/ScheduledTasks"),
    refetchInterval: 3 * 1000,
  });
}

/** Registered client devices. */
export function useDevices() {
  return useQuery({
    queryKey: ["devices"],
    queryFn: () => jf.get<{ Items?: DeviceInfoDto[] }>("/Devices"),
    staleTime: 60 * 1000,
  });
}

/** Server activity log (most recent first). */
export function useActivityLog(limit = 40, enabled = true) {
  return useQuery({
    queryKey: ["activityLog", limit],
    queryFn: () =>
      jf.get<{ Items?: ActivityLogEntry[]; TotalRecordCount?: number }>(
        "/System/ActivityLog/Entries",
        { limit },
      ),
    // Admin-only endpoint (403 otherwise) — gate it for non-admin callers.
    enabled,
    refetchInterval: 30 * 1000,
  });
}

/** Installed plugins. */
export function usePlugins() {
  return useQuery({
    queryKey: ["plugins"],
    queryFn: () => jf.get<PluginInfo[]>("/Plugins"),
    staleTime: 5 * 60 * 1000,
  });
}

/** Trigger a scheduled task to run now. */
export function useRunTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) =>
      jf.post(`/ScheduledTasks/Running/${taskId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scheduledTasks"] }),
  });
}

/** Create a new server user. */
export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; password?: string }) =>
      jf.post<UserDto>("/Users/New", {
        Name: input.name,
        Password: input.password || undefined,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["serverUsers"] }),
  });
}

/** Delete a server user. */
export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => jf.delete(`/Users/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["serverUsers"] }),
  });
}

/** A single user with its full Policy + Configuration (admin). */
export function useUser(id: string) {
  return useQuery({
    queryKey: ["user", id],
    queryFn: () => jf.get<UserDto>(`/Users/${id}`),
    enabled: Boolean(id),
  });
}

/** Update a user's name + configuration (preferences). */
export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, user }: { id: string; user: UserDto }) =>
      jf.post(`/Users/${id}`, user),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["user", v.id] });
      qc.invalidateQueries({ queryKey: ["serverUsers"] });
    },
  });
}

/** Update a user's permissions/policy. */
export function useUpdateUserPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, policy }: { id: string; policy: UserPolicy }) =>
      jf.post(`/Users/${id}/Policy`, policy),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["user", v.id] });
      qc.invalidateQueries({ queryKey: ["serverUsers"] });
    },
  });
}

/** Set a new password or reset it (admin, no current password needed). */
export function useSetUserPassword() {
  return useMutation({
    mutationFn: ({
      id,
      newPw,
      reset,
    }: {
      id: string;
      newPw?: string;
      reset?: boolean;
    }) =>
      jf.post(`/Users/${id}/Password`, {
        NewPw: newPw,
        ResetPassword: reset ?? false,
      }),
  });
}

/** Add a library (virtual folder) pointing at a server-side path. */
export function useAddLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      collectionType?: string;
      path: string;
    }) =>
      jf.post(
        "/Library/VirtualFolders",
        { LibraryOptions: { PathInfos: [{ Path: input.path }] } },
        {
          name: input.name,
          collectionType: input.collectionType || undefined,
          paths: input.path,
          refreshLibrary: true,
        },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["libraries"] }),
  });
}

/** Remove a library by name. */
export function useRemoveLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      jf.delete("/Library/VirtualFolders", { name, refreshLibrary: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["libraries"] }),
  });
}

// ── Server file-system browsing (for the library folder picker) ──────

export interface FsEntry {
  Name?: string | null;
  Path?: string | null;
  Type?: string | null;
}

/** Top-level browse roots (drives / mounted volumes) on the server host. */
export function useDrives() {
  return useQuery({
    queryKey: ["fsDrives"],
    queryFn: () => jf.get<FsEntry[]>("/Environment/Drives"),
    staleTime: 5 * 60 * 1000,
  });
}

/** Sub-directories of a server-side path. */
export function useDirectoryContents(path: string | undefined) {
  return useQuery({
    queryKey: ["fsDir", path],
    queryFn: () =>
      jf.get<FsEntry[]>("/Environment/DirectoryContents", {
        path,
        includeDirectories: true,
        includeFiles: false,
      }),
    enabled: Boolean(path),
    staleTime: 30 * 1000,
  });
}

// ── Library management + server controls ─────────────────────────────

/** Add a media path to an existing library. */
export function useAddLibraryPath() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, path }: { name: string; path: string }) =>
      jf.post("/Library/VirtualFolders/Paths", { Name: name, Path: path }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["libraries"] }),
  });
}

/** Remove a media path from a library. */
export function useRemoveLibraryPath() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, path }: { name: string; path: string }) =>
      jf.delete("/Library/VirtualFolders/Paths", {
        name,
        path,
        refreshLibrary: true,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["libraries"] }),
  });
}

/** Rename a library. */
export function useRenameLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, newName }: { name: string; newName: string }) =>
      jf.post("/Library/VirtualFolders/Name", undefined, {
        name,
        newName,
        refreshLibrary: true,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["libraries"] }),
  });
}

/** Trigger a metadata/library scan for one library (by its item id). */
export function useScanLibrary() {
  return useMutation({
    mutationFn: (itemId: string) =>
      jf.post(`/Items/${itemId}/Refresh`, undefined, {
        Recursive: true,
        ImageRefreshMode: "Default",
        MetadataRefreshMode: "Default",
      }),
  });
}

/** Scan all libraries. */
export function useScanAllLibraries() {
  return useMutation({ mutationFn: () => jf.post("/Library/Refresh") });
}

/** Restart the server. */
export function useRestartServer() {
  return useMutation({ mutationFn: () => jf.post("/System/Restart") });
}

/** Shut the server down. */
export function useShutdownServer() {
  return useMutation({ mutationFn: () => jf.post("/System/Shutdown") });
}

/** Send a playstate command (PlayPause, Stop, NextTrack…) to a session. */
export function useSessionCommand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, command }: { id: string; command: string }) =>
      jf.post(`/Sessions/${id}/Playing/${command}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions"] }),
  });
}

/** Enable or disable an installed plugin. */
export function usePluginEnable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      version,
      enable,
    }: {
      id: string;
      version: string;
      enable: boolean;
    }) => jf.post(`/Plugins/${id}/${version}/${enable ? "Enable" : "Disable"}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plugins"] }),
  });
}

/** Uninstall a plugin (all versions). */
export function useUninstallPlugin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => jf.delete(`/Plugins/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plugins"] }),
  });
}

/** A plugin's raw configuration object. */
export function usePluginConfig(id: string) {
  return useQuery({
    queryKey: ["pluginConfig", id],
    queryFn: () =>
      jf.get<Record<string, unknown>>(`/Plugins/${id}/Configuration`),
    enabled: Boolean(id),
    staleTime: 30 * 1000,
  });
}

/** Save a plugin's configuration. */
export function useUpdatePluginConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, config }: { id: string; config: unknown }) =>
      jf.post(`/Plugins/${id}/Configuration`, config),
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: ["pluginConfig", v.id] }),
  });
}

export interface ConfigPageInfo {
  Name?: string | null;
  PluginId?: string | null;
  EnableInMainMenu?: boolean;
}

/** Plugin-registered dashboard configuration pages (official web UI). */
export function useConfigPages() {
  return useQuery({
    queryKey: ["configPages"],
    queryFn: () => jf.get<ConfigPageInfo[]>("/web/ConfigurationPages"),
    staleTime: 5 * 60 * 1000,
  });
}

/** Send a text message to a session's client. */
export function useSessionMessage() {
  return useMutation({
    mutationFn: ({
      id,
      header,
      text,
    }: {
      id: string;
      header?: string;
      text: string;
    }) =>
      jf.post(`/Sessions/${id}/Message`, {
        Header: header || "JellyNext",
        Text: text,
        TimeoutMs: 5000,
      }),
  });
}

// ── API keys ─────────────────────────────────────────────────────────

export interface AuthKey {
  AccessToken?: string;
  AppName?: string;
  DateCreated?: string;
  DateLastActivity?: string;
}

/** All API keys issued on the server. */
export function useApiKeys() {
  return useQuery({
    queryKey: ["apiKeys"],
    queryFn: () =>
      jf.get<{ Items?: AuthKey[]; TotalRecordCount?: number }>("/Auth/Keys"),
    staleTime: 30 * 1000,
  });
}

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (app: string) => jf.post("/Auth/Keys", undefined, { app }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["apiKeys"] }),
  });
}

export function useRevokeApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => jf.delete(`/Auth/Keys/${key}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["apiKeys"] }),
  });
}

// ── Plugin catalog (install from repositories) ───────────────────────

export interface PackageInfo {
  name?: string;
  guid?: string;
  description?: string;
  overview?: string;
  owner?: string;
  category?: string;
  versions?: { version?: string; repositoryUrl?: string }[];
}

/** Plugins available to install from the configured repositories. */
export function usePackageCatalog() {
  return useQuery({
    queryKey: ["packageCatalog"],
    queryFn: () => jf.get<PackageInfo[]>("/Packages"),
    staleTime: 5 * 60 * 1000,
  });
}

/** Install a plugin from the catalog (latest version). */
export function useInstallPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pkg: PackageInfo) => {
      const latest = pkg.versions?.[0];
      return jf.post(
        `/Packages/Installed/${encodeURIComponent(pkg.name ?? "")}`,
        undefined,
        {
          assemblyGuid: pkg.guid,
          version: latest?.version,
          repositoryUrl: latest?.repositoryUrl,
        },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plugins"] });
      qc.invalidateQueries({ queryKey: ["packageCatalog"] });
    },
  });
}

// ── Backup ───────────────────────────────────────────────────────────

export interface BackupInfo {
  Path?: string;
  Name?: string;
  DateCreated?: string;
  Version?: string;
  Size?: number;
}

/** Existing server backups. */
export function useBackups() {
  return useQuery({
    queryKey: ["backups"],
    queryFn: () => jf.get<BackupInfo[]>("/Backup"),
    staleTime: 30 * 1000,
  });
}

/** Create a new server backup. */
export function useCreateBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      jf.post("/Backup/Create", {
        Metadata: true,
        Trickplay: false,
        Subtitles: true,
        Database: true,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["backups"] }),
  });
}

// ── Quick Connect ────────────────────────────────────────────────────

/** Whether the server has Quick Connect enabled. */
export function useQuickConnectEnabled() {
  return useQuery({
    queryKey: ["quickConnectEnabled"],
    queryFn: () => jf.get<boolean>("/QuickConnect/Enabled"),
    staleTime: 5 * 60 * 1000,
  });
}

/** Authorize a pending Quick Connect code shown on another device. */
export function useAuthorizeQuickConnect() {
  return useMutation({
    mutationFn: (code: string) =>
      jf.post<boolean>("/QuickConnect/Authorize", undefined, { code }),
  });
}

// ── Server configuration (dashboard settings) ────────────────────────

/** Full server configuration (admin). */
export function useServerConfig() {
  return useQuery({
    queryKey: ["serverConfig"],
    queryFn: () => jf.get<ServerConfiguration>("/System/Configuration"),
    staleTime: 60 * 1000,
  });
}

/** Update the full server configuration. */
export function useUpdateServerConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: ServerConfiguration) =>
      jf.post("/System/Configuration", config),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["serverConfig"] });
      qc.invalidateQueries({ queryKey: ["systemInfo"] });
    },
  });
}

/** A named configuration section (metadata, network, encoding, …). */
export function useNamedConfig<T = unknown>(key: string) {
  return useQuery({
    queryKey: ["namedConfig", key],
    queryFn: () => jf.get<T>(`/System/Configuration/${key}`),
    staleTime: 60 * 1000,
  });
}

/** Update a named configuration section. */
export function useUpdateNamedConfig(key: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) =>
      jf.post(`/System/Configuration/${key}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["namedConfig", key] }),
  });
}

// ── Branding (login page) ────────────────────────────────────────────

/** Login-page branding: disclaimer, custom CSS, splash screen. */
export function useBranding() {
  return useQuery({
    queryKey: ["branding"],
    queryFn: () => jf.get<BrandingOptionsDto>("/Branding/Configuration"),
    staleTime: 60 * 1000,
  });
}

/** Update branding (stored as the "branding" named config). */
export function useUpdateBranding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BrandingOptionsDto) =>
      jf.post("/System/Configuration/branding", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["branding"] }),
  });
}

// ── Localization (static reference data) ─────────────────────────────

/** Languages/cultures for metadata-language pickers. */
export function useCultures() {
  return useQuery({
    queryKey: ["cultures"],
    queryFn: () => jf.get<CultureDto[]>("/Localization/Cultures"),
    staleTime: Infinity,
  });
}

/** Countries for metadata-country pickers. */
export function useCountries() {
  return useQuery({
    queryKey: ["countries"],
    queryFn: () => jf.get<CountryInfo[]>("/Localization/Countries"),
    staleTime: Infinity,
  });
}

/** Parental ratings for the max-rating picker. */
export function useParentalRatings() {
  return useQuery({
    queryKey: ["parentalRatings"],
    queryFn: () => jf.get<ParentalRating[]>("/Localization/ParentalRatings"),
    staleTime: Infinity,
  });
}

// ── Device management (write) ────────────────────────────────────────

/** Give a device a custom display name. */
export function useRenameDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      jf.post("/Devices/Options", { CustomName: name }, { id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["devices"] }),
  });
}

/** Delete a device and revoke its sessions. */
export function useDeleteDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => jf.delete("/Devices", { id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["devices"] }),
  });
}

// ── Scheduled task triggers (write) ──────────────────────────────────

/** A single scheduled task with its triggers (admin). */
export function useTaskDetail(id: string | null) {
  return useQuery({
    queryKey: ["scheduledTask", id],
    queryFn: () => jf.get<TaskInfo>(`/ScheduledTasks/${id}`),
    enabled: !!id,
  });
}

/** Replace a scheduled task's triggers. */
export function useUpdateTaskTriggers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      triggers,
    }: {
      id: string;
      triggers: TaskTriggerInfo[];
    }) => jf.post(`/ScheduledTasks/${id}/Triggers`, triggers),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["scheduledTask", v.id] });
      qc.invalidateQueries({ queryKey: ["scheduledTasks"] });
    },
  });
}
