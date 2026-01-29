
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

print(f"URL: {url}")
# Mask key for printing
safe_key = key[:10] + "..." + key[-5:] if key else "None"
print(f"Key: {safe_key}")

try:
    print("Attempting to connect with SERVICE_ROLE_KEY...")
    supabase = create_client(url, key)
    # Try a simple operation. Auth.admin.list_users() requires service role
    print("Client created. Fetching users...")
    response = supabase.auth.admin.list_users(page=1, per_page=1)
    print("Success!")
    print(response)
except Exception as e:
    print(f"Error with SERVICE_ROLE_KEY: {e}")

print("-" * 20)

anon_key = os.environ.get("SUPABASE_ANON_KEY")
safe_anon = anon_key[:10] + "..." + anon_key[-5:] if anon_key else "None"
print(f"Anon Key: {safe_anon}")

try:
    print("Attempting to connect with ANON_KEY...")
    supabase_anon = create_client(url, anon_key)
    print("Client created.")
    # Anon key might not be able to list users, but let's see if it errors on init/connect
    # or just try a public table
    print("Testing connection (fetching settings?)...")
    # Just checking if client creation threw
    print("Client creation success (lazy).")
except Exception as e:
    print(f"Error with ANON_KEY: {e}")
