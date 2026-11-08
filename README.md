# SwimFest — Swimming Competition Management Platform

A static HTML/CSS/JS web app backed by **Supabase** (Postgres + Auth). It manages
swimming tournaments end to end: registration → approval → roster lock → heat
generation → live results → public leaderboards.

Live repo: https://github.com/VISHNUREDDY352/SwimFest

---

## Roles

| Role | How they get it | Lands on after login |
|------|-----------------|----------------------|
| **Swimmer / Parent** | Public signup | Homepage (`index.html`) |
| **Organizer** | Public signup (or a swimmer can also become one with the same email) | `orgdashboard.html` |
| **Admin** (`event_manager`) | Sign up, then the Owner sets the role in the **Team** tab | `admin.html` |
| **Super Admin** (Owner or Co-Super Admin) | Sign up, then the Owner sets the role in the **Team** tab | `superadmin.html` |

- **Login is a single form** — no role picker. You're routed automatically by your
  account's role (read from the `profiles` table).
- **Login is mandatory** for staff/admin pages; the login page never auto-forwards.

---

## Page map

### Public
- `index.html` — homepage, live tournament listings
- `event.html` — tournament detail (`?tournament=<title>` or `?id=<uuid>`)
- `register.html` — registration wizard (login required)
- `search.html` — swimmer directory search
- `leaderboard.html` — academy points leaderboard
- `heatsheets.html` — published heat sheets / schedule
- `academy.html` — academy & coach directory
- `profile.html` — swimmer profile
- `login.html` — single login + signup (swimmer / organizer)

### Organizer
- `orgdashboard.html` — their hosted meets + metrics
- `orgcreate.html` — create a meet
- `orgprofile.html` — organizer profile
- `orgracecontrol.html` — poolside ops for their meets

### Admin (`event_manager`)
- `admin.html` — Admin console: my meets + approval queues
- `playerlist.html` — Master Player List (roster, walk-ins, spreadsheet import, lock)
- `heatgen.html` — heat generation → `heat_rows` (entries template + import)
- `results.html` — live result entry → `heat_rows`
- `orgracecontrol.html` — poolside ops (shared with organizers)

### Super Admin
- `superadmin.html` — approvals, verification, reopen requests, metrics, notices
- `saoverride.html` — universal override engine

Old links `addevent`, `racecontrol` and `emdashboard` redirect (see `vercel.json`).

---

## Data flow

```
Create meet (orgcreate)
   → Super Admin approves (superadmin)           [super_admin's own meets auto-publish]
   → Admin locks roster (playerlist)              → tournament LOCKED
   → Heat Gen produces heats (heatgen)            → heat_rows
   → Results enters times (results)               → heat_rows (COMPLETED)
   → Public sees it (heatsheets, leaderboard, event)

Organizer reopen: request on a completed meet → super admin approves → back to PUBLISHED
```

---

## Setup (Supabase)

1. Create a Supabase project. Put its URL + anon key in `supabase.js`.
2. In the SQL Editor, run the files in `backend/db/` **in the order listed in
   [`backend/db/README.md`](backend/db/README.md)**.
3. **Auth → URL Configuration**: set Site URL + Redirect URLs to your deployed URL.
4. **Auth → Providers**: turn OFF "Confirm email" for instant logins (or leave on).
5. Promote your account to super admin if needed:
   ```sql
   update public.profiles set role = 'super_admin'
   where id = (select id from auth.users where email = 'you@email.com');
   ```

### Staff accounts
Staff sign up like anyone else; the Owner then gives them a role in the
super admin page's **Team** tab. Never write passwords in this repository.

---

## Frontend structure

Plain HTML + JavaScript, no build step. Every page loads the shared core first:

