# Database Setup Instructions

## Step 1: Create Profiles Table

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `01_create_profiles.sql`
4. Click **Run** to execute

This will create:
- `profiles` table with role-based access
- Automatic trigger to create profiles on user signup
- Row-level security policies

## Step 2: Configure Admin Emails

1. Open `02_configure_admins.sql`
2. **Edit the admin_emails array** to add your admin email addresses:
   ```sql
   admin_emails TEXT[] := ARRAY[
     'your-admin@university.edu',
     'instructor@university.edu'
   ];
   ```
3. Copy and paste the updated script into Supabase SQL Editor
4. Click **Run** to execute

## Step 3: Verify Setup

Run this query to check the setup:
```sql
SELECT * FROM public.profiles;
```

## Manual Admin Promotion

To manually promote an existing user to admin:
```sql
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'their-email@example.com';
```

## Important Notes

- Admin role is determined by email address
- All new registrations default to 'student' role
- Admin emails must be configured in the database function
- Admins must register with their designated email address
