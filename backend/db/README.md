# SwimFest database scripts

Every file here has already been run on the live Supabase database.
They are kept so a **new** database can be built the same way: run them in this
order in **Supabase → SQL Editor** (each is safe to run again).

## 1. Base
1. `schema.sql`: tables, roles, base permissions, sign-up trigger
2. `FIX_SIGNUP.sql`: the working sign-up trigger (replaces the one in schema.sql)
3. `role_policies.sql`: role-based permissions, `my_role()` / `is_staff()`
4. `public_swimmers.sql`: public swimmer directory (names for heat sheets and results)
5. `public_leaderboard.sql`: academy leaderboard
6. `organizers.sql`: organizers and `become_organizer()`
7. `verification_docs.sql`: verification documents and their storage
8. `reopen_requests.sql`: reopen requests and the approve/deny functions
9. `enable_realtime.sql`: live updates on the super admin page
10. `meet_posters_storage.sql`: meet poster storage

## 2. Additions (in the order they were added)
11. `add_created_by_email.sql`: who submitted each item
12. `add_events_offered.sql`: races offered per meet
13. `add_unique_meet_names.sql`: one meet per name
14. `staff_manage_swimmers.sql`: staff can add walk-in swimmers
15. `add_swimmer_verification.sql`: swimmer approval status
16. `add_rejection_notes.sql`: reasons when something is sent back
17. `add_pool_lengths.sql`: 50 m and 25 m pools per meet
18. `rbac_governance.sql`: Owner / Co-Super Admin, assigned meets, audit log, record versions, organizer payouts
19. `team_management.sql`: the Team tab (Owner only)
20. `secure_views.sql`: who may read the swimmer, organizer and reopen-request views
21. `team_members.sql`: separate table of Owner / Co-Super Admins / Admins, kept in step with `profiles` both ways

Staff accounts are created by signing up and then setting the role from the
**Team** tab (or in Supabase). Never put passwords in a file here.
