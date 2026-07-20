/** Primary top-nav destinations. Labels resolve from the `Nav` i18n namespace. */
export const NAV_ITEMS = [
  { key: "home", href: "/home" },
  { key: "discover", href: "/discover" },
  { key: "movies", href: "/movies" },
  { key: "series", href: "/tv" },
  { key: "music", href: "/music" },
  { key: "live", href: "/live" },
  { key: "mystuff", href: "/my-stuff" },
] as const;

export type NavKey = (typeof NAV_ITEMS)[number]["key"];
