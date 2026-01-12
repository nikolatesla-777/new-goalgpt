# Staging Environment Variables
# Copy values from Supabase staging project

# Database Configuration (Supabase Staging)
DB_HOST=aws-X-eu-central-1.pooler.supabase.com
DB_PORT=6543
DB_NAME=postgres
DB_USER=postgres.XXXXXXXXXXXXXXXX
DB_PASSWORD=your_staging_password_here

# Full Database URL
DATABASE_URL=postgres://postgres.XXXXXXXXXXXXXXXX:your_staging_password_here@aws-X-eu-central-1.pooler.supabase.com:6543/postgres

# Server Configuration
PORT=3000
NODE_ENV=staging

# TheSports API (same as production)
THESPORTS_API_BASE_URL=https://api.thesports.com/v1/football
THESPORTS_API_SECRET=3205e4f6efe04a03f0055152c4aa0f37
THESPORTS_API_USER=goalgpt

# JWT Secret (different from production)
JWT_SECRET=staging_jwt_secret_for_testing_only
JWT_EXPIRES_IN=7d

# API Security
PREDICTION_API_KEY=staging_api_key_for_testing
FRONTEND_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
