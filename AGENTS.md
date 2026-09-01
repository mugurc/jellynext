<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project goal: complete Jellyfin coverage

JellyNext aims to be a **complete client that exercises the FULL Jellyfin API** — read AND write. On every feature, ask "does the API expose more here?" and build it: create/update/delete and actions, not just display. Prefer completeness over minimalism; expose the fields and actions the API returns. Add EN/TR i18n for every string and keep `next build`, `tsc`, and `eslint` green.

# Artwork: always fade, never a background image

Every remote image goes through `<Art>` (`src/components/common/art.tsx`), or
`<FadeImg>` when there is no placeholder box to fill — a bare logo, say. Never
paint artwork with a CSS `background-image: url(...)`: a background has no load
event, so it can only pop into place. `<Art>` keeps the placeholder gradient as
the box's own background and fades the real `<img>` in over it once decoded.
Overlays (badges, hover controls, progress bars) go in as `children`.

`MediaCard` is the one deliberate exception: its artwork and bottom wash have to
fade as a single compositing layer or their rounded corners disagree by a
fraction of a pixel. It still fades on the load event — the rule that matters.
