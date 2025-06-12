# FairPlay-Scout Dashboard

A real-time chess anti-cheat monitoring dashboard built with React, TypeScript, and Supabase.

## 🚀 Features

### Real-time Monitoring
- **Live Score Stream**: Real-time updates as new game analysis results arrive
- **Live KPI Cards**: Automatically updating metrics for games analyzed, suspicion rates, and average Elo
- **Live Suspicion Chart**: Continuous chart updates with `live: true` behavior using Supabase realtime
- **Live High-Risk Games Table**: Instant notifications for games with suspicion level ≥ 80%

### Database Integration
- **Supabase Backend**: PostgreSQL database with Row Level Security (RLS)
- **Real-time Subscriptions**: WebSocket connections for live data updates
- **Optimized Queries**: Efficient aggregation functions and materialized views
- **Performance Indexes**: Optimized database indexes for fast queries

### Analytics & Visualization
- **Suspicion Trends**: 30-day historical analysis with daily aggregation
- **Player Profiles**: Detailed analysis with accuracy heatmaps and game history
- **Interactive Charts**: Hover tooltips and live update indicators
- **Performance Metrics**: Engine match percentages, ML probabilities, and suspicion levels

### Security & Authentication
- **Row Level Security**: Database-level access control
- **Real-time Authentication**: Secure WebSocket connections
- **API Rate Limiting**: Configurable request limits
- **Environment Variables**: Secure configuration management

## 🏗️ Architecture

### Frontend Stack
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Lucide React** for icons
- **Vite** for development and building

### Backend Stack
- **Supabase** (PostgreSQL + Real-time + Auth)
- **Database Functions** for complex queries
- **Triggers & Notifications** for real-time updates
- **Views & Indexes** for performance optimization

### Database Schema
```sql
-- Core tables
players (id, hash, elo, created_at)
games (id, player_id, site, pgn_url, date, result, created_at)
scores (id, game_id, match_engine_pct, ml_prob, suspicion_level, created_at)

-- Aggregated views
v_daily_suspicion (bucket, rate, volume)

-- Functions
get_dashboard_kpis() -> KPI metrics
get_suspicion_trends(days) -> Historical trends
get_recent_high_risk_games(limit) -> Latest suspicious games
```

## 🔧 Setup & Development

### Prerequisites
- Node.js 18+
- Supabase account
- Environment variables configured

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd fairplay-scout-dashboard

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Run database migrations
# (Migrations are automatically applied via Supabase)

# Start development server
npm run dev
```

### Environment Variables
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 📊 Live Data Features

### Real-time Chart Updates
The suspicion chart uses Supabase's realtime publication system:
- View marked as part of publication with `live: true` behavior
- Automatic updates when new scores are inserted
- Visual indicators for live data points
- Connection status monitoring

### Live KPI Monitoring
- **Games 24h**: Real-time count of analyzed games
- **Suspect %**: Live calculation of high-risk game percentage
- **Avg Elo**: Dynamic average Elo calculation
- **Active Players**: Real-time player activity tracking

### Performance Optimizations
- **Efficient Triggers**: Minimal overhead for real-time notifications
- **Optimized Indexes**: Fast queries for dashboard components
- **Smart Caching**: Automatic cache invalidation on data changes
- **Minimal Re-renders**: React hooks optimized for performance

## 🔒 Security

### Database Security
- Row Level Security (RLS) enabled on all tables
- Authenticated user policies for data access
- Service role policies for administrative operations
- Secure function execution with `SECURITY DEFINER`

### Real-time Security
- Authenticated WebSocket connections
- Channel-level access control
- Secure notification system
- Rate limiting on subscriptions

## 🚀 Deployment

### Build for Production
```bash
npm run build
```

### Deploy to Netlify/Vercel
The application is optimized for static hosting with:
- Environment variable configuration
- Optimized build output
- Progressive Web App features
- Performance monitoring

## 📈 Monitoring & Analytics

### Live Metrics
- Real-time game analysis throughput
- Suspicion rate trends and alerts
- Player behavior pattern detection
- System performance monitoring

### Dashboard Features
- **Live Status Indicators**: Visual feedback for real-time connections
- **Performance Charts**: Historical trends with live updates
- **Alert System**: Notifications for high-risk games
- **Export Capabilities**: Data export for further analysis

## 🔧 Configuration

### ML Model Settings
- Suspicion threshold configuration
- Model version management
- Performance metrics tracking
- A/B testing capabilities

### System Settings
- Rate limiting configuration
- Real-time connection limits
- Database connection pooling
- Caching strategies

## 📝 API Documentation

### Database Functions
- `get_dashboard_kpis()`: Real-time KPI calculations
- `get_suspicion_trends(days)`: Historical trend analysis
- `get_recent_high_risk_games(limit)`: Latest suspicious games
- `get_daily_suspicion_realtime()`: Live daily aggregation

### Real-time Events
- `high_risk_score`: New high-risk game detected
- `daily_stats_update`: Daily statistics changed
- `daily_suspicion_changed`: Suspicion trends updated

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Built with ❤️ for chess security and fair play**