-- Add email column to profiles table to map auth users to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text UNIQUE;

-- Map existing profiles to their auth emails
UPDATE public.profiles SET email = 'phoneforwatching@gmail.com' WHERE id = '83704966-2ecd-4a08-bfd5-fd3362d81765';
UPDATE public.profiles SET email = 'sinlapinnew2000@gmail.com' WHERE id = '3148805a-fc5a-4b82-9307-6da0917d94b8';
