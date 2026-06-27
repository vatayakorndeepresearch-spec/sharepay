-- Fix: Google login returns 500 unexpected_failure on first sign-in.
--
-- Cause: the AFTER INSERT trigger handle_new_user() on auth.users threw an
-- error while creating the public.profiles row (PK collision with an orphan
-- profile, or the UNIQUE(email) constraint). When that trigger errors, the
-- whole auth user-creation transaction rolls back and GoTrue returns
--   {"code":500,"error_code":"unexpected_failure",...}
--
-- This rewrites the trigger to be resilient:
--   * also stores email (kept in sync with auth.users)
--   * ON CONFLICT (id) updates instead of crashing on an existing profile
--   * any unexpected error is caught and logged, never blocks the login

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (
    new.id,
    COALESCE(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    new.email
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name);

  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    -- Never let profile creation block authentication.
    RAISE WARNING 'handle_new_user failed for % (%): %', new.id, new.email, SQLERRM;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
