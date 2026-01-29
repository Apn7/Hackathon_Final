-- UPDATE: Fix full_name extraction from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role TEXT := 'student';
  user_full_name TEXT;
BEGIN
  -- Check if email is in admin list
  IF NEW.email = 'admin@university.edu' THEN
    user_role := 'admin';
  END IF;

  -- Extract full_name from user metadata
  user_full_name := NEW.raw_user_meta_data->>'full_name';

  INSERT INTO public.profiles (id, email, role, full_name)
  VALUES (NEW.id, NEW.email, user_role, user_full_name);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- You can also manually update the admin emails here if needed
-- Just replace this array with your admin emails and re-run
