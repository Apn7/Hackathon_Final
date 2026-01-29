-- Add more admin emails here as needed
-- Execute this script to configure admin emails after creating the profiles table

-- Update existing users or add new admin emails to the check
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role TEXT := 'student';
  admin_emails TEXT[] := ARRAY[
    'admin@university.edu',
    'instructor@university.edu',
    'ta@university.edu'
  ];
BEGIN
  -- Check if email is in admin list
  IF NEW.email = ANY(admin_emails) THEN
    user_role := 'admin';
  END IF;

  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, user_role);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- If you need to manually promote a user to admin:
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'their-email@example.com';
