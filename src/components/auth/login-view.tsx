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

  // ── Server switcher ──────────────────────────────────────────────
  const [showServer, setShowServer] = useState(!serverReachable);
  const [serverInput, setServerInput] = useState(serverUrl);
  const [serverPending, startServerTransition] = useTransition();

  function saveServer() {
    setError(null);
    startServerTransition(async () => {
      const res = await setServerUrlAction(serverInput);
      if (res.ok) {
        setShowServer(false);
        router.refresh();
      } else {
        setError(t("errorUnreachable"));
      }
    });
  }

  return (
    <div className="animate-jn-up mx-auto flex max-w-[440px] flex-col items-center gap-9 px-6">
      <Logo size={54} wordmarkSize={40} />

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

      {/* Server line + switcher */}
      <div className="mt-2 flex flex-col items-center gap-2">
        {!showServer ? (
          <button
            type="button"
            onClick={() => setShowServer(true)}
            className="flex items-center gap-2 text-[12.5px] text-dim transition-colors hover:text-muted"
          >
            <Server className="size-[1.1em]" />
            {serverReachable
              ? t("connected", { server: serverName })
              : t("errorUnreachable")}
          </button>
        ) : (
          <div className="flex w-full max-w-[440px] items-center gap-2">
            <input
              value={serverInput}
              onChange={(e) => setServerInput(e.target.value)}
              placeholder={t("serverUrl")}
              className="h-10 flex-1 rounded-[9px] border border-border-strong bg-white/[0.04] px-3 text-sm text-text outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={saveServer}
              disabled={serverPending || !serverInput}
              className="h-10 cursor-pointer rounded-[9px] bg-accent px-4 text-sm font-bold text-on-accent transition-[filter] hover:brightness-110 disabled:opacity-60"
            >
              {t("connect")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
