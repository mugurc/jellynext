<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project goal: complete Jellyfin coverage

JellyNext aims to be a **complete client that exercises the FULL Jellyfin API** — read AND write. On every feature, ask "does the API expose more here?" and build it: create/update/delete and actions, not just display. Prefer completeness over minimalism; expose the fields and actions the API returns. Add EN/TR i18n for every string and keep `next build`, `tsc`, and `eslint` green.
