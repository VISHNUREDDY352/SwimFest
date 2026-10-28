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

### Event Manager
- `emdashboard.html` — internal meets pipeline
- `addevent.html` — create an internal event
- `admin.html` — Master Player List (roster + lock)
- `heatgen.html` — heat generation → `heat_rows`
- `results.html` — live result entry → `heat_rows`
- `racecontrol.html` — poolside ops

### Super Admin
- `superadmin.html` — approvals, verification, reopen requests, metrics, notices
- `saoverride.html` — universal override engine

### Utility
- `apiref.html` — API docs · `dbtest.html` — DB connection test

---

## Data flow

```
Create meet (addevent / orgcreate)
   → Super Admin approves (superadmin)           [super_admin's own meets auto-publish]
   → EM locks roster (admin)                      → tournament LOCKED
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

## Project Structure

```
SwimFest/
├── frontend/             # Client-side web application
│   ├── index.html        # Homepage
│   ├── *.html            # Role pages (organizer, admin, swimmer, etc.)
│   ├── *.css             # Stylesheets
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
