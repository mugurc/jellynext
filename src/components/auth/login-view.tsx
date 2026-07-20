"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, LogIn, Server, Smartphone } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import {
  loginWithPassword,
  quickConnectCancel,
  quickConnectInitiate,
  quickConnectPoll,
  setServerUrlAction,
} from "@/lib/jellyfin/auth-actions";

export interface PublicUser {
  id: string;
  name: string;
  hasPassword: boolean;
}

interface LoginViewProps {
  serverName: string;
  serverUrl: string;
  serverReachable: boolean;
  publicUsers: PublicUser[];
  quickConnectEnabled: boolean;
}

type Mode = "picker" | "credentials" | "quick";

function hueFromString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) % 360;
  }
  return hash;
}

function avatarStyle(hue: number): React.CSSProperties {
  return {
    background: `radial-gradient(circle at 35% 30%, oklch(0.62 0.14 ${hue}), oklch(0.32 0.09 ${(hue + 40) % 360}))`,
  };
}

export function LoginView({
  serverName,
  serverUrl,
  serverReachable,
  publicUsers,
  quickConnectEnabled,
}: LoginViewProps) {
  const t = useTranslations("Auth");
  const router = useRouter();

  const [mode, setMode] = useState<Mode>(
    publicUsers.length ? "picker" : "credentials",
  );
  // Reset to the natural entry mode when the connected server (and thus its set
  // of public users) changes — e.g. right after leaving the server step.
  // Adjusts state during render per React's "previous prop" pattern instead of
  // in an effect, avoiding a cascading re-render.
  const [seenUserCount, setSeenUserCount] = useState(publicUsers.length);
  if (seenUserCount !== publicUsers.length) {
    setSeenUserCount(publicUsers.length);
    setMode(publicUsers.length ? "picker" : "credentials");
  }

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const passwordRef = useRef<HTMLInputElement>(null);

  const enterApp = useCallback(() => {
    router.replace("/home");
    router.refresh();
  }, [router]);

  const submitCredentials = useCallback(
    (name: string, pass: string) => {
      setError(null);
      startTransition(async () => {
        const res = await loginWithPassword(name, pass);
        if (res.ok) {
          enterApp();
        } else {
          setError(
            res.error === "invalid-credentials"
              ? t("errorInvalid")
              : res.error === "unreachable"
                ? t("errorUnreachable")
                : t("errorGeneric"),
          );
        }
      });
    },
    [enterApp, t],
  );

  function pickProfile(user: PublicUser) {
    setUsername(user.name);
    setPassword("");
    setError(null);
    if (!user.hasPassword) {
      submitCredentials(user.name, "");
      return;
    }
    setMode("credentials");
    requestAnimationFrame(() => passwordRef.current?.focus());
  }

  // ── Quick Connect ────────────────────────────────────────────────
  const [qcCode, setQcCode] = useState<string | null>(null);

  async function startQuickConnect() {
    setError(null);
    const res = await quickConnectInitiate();
    if (res.ok) {
      setQcCode(res.code);
      setMode("quick");
    } else {
      setError(t("errorGeneric"));
    }
  }

  const cancelQuickConnect = useCallback(async () => {
    await quickConnectCancel();
    setQcCode(null);
    setMode(publicUsers.length ? "picker" : "credentials");
  }, [publicUsers.length]);

  useEffect(() => {
    if (mode !== "quick" || !qcCode) return;
    let active = true;
    const timer = setInterval(async () => {
      const status = await quickConnectPoll();
      if (!active) return;
      if (status.status === "authenticated") {
        clearInterval(timer);
        enterApp();
      } else if (status.status === "error" || status.status === "idle") {
        clearInterval(timer);
        setError(t("errorUnreachable"));
        setMode(publicUsers.length ? "picker" : "credentials");
        setQcCode(null);
      }
    }, 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [mode, qcCode, enterApp, publicUsers.length, t]);

  // ── Server step ──────────────────────────────────────────────────
  // The welcome step: enter a Jellyfin server address. It's the first screen
  // until a reachable server is set, and reachable again via "change server".
  const [changingServer, setChangingServer] = useState(false);
  const [serverInput, setServerInput] = useState(serverUrl);
  const [serverPending, startServerTransition] = useTransition();
  const showServerStep = !serverReachable || changingServer;

  const saveServer = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      startServerTransition(async () => {
        const res = await setServerUrlAction(serverInput);
        if (res.ok) {
          setChangingServer(false);
          // Refresh so the page re-reads public users / Quick Connect for the
          // newly-connected server; `serverReachable` flips and reveals auth.
          router.refresh();
        } else {
          setError(t("errorUnreachable"));
        }
      });
    },
    [serverInput, router, t],
  );

  const openServerStep = useCallback(() => {
    setServerInput(serverUrl);
    setError(null);
    setChangingServer(true);
  }, [serverUrl]);

  return (
    <div className="animate-jn-up mx-auto flex max-w-[440px] flex-col items-center gap-9 px-6">
      <Logo size={54} wordmarkSize={40} />

      {showServerStep ? (
        /* Server address entry — the welcome step */
        <form className="flex w-full flex-col gap-3" onSubmit={saveServer}>
          <div className="-mt-4 flex flex-col items-center gap-2 text-center">
            <h1 className="text-xl font-extrabold tracking-tight text-bright">
              {t("serverStepTitle")}
            </h1>
            <p className="max-w-[340px] text-[15px] text-muted">
              {t("serverStepSubtitle")}
            </p>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted">
              {t("serverUrl")}
            </span>
            <input
              value={serverInput}
              onChange={(e) => setServerInput(e.target.value)}
              placeholder={t("serverPlaceholder")}
              autoFocus
              inputMode="url"
              autoComplete="url"
              autoCapitalize="none"
              spellCheck={false}
              className="h-12 rounded-[10px] border border-border-strong bg-white/[0.04] px-4 text-[15px] text-text outline-none focus:border-accent"
            />
          </label>
          <button
            type="submit"
            disabled={serverPending || !serverInput.trim()}
            className="mt-1 flex h-12 cursor-pointer items-center justify-center gap-2 rounded-[10px] bg-accent text-[15px] font-extrabold text-on-accent transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Server className="size-[1.1em]" />
            {serverPending ? t("connecting") : t("connect")}
          </button>
          {error && (
            <p className="text-sm font-semibold text-danger-soft" role="alert">
              {error}
            </p>
          )}
          {serverReachable && (
            <button
              type="button"
              onClick={() => {
                setChangingServer(false);
                setError(null);
              }}
              className="mt-1 flex items-center justify-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-bright"
            >
              <ArrowLeft className="size-[1em]" /> {t("back")}
            </button>
          )}
        </form>
      ) : (
        <>
          {/* Profile picker */}
          {mode === "picker" && (
            <>
              <p className="-mt-4 text-[15px] text-muted">{t("whoWatching")}</p>
              <div className="flex max-w-[640px] flex-wrap justify-center gap-[26px]">
                {publicUsers.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => pickProfile(user)}
                    disabled={isPending}
                    className="group flex cursor-pointer flex-col items-center gap-3 transition-transform hover:-translate-y-1 disabled:opacity-60"
                  >
                    <span
                      className="flex size-[76px] items-center justify-center rounded-[18px] text-[28px] font-extrabold text-white outline-offset-[3px] outline-accent transition-[outline] group-hover:outline-[3px]"
                      style={avatarStyle(hueFromString(user.name))}
                    >
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="text-[15px] font-semibold text-bright">
                      {user.name}
                    </span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  setUsername("");
                  setPassword("");
                  setMode("credentials");
                }}
                className="flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-border-strong bg-white/[0.03] px-7 py-3 text-[15px] font-semibold text-text transition-colors hover:bg-white/[0.08]"
              >
                <LogIn className="size-[1.1em]" /> {t("otherAccount")}
              </button>
            </>
          )}

          {/* Manual credentials */}
          {mode === "credentials" && (
            <form
              className="flex w-full flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                submitCredentials(username, password);
              }}
            >
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-muted">
                  {t("username")}
                </span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus={!username}
                  autoComplete="username"
                  className="h-12 rounded-[10px] border border-border-strong bg-white/[0.04] px-4 text-[15px] text-text outline-none focus:border-accent"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-muted">
                  {t("password")}
                </span>
                <input
                  ref={passwordRef}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="h-12 rounded-[10px] border border-border-strong bg-white/[0.04] px-4 text-[15px] text-text outline-none focus:border-accent"
                />
              </label>
              <button
                type="submit"
                disabled={isPending || !username}
                className="mt-1 flex h-12 cursor-pointer items-center justify-center gap-2 rounded-[10px] bg-accent text-[15px] font-extrabold text-on-accent transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <LogIn className="size-[1.1em]" />
                {isPending ? t("signingIn") : t("signIn")}
              </button>
              {publicUsers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMode("picker")}
                  className="mt-1 flex items-center justify-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-bright"
                >
                  <ArrowLeft className="size-[1em]" /> {t("back")}
                </button>
              )}
            </form>
          )}

          {/* Quick Connect */}
          {mode === "quick" && (
            <div className="flex w-full flex-col items-center gap-4">
              <p className="text-center text-[15px] text-muted">
                {t("quickConnectHint")}
              </p>
              <div className="rounded-[14px] border border-border-strong bg-white/[0.04] px-10 py-6 text-center">
                <div className="text-[40px] font-extrabold tracking-[0.15em] text-text tabular-nums">
                  {qcCode}
                </div>
              </div>
              <p className="animate-pulse text-sm text-accent">
                {t("quickConnectWaiting")}
              </p>
              <button
                type="button"
                onClick={cancelQuickConnect}
                className="flex items-center justify-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-bright"
              >
                <ArrowLeft className="size-[1em]" /> {t("cancel")}
              </button>
            </div>
          )}

          {error && (
            <p className="text-sm font-semibold text-danger-soft" role="alert">
              {error}
            </p>
          )}

          {/* Quick Connect entry (hidden while already in quick mode) */}
          {quickConnectEnabled && mode !== "quick" && (
            <button
              type="button"
              onClick={startQuickConnect}
              className="flex items-center gap-2 text-sm font-semibold text-accent transition-colors hover:brightness-110"
            >
              <Smartphone className="size-[1.1em]" /> {t("quickConnect")}
            </button>
          )}

          {/* Connected server line → back to the server step */}
          <button
            type="button"
            onClick={openServerStep}
            className="mt-2 flex items-center gap-2 text-[12.5px] text-dim transition-colors hover:text-muted"
          >
            <Server className="size-[1.1em]" />
            {t("connected", { server: serverName })} · {t("changeServer")}
          </button>
        </>
      )}
    </div>
  );
}
