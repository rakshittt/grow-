-- Creates a confirmed user; the handle_new_user() trigger will
-- auto-create their agency + profile row.
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  role,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'admin@test.com',
  crypt('Test1234!', gen_salt('bf')),
  now(),                                          -- email already confirmed
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Test Admin"}',
  now(),
  now(),
  'authenticated',
  '', '', '', ''
);