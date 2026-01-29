# AI-Powered Supplementary Learning Platform

A modern, full-stack learning platform built for university courses with AI-powered features, role-based access control, and intelligent content management.

## 🚀 Features

- **Role-Based Authentication**: Separate login portals for students and instructors/TAs
- **AI-Powered Learning**: Course-specific AI tutor for instant answers and explanations
- **Organized Content**: Centralized access to slides, PDFs, lab code, and course materials
- **Intelligent Search**: AI-powered search across all course content
- **Modern UI**: Production-ready, responsive interface with smooth animations
- **Secure**: Row-level security, session management, and role-based access control

## 🏗️ Tech Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI
- **Icons**: Lucide React

### Backend
- **Framework**: FastAPI (Python)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Real-time**: Supabase Realtime

### AI/ML
- **Framework**: LangChain
- **Vector Store**: (To be configured)
- **Embeddings**: (To be configured)

## 📁 Project Structure

```
Hackathon_temp/
├── frontend/              # Next.js application
│   ├── src/
│   │   ├── app/          # App router pages
│   │   │   ├── auth/     # Authentication pages
│   │   │   │   ├── login/              # Student login
│   │   │   │   ├── admin/login/        # Admin login
│   │   │   │   └── register/           # Registration
│   │   │   ├── app/      # Protected app routes
│   │   │   │   ├── page.tsx            # Student dashboard
│   │   │   │   └── admin/page.tsx      # Admin dashboard
│   │   │   └── api/      # API routes
│   │   ├── components/   # React components
│   │   └── lib/          # Utilities & configs
│   │       ├── supabase/ # Supabase clients
│   │       ├── auth/     # Auth utilities
│   │       └── types.ts  # TypeScript types
│   └── public/           # Static assets
│
├── fastapi/              # FastAPI backend
│   ├── main.py          # API entry point
│   └── requirements.txt  # Python dependencies
│
└── database/             # Database migrations
    ├── 01_create_profiles.sql    # Profile schema
    ├── 02_configure_admins.sql   # Admin setup
    ├── 03_fix_full_name.sql      # Metadata extraction
    └── README.md                 # DB setup guide
```

## 🛠️ Setup Instructions

### Prerequisites
- Node.js 18+ and npm
- Python 3.8+
- Supabase account

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd Hackathon_temp
```

### 2. Frontend Setup

```bash
cd frontend
npm install
```

Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
PRIVATE_SUPABASE_SERVICE_KEY=your-service-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_PRODUCTNAME=LearnHub
```

Run development server:
```bash
npm run dev
```

### 3. Backend Setup

```bash
cd fastapi
python -m venv venv

# Windows
venv\Scripts\activate

# Mac/Linux
source venv/bin/activate

pip install -r requirements.txt
python main.py
```

### 4. Database Setup

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run scripts in order:
   - `database/01_create_profiles.sql` - Creates profiles table and trigger
   - `database/02_configure_admins.sql` - Configures admin emails
   - `database/03_fix_full_name.sql` - Fixes metadata extraction

4. Disable email confirmation (for development):
   - Go to Authentication → Settings
   - Uncheck "Enable email confirmations"

See `database/README.md` for detailed instructions.

## 👥 User Roles

### Student
- Access course materials
- Chat with AI tutor
- Search content
- View resources

### Admin (Instructor/TA)
- Upload course materials
- Manage content
- View analytics
- Admin dashboard access

## 🔐 Authentication Flow

### Student Registration
1. Visit `/auth/register`
2. Fill in details (full name, email, password)
3. Automatically assigned `student` role
4. Login at `/auth/login`
5. Redirected to `/app` (student dashboard)

### Admin Setup
1. Add admin email to database function (see `database/02_configure_admins.sql`)
2. Register at `/auth/register` with admin email
3. Automatically assigned `admin` role
4. Login at `/auth/admin/login`
5. Redirected to `/app/admin` (admin dashboard)

### Security Features
- Row-level security (RLS)
- Server-side role verification
- Separate login endpoints
- Session management
- Password strength requirements

## 📚 Documentation

- **Setup Guide**: `database/README.md`
- **Role System**: Check artifacts for `ROLE_SYSTEM_EXPLAINED.md`
- **Migration Guide**: Check artifacts for `supabase_migration_guide.md`
- **Implementation**: Check artifacts for `walkthrough.md`

## 🚀 Deployment

### Frontend (Vercel)
```bash
cd frontend
vercel
```

### Backend (Your choice)
- Railway
- Render
- Heroku
- Google Cloud Run

## 🔧 Configuration

### Adding Admin Emails
Edit and run `database/02_configure_admins.sql`:
```sql
admin_emails TEXT[] := ARRAY[
  'admin@university.edu',
  'your-email@example.com'
];
```

### Manually Promote User to Admin
```sql
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'user@example.com';
```

## 🎨 Features Showcase

### Landing Page
- Modern gradient design
- Feature highlights
- Clear CTAs for students and instructors

### Authentication
- Production-ready UI
- Password strength indicators
- Show/hide password toggle
- Role-based redirects

### Dashboards
- **Student**: Course stats, resources, AI chat access
- **Admin**: Content management, analytics, student overview

## 🧪 Testing

### Test Student Flow
1. Register at `/auth/register`
2. Login at `/auth/login`
3. Check dashboard at `/app`

### Test Admin Flow
1. Configure admin email in database
2. Register with that email
3. Login at `/auth/admin/login`
4. Verify redirect to `/app/admin`

### Verify Role Protection
1. Login as student
2. Try accessing `/app/admin` → should redirect to `/app`

## 📝 Environment Variables

Never commit these to Git! Always use `.env.template` as reference.

**Required:**
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `PRIVATE_SUPABASE_SERVICE_KEY` - Supabase service role key (keep secret!)

**Optional:**
- `NEXT_PUBLIC_SITE_URL` - Your site URL (for production)
- `NEXT_PUBLIC_PRODUCTNAME` - Product name (default: LearnHub)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed for hackathon use.

## 🙏 Acknowledgments

- Built with Supabase for backend infrastructure
- UI components from Radix UI
- Icons from Lucide React
- Styled with Tailwind CSS

## 📞 Support

For setup issues or questions, check the documentation in the `database/` folder or review the implementation artifacts.

---

**Built for university courses • Powered by AI • Designed for learning**