| File | What it does | Pattern |
|------|--------------|---------|
| `core/sf.css` | Design tokens, components (buttons, fields, tables, tabs, dialogs, toasts, ⓘ button), phone layouts. Old page variables point at the tokens. WCAG AA contrast, visible focus, 44 px touch targets, no web-font download. | — |
| `core/sf.js` | `SF.esc`, `SF.fmt`, `SF.toast`, `SF.csv`, `SF.db` (one Supabase client, `fetchAll` past the 1000-row limit, `inChunks` for long id lists) | Singleton, Observer (`SF.bus`) |
| `core/icons.js` | Inline SVG icons; swaps every `<i class="fas fa-…">` (replaces Font Awesome) | — |
| `core/components.js` | `SF.Dialog`, `SF.Info` (ⓘ help), `SF.Search` + `SF.TabbedSearch` (search follows the tab), `SF.Tabs` (ARIA + arrow keys), `SF.Table`, `SF.Importer` | Strategy, Factory, Template Method |
| `core/help.js` | Text for every ⓘ button: what the tab is, what you can do, the rules | Registry |
| `core/repos.js` | Data access for meets, entries, heats, results, imports; uses the one-call database functions and falls back if they aren't installed yet | Repository |
| `core/heatengine.js` | Seeding (standard / circle), centre-out lanes for 6/8/10 lanes, ≥3 swimmers per heat, relay teams, event order, per-pool schedule | Strategy |
| `core/entryimport.js` | Spreadsheet import of swimmers + races with a downloadable template (.xlsx / .csv) | Template Method |

**Search follows the tab.** Each tab declares its key field (swimmer name or ID,
coach name, academy name, meet title); matches on that field rank first, the
placeholder changes with the tab, and each tab remembers its own search.

**Entries template.** On Heat generation (*Entries template*) or the Player list
(*Import from spreadsheet*): one row per swimmer per race —
`Full name, Gender, Date of birth (YYYY-MM-DD), Parent phone, Academy, Race, Seed time`.
Every row is checked and previewed; if any row has a problem nothing is saved.
Import is possible while registration is open or closed (before the list is locked).

## Project Structure

```
SwimFest/
├── frontend/             # Client-side web application
│   ├── index.html        # Homepage
│   ├── *.html            # Role pages (organizer, admin, swimmer, etc.)
│   ├── core/             # Shared design system, components, data access (see above)
│   ├── *.css             # Page stylesheets
│   ├── *.js              # Client scripts & Supabase SDK config
│   └── images/           # Static media assets
├── backend/              # Node.js + Express API server & Database scripts
│   ├── src/
│   │   ├── server.js     # Express server entry point (serves API + UI)
│   │   ├── config/       # Supabase client configuration
│   │   └── routes/       # REST API endpoints (tournaments, swimmers, leaderboard, heats)
│   ├── db/               # PostgreSQL / Supabase SQL schemas, policies, & seeds
│   ├── .env              # Backend environment variables
│   └── package.json      # Backend dependencies
├── vercel.json           # Vercel deployment configuration
└── package.json          # Root scripts
```

## Run locally

### Option 1: Full-Stack Express Server (Frontend + API)
```bash
npm start
```
- Frontend UI: http://localhost:5000/index.html
- Backend API: http://localhost:5000/api/health

### Option 2: Frontend-only static server
```bash
npm run frontend
# or: python -m http.server 3000 --directory frontend
```
Then open http://localhost:3000/index.html
(hard-refresh with Ctrl+Shift+R — dev server sends no cache headers).

## Deploy
Pushes to `main` auto-deploy on Vercel (`outputDirectory: "frontend"`). `vercel.json` sets no-cache headers for
HTML so the live site is never stale.

---

## Security notes
- The Supabase **anon key** in `supabase.js` is public by design; data is protected
  by Row Level Security (`db/role_policies.sql`).
- `guard.js` is a client-side UI guard on staff pages; the real enforcement is RLS.
- Users cannot escalate their own role (the profiles self-update policy blocks it);
  swimmer→organizer upgrade uses a controlled `become_organizer()` function.
