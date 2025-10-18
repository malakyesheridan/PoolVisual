# Environment Variables for Vercel Deployment

## Required Environment Variables

### Database Configuration
- `DATABASE_URL`: Your Neon PostgreSQL connection string
  - Format: `postgresql://username:password@host:port/database?sslmode=require`

### Security
- `SESSION_SECRET`: A secure random string (minimum 32 characters)
- `JWT_SECRET`: A secure random string (minimum 32 characters)

### Application URLs (Vercel will set these automatically)
- `APP_BASE_URL`: Will be set to your Vercel domain
- `API_BASE_URL`: Will be set to your Vercel domain + /api

### Business Settings
- `DEFAULT_CURRENCY`: Currency code (e.g., AUD, USD)
- `DEFAULT_TAX_RATE`: Tax rate as decimal (e.g., 0.10 for 10%)
- `DEFAULT_DEPOSIT_PERCENTAGE`: Deposit percentage as decimal (e.g., 0.30 for 30%)

### Feature Flags
- `VITE_PV_UNDERWATER_V20`: Set to "true" to enable underwater effects
- `VITE_PV_PRECISE_MASKS`: Set to "true" to enable precision mask tools
- `VITE_PV_ASSET_LIBRARY`: Set to "true" to enable asset library
- `VITE_PV_POOL_TEMPLATES`: Set to "true" to enable template system

### Development Mode
- `PV_REQUIRE_DB`: Set to "false" for production deployment

## Setting Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to Settings > Environment Variables
3. Add each variable with the appropriate value
4. Make sure to set them for Production, Preview, and Development environments

## Important Notes

- Never commit your actual `.env` file to Git
- Use Vercel's environment variable interface for production secrets
- The `DATABASE_URL` should be your actual Neon connection string
- Generate secure random strings for `SESSION_SECRET` and `JWT_SECRET`
