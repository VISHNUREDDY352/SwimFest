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
| **Event Manager (EM)** | Provisioned by staff (`seed_staff.sql`) | `emdashboard.html` |
| **Super Admin** | Provisioned by staff / promoted via SQL | `superadmin.html` |

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
2. In the SQL Editor, run these files **in order** (see `db/SETUP_ALL.sql`):
   `schema` → `seed` → `role_policies` → `public_swimmers` → `public_leaderboard`
   → `organizers` → `verification_docs` → `reopen_requests`
   (optional: `seed_heats`, `seed_staff`)
3. **Auth → URL Configuration**: set Site URL + Redirect URLs to your deployed URL.
4. **Auth → Providers**: turn OFF "Confirm email" for instant logins (or leave on).
5. Promote your account to super admin if needed:
   ```sql
   update public.profiles set role = 'super_admin'
   where id = (select id from auth.users where email = 'you@email.com');
   ```

### Built-in staff credentials (after running `seed_staff.sql`)
- Event Manager: `thangavishnuvardhanreddy@gmail.com` / `vishnu@123`
- Super Admin: `superadmin@swimfest.in` / `SwimFest@2026`

If the direct SQL insert into `auth.users` errors (version-dependent), create the
user via **Authentication → Users → Add user** (Auto Confirm) and then run the
role-update statement above.

---

## Run locally

```
python -m http.server 3000
```
Then open http://localhost:3000/index.html
(hard-refresh with Ctrl+Shift+R — the dev server sends no cache headers).

## Deploy
Pushes to `main` auto-deploy on Vercel. `vercel.json` sets no-cache headers for
HTML so the live site is never stale.

---

## Security notes
- The Supabase **anon key** in `supabase.js` is public by design; data is protected
  by Row Level Security (`db/role_policies.sql`).
- `guard.js` is a client-side UI guard on staff pages; the real enforcement is RLS.
- Users cannot escalate their own role (the profiles self-update policy blocks it);
  swimmer→organizer upgrade uses a controlled `become_organizer()` function.
