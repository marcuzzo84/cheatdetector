# Deployment Guide

This guide covers deploying the FairPlay-Scout Dashboard to production environments.

## Prerequisites

- Node.js 18+ and npm 8+
- Supabase project with database configured
- Domain name and SSL certificate
- Environment variables configured

## Environment Setup

### 1. Environment Variables

Create a `.env.production` file:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Optional: Analytics and Monitoring
VITE_ANALYTICS_ID=your-analytics-id
VITE_SENTRY_DSN=your-sentry-dsn
```

### 2. Build Configuration

Update `vite.config.ts` for production:

```typescript
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          router: ['react-router-dom'],
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
```

## Deployment Options

### Option 1: Netlify (Recommended)

1. **Build and Deploy**:
   ```bash
   npm run build
   ```

2. **Netlify Configuration** (`netlify.toml`):
   ```toml
   [build]
     publish = "dist"
     command = "npm run build"

   [[redirects]]
     from = "/*"
     to = "/index.html"
     status = 200

   [build.environment]
     NODE_VERSION = "18"
   ```

3. **Deploy**:
   - Connect your repository to Netlify
   - Set environment variables in Netlify dashboard
   - Deploy automatically on git push

### Option 2: Vercel

1. **Vercel Configuration** (`vercel.json`):
   ```json
   {
     "buildCommand": "npm run build",
     "outputDirectory": "dist",
     "framework": "vite",
     "rewrites": [
       {
         "source": "/(.*)",
         "destination": "/index.html"
       }
     ]
   }
   ```

2. **Deploy**:
   ```bash
   npx vercel --prod
   ```

### Option 3: AWS S3 + CloudFront

1. **Build**:
   ```bash
   npm run build
   ```

2. **Upload to S3**:
   ```bash
   aws s3 sync dist/ s3://your-bucket-name --delete
   ```

3. **CloudFront Configuration**:
   - Set up CloudFront distribution
   - Configure custom error pages for SPA routing
   - Enable compression and caching

## Database Migration

### 1. Run Migrations

Ensure all database migrations are applied:

```bash
# Using Supabase CLI
supabase db push

# Or manually run migration files
```

### 2. Verify Schema

Check that all tables, functions, and policies are correctly deployed:

```sql
-- Verify core tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('players', 'games', 'scores', 'profiles');

-- Verify RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = true;

-- Verify functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_type = 'FUNCTION';
```

## Edge Functions Deployment

### 1. Deploy Functions

```bash
# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy import-games
```

### 2. Set Environment Variables

```bash
# Set secrets for edge functions
supabase secrets set CHESS_COM_API_KEY=your-key
supabase secrets set LICHESS_API_TOKEN=your-token
```

## Performance Optimization

### 1. Database Optimization

```sql
-- Analyze table statistics
ANALYZE;

-- Reindex if needed
REINDEX DATABASE postgres;

-- Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
```

### 2. CDN Configuration

- Enable gzip compression
- Set appropriate cache headers
- Configure browser caching for static assets
- Use WebP images where supported

### 3. Monitoring Setup

```typescript
// Add performance monitoring
if (import.meta.env.PROD) {
  // Initialize Sentry or similar
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: 'production',
  });
}
```

## Security Checklist

### 1. Environment Security

- [ ] All sensitive data in environment variables
- [ ] No hardcoded API keys or secrets
- [ ] HTTPS enforced for all connections
- [ ] Secure headers configured

### 2. Database Security

- [ ] RLS enabled on all tables
- [ ] Service role key secured
- [ ] Database backups configured
- [ ] Connection pooling enabled

### 3. Application Security

- [ ] Content Security Policy configured
- [ ] XSS protection enabled
- [ ] CSRF protection implemented
- [ ] Input validation on all forms

## Monitoring and Logging

### 1. Application Monitoring

```typescript
// Error boundary for production
class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.PROD) {
      Sentry.captureException(error, { extra: errorInfo });
    }
  }
}
```

### 2. Database Monitoring

- Set up alerts for slow queries
- Monitor connection pool usage
- Track RLS policy performance
- Monitor real-time subscription usage

### 3. Performance Metrics

- Core Web Vitals monitoring
- Real-time connection health
- API response times
- Error rates and types

## Backup and Recovery

### 1. Database Backups

```bash
# Automated daily backups
supabase db dump --data-only > backup-$(date +%Y%m%d).sql

# Point-in-time recovery setup
# Configure in Supabase dashboard
```

### 2. File Storage Backups

- Configure S3 bucket versioning
- Set up cross-region replication
- Regular backup verification

## Scaling Considerations

### 1. Database Scaling

- Connection pooling configuration
- Read replicas for analytics queries
- Partitioning for large tables
- Query optimization and indexing

### 2. Application Scaling

- CDN for static assets
- Edge function scaling
- Real-time connection limits
- Rate limiting configuration

## Troubleshooting

### Common Issues

1. **Build Failures**:
   - Check Node.js version compatibility
   - Verify all dependencies are installed
   - Check for TypeScript errors

2. **Database Connection Issues**:
   - Verify environment variables
   - Check RLS policies
   - Validate connection strings

3. **Real-time Issues**:
   - Check WebSocket connections
   - Verify authentication tokens
   - Monitor subscription limits

### Debug Commands

```bash
# Check build output
npm run build 2>&1 | tee build.log

# Test production build locally
npm run preview

# Check bundle size
npx vite-bundle-analyzer dist/assets/*.js
```

## Post-Deployment Verification

### 1. Functional Testing

- [ ] User authentication works
- [ ] Real-time updates functioning
- [ ] File uploads working
- [ ] API integrations operational

### 2. Performance Testing

- [ ] Page load times < 3 seconds
- [ ] Real-time latency < 500ms
- [ ] Database queries < 1 second
- [ ] No memory leaks in long sessions

### 3. Security Testing

- [ ] HTTPS redirects working
- [ ] RLS policies enforced
- [ ] No sensitive data exposed
- [ ] Rate limiting functional

## Maintenance

### Regular Tasks

- Monitor error rates and performance
- Update dependencies monthly
- Review and rotate API keys quarterly
- Database maintenance and optimization
- Security audit and penetration testing

### Update Process

1. Test updates in staging environment
2. Run database migrations
3. Deploy during low-traffic periods
4. Monitor for issues post-deployment
5. Rollback plan ready if needed

For additional support, refer to the troubleshooting guide or contact the development team.