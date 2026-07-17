"use client";

import { createContext, useContext, type ReactNode } from "react";

export interface CurrentUser {
  userId: string;
  userName: string;
  isAdmin: boolean;
  serverUrl: string;
}

const CurrentUserContext = createContext<CurrentUser | null>(null);

/** Provides the authenticated user, hydrated from the server session cookie. */
export function CurrentUserProvider({
  user,
  children,
}: {
  user: CurrentUser;
  children: ReactNode;
}) {
  return (
    <CurrentUserContext.Provider value={user}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser(): CurrentUser {
  const user = useContext(CurrentUserContext);
  if (!user) {
    throw new Error("useCurrentUser must be used within CurrentUserProvider");
  }
  return user;
}
