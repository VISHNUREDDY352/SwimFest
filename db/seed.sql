-- ============================================================
-- SwimFest — Seed Data
-- Run this AFTER schema.sql in Supabase SQL Editor.
-- ============================================================

-- ── ACADEMIES ───────────────────────────────────────────────
insert into academies (academy_name, address_line, city, state, contact_person, phone_number, email_id, pool_length, lane_count, pool_type, registration_no, status)
values
  ('Chennai Swim Club',      '14, Velachery Main Road',            'Chennai',        'Tamil Nadu', 'R. Sundaram',      '+91 98400 12345', 'info@chennaiswim.com',        '50m', 8, 'Indoor Heated Pool',       'TN-REG-2024-001', 'APPROVED_ACTIVE'),
  ('SRM Aquatics Academy',   'SRM University Campus, Kattankulathur','Kattankulathur','Tamil Nadu', 'Dr. M. Arumugam',  '+91 94440 67890', 'sports@srm.edu',              '50m', 8, 'Outdoor Competition Pool', 'TN-REG-2024-002', 'APPROVED_ACTIVE'),
  ('Aqua Stars Coimbatore',  'Race Course Road, Coimbatore',       'Coimbatore',     'Tamil Nadu', 'P. Krishnamurthy', '+91 97890 54321', 'aquastars.cbe@gmail.com',     '25m', 6, 'Indoor Pool',              'TN-REG-2024-003', 'APPROVED_ACTIVE'),
  ('SDAT Academy Chennai',   'SDAT Aquatic Complex, Velachery',    'Chennai',        'Tamil Nadu', 'S. Balakrishnan',  '+91 94450 11223', 'sdat.aquatics@tn.gov.in',     '50m', 8, 'Olympic Standard Pool',    'TN-REG-2024-004', 'APPROVED_ACTIVE'),
  ('Madurai Aquatics',       'Near Periyar Bus Stand, Madurai',    'Madurai',        'Tamil Nadu', 'T. Ragunathan',    '+91 93456 78901', 'madurai.aquatics@gmail.com',  '25m', 6, 'Outdoor Pool',             'TN-REG-2024-005', 'APPROVED_ACTIVE'),
  ('Trichy Swim Academy',    'Woraiyur, Tiruchirappalli',          'Trichy',         'Tamil Nadu', 'N. Mohanraj',      '+91 98765 43211', 'trichyswim@gmail.com',        '25m', 6, 'Community Pool',           'TN-REG-2024-006', 'PENDING_VERIFICATION')
on conflict (academy_name) do nothing;

-- ── COACHES (linked to academies by name lookup) ────────────
insert into coaches (full_name, gender, date_of_birth, mobile_number, email_id, academy_id, designation, certifications, experience_years, status)
select v.full_name, v.gender, v.dob::date, v.mobile, v.email,
       a.academy_id, v.designation, v.certs::jsonb, v.exp, 'APPROVED_ACTIVE'
from (values
  ('K. Ramesh',       'Male',   '1982-06-14', '+91 98400 11111', 'k.ramesh@chennaiswim.com', 'Chennai Swim Club',    'Head Coach',      '["ASCA Level 3","SFI Certified"]', 12),
  ('S. Priya',        'Female', '1990-03-22', '+91 98400 22222', 's.priya@chennaiswim.com',  'Chennai Swim Club',    'Assistant Coach', '["NIS Diploma","World Aquatics Cert"]', 7),
  ('V. Anand',        'Male',   '1978-11-05', '+91 94440 33333', 'v.anand@srm.edu',          'SRM Aquatics Academy', 'Head Coach',      '["ASCA Level 4","NIS Diploma"]', 18),
  ('M. Vijay',        'Male',   '1985-09-17', '+91 97890 44444', 'mvijay@aquastars.com',     'Aqua Stars Coimbatore','Head Coach',      '["ASCA Level 2","First Aid/CPR"]', 10),
  ('A. Selvakumar',   'Male',   '1975-07-08', '+91 94450 66666', 'selva@sdat.gov.in',        'SDAT Academy Chennai', 'Head Coach',      '["ASCA Level 5","NIS Diploma","World Aquatics Cert"]', 22),
  ('S. Murugan',      'Male',   '1980-12-25', '+91 93456 88888', 'murugan@madurai.com',      'Madurai Aquatics',     'Head Coach',      '["SFI Certified","NIS Diploma"]', 15)
) as v(full_name, gender, dob, mobile, email, academy_name, designation, certs, exp)
join academies a on a.academy_name = v.academy_name;

-- ── TOURNAMENTS ─────────────────────────────────────────────
insert into tournaments (title, host_organization, state, city, venue_name, pool_length, lane_count, start_date, end_date, registration_deadline, reg_fee_amount, relay_add_on_fee, allow_swim_up, non_medalist_rule, gateway_option, status)
values
  ('Golden Non-Medalist Championship 2026', 'SRM University',            'Tamil Nadu', 'Chennai', 'SRM University Pool, Kattankulathur', '50m', 8, '2026-10-15','2026-10-16','2026-09-30 23:59:00+05:30', 800.00, 300.00, false, true,  'OPTION_A_PLATFORM_GATEWAY', 'PUBLISHED'),
  ('Tamil Nadu State Junior Aquatic Meet 2026','SDAT',                   'Tamil Nadu', 'Chennai', 'SDAT Aquatic Complex, Velachery',    '50m', 8, '2026-11-05','2026-11-07','2026-10-20 23:59:00+05:30', 500.00, 300.00, true,  true,  'OPTION_A_PLATFORM_GATEWAY', 'PUBLISHED'),
  ('All-India Inter-Club Swimming Meet 2026','SDAT',                     'Tamil Nadu', 'Chennai', 'SDAT Aquatic Complex, Velachery',    '50m', 8, '2026-06-20','2026-06-22','2026-06-01 23:59:00+05:30', 600.00, 300.00, false, false, 'OPTION_A_PLATFORM_GATEWAY', 'COMPLETED')
on conflict do nothing;
