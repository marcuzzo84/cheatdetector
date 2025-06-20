# API Documentation

This document covers the FairPlay-Scout Dashboard API endpoints, database functions, and integration patterns.

## Authentication

All API requests require authentication via Supabase Auth tokens.

```typescript
// Client-side authentication
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;

// Include in requests
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};
```

## Edge Functions

### Import Games Function

**Endpoint**: `POST /functions/v1/import-games`

Imports chess games from Chess.com or Lichess with rate limiting and analysis.

**Request Body**:
```typescript
interface ImportRequest {
  site: 'chess.com' | 'lichess';
  username: string;
  limit: number; // 1-100
}
```

**Response**:
```typescript
interface ImportResponse {
  success: boolean;
  imported: number;
  total_fetched: number;
  errors: string[];
  message: string;
  authentication_status: 'authenticated' | 'demo_mode';
}
```

**Example**:
```typescript
const response = await fetch(`${supabaseUrl}/functions/v1/import-games`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    site: 'chess.com',
    username: 'hikaru',
    limit: 50
  })
});

const result = await response.json();
```

**Rate Limits**:
- Chess.com: 1 request/second (soft limit)
- Lichess: 20 requests/second, 15MB/minute

## Database Functions

### Dashboard KPIs

**Function**: `get_dashboard_kpis()`

Returns real-time dashboard metrics.

```sql
SELECT * FROM get_dashboard_kpis();
```

**Returns**:
```typescript
interface DashboardKPIs {
  games_24h: number;
  suspect_pct: number;
  avg_elo: number;
}
```

### Suspicion Trends

**Function**: `get_suspicion_trends(days_back integer)`

Returns historical suspicion rate trends.

```sql
SELECT * FROM get_suspicion_trends(30);
```

**Returns**:
```typescript
interface SuspicionTrend {
  date: string;
  suspicion_rate: number;
  volume: number;
}
```

### Recent High-Risk Games

**Function**: `get_recent_high_risk_games(limit_count integer)`

Returns latest games with high suspicion levels.

```sql
SELECT * FROM get_recent_high_risk_games(10);
```

**Returns**:
```typescript
interface HighRiskGame {
  id: string;
  player_hash: string;
  site: string;
  suspicion_level: number;
  match_engine_pct: number;
  ml_prob: number;
  created_at: string;
}
```

### Daily Suspicion Realtime

**Function**: `get_daily_suspicion_realtime()`

Returns real-time daily suspicion aggregations.

```sql
SELECT * FROM get_daily_suspicion_realtime();
```

**Returns**:
```typescript
interface DailySuspicion {
  bucket: string;
  rate: number;
  volume: number;
}
```

## Database Tables

### Players Table

```sql
CREATE TABLE players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hash text UNIQUE NOT NULL,
  elo integer,
  created_at timestamptz DEFAULT now()
);
```

**Access Patterns**:
- `SELECT * FROM players WHERE hash = $1`
- `SELECT * FROM players ORDER BY elo DESC LIMIT 50`

### Games Table

```sql
CREATE TABLE games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  site text NOT NULL,
  date date,
  result text,
  ext_uid text,
  created_at timestamptz DEFAULT now()
);
```

**Indexes**:
- `idx_games_player_id` on `player_id`
- `idx_games_site_date` on `(site, date DESC)`
- `games_site_ext_uid_idx` unique on `(site, ext_uid)`

### Scores Table

```sql
CREATE TABLE scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES games(id) ON DELETE CASCADE,
  match_engine_pct numeric,
  delta_cp numeric,
  run_perfect integer DEFAULT 0,
  ml_prob numeric,
  suspicion_level integer CHECK (suspicion_level >= 0 AND suspicion_level <= 100),
  created_at timestamptz DEFAULT now()
);
```

**Indexes**:
- `idx_scores_game_id` on `game_id`
- `idx_scores_high_suspicion_created` on `created_at DESC WHERE suspicion_level >= 70`
- `idx_scores_ml_prob_desc` on `ml_prob DESC WHERE ml_prob IS NOT NULL`

## Real-time Subscriptions

### Score Updates

Subscribe to new score insertions:

```typescript
const channel = supabase
  .channel('scores-updates')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'scores'
  }, (payload) => {
    console.log('New score:', payload.new);
  })
  .subscribe();
```

### High-Risk Game Alerts

Subscribe to high-risk games only:

```typescript
const channel = supabase
  .channel('high-risk-alerts')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'scores',
    filter: 'suspicion_level=gte.80'
  }, (payload) => {
    console.log('High-risk game detected:', payload.new);
  })
  .subscribe();
```

### Daily Suspicion Updates

Subscribe to daily aggregation changes:

```typescript
const channel = supabase
  .channel('daily-suspicion-updates')
  .on('broadcast', { event: 'daily_suspicion_updated' }, (payload) => {
    console.log('Daily suspicion updated:', payload);
  })
  .subscribe();
```

## Row Level Security (RLS)

### Players Table Policies

```sql
-- Users can view all players
CREATE POLICY "Allow authenticated users to read players"
  ON players FOR SELECT
  TO authenticated
  USING (true);

-- Service role can manage all players
CREATE POLICY "Allow service role to manage players"
  ON players FOR ALL
  TO service_role
  USING (true);
```

### Scores Table Policies

```sql
-- Users can view all scores
CREATE POLICY "Allow authenticated users to read scores"
  ON scores FOR SELECT
  TO authenticated
  USING (true);

-- Service role can manage all scores
CREATE POLICY "Allow service role to manage scores"
  ON scores FOR ALL
  TO service_role
  USING (true);
```

### File Tables Policies

```sql
-- Users can only access their own files
CREATE POLICY "Users can view own uploaded files"
  ON uploaded_files FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can access all files
CREATE POLICY "Admins can access all uploaded files"
  ON uploaded_files FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'administrator')
    )
  );
```

## Error Handling

### Standard Error Response

```typescript
interface ErrorResponse {
  error: string;
  details?: string;
  code?: string;
  success: false;
}
```

### Common Error Codes

- `PGRST116`: Row not found
- `23505`: Unique constraint violation
- `42501`: Insufficient privilege
- `42P01`: Relation does not exist

### Error Handling Pattern

```typescript
try {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('hash', playerHash)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Handle not found
      return null;
    }
    throw error;
  }

  return data;
} catch (error) {
  console.error('Database error:', error);
  throw new Error('Failed to fetch player data');
}
```

## Rate Limiting

### Chess.com API

- **Rate**: 1 request per second (soft limit)
- **Implementation**: pThrottle with 1100ms delay
- **Headers**: User-Agent required
- **Retry**: Exponential backoff on 429 responses

```typescript
const throttle = pThrottle({
  limit: 1,
  interval: 1100 // 1.1 seconds
});

const fetchChessComData = throttle(async (url: string) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'FairPlay-Scout/1.0 (https://fairplay-scout.com)'
    }
  });
  return response;
});
```

### Lichess API

- **Rate**: 20 requests per second
- **Data Limit**: 15MB per minute
- **Game Limit**: 300 games per request
- **Format**: NDJSON (newline-delimited JSON)

```typescript
const fetchLichessGames = async (username: string, limit: number) => {
  const url = `https://lichess.org/api/games/user/${username}?max=${Math.min(limit, 300)}&format=json`;
  
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/x-ndjson',
      'User-Agent': 'FairPlay-Scout/1.0'
    }
  });
  
  return response;
};
```

## Subscription System API

### Check Trial Status

```typescript
const { data: trial } = await supabase
  .from('user_trials')
  .select('*')
  .eq('user_id', userId)
  .eq('is_active', true)
  .single();

const isTrialActive = trial && new Date(trial.expires_at) > new Date();
```

### Get User Subscription

```typescript
const { data: subscription } = await supabase
  .from('user_subscriptions')
  .select(`
    *,
    subscription_plans (
      name,
      features,
      limits
    )
  `)
  .eq('user_id', userId)
  .eq('is_active', true)
  .single();
```

### Check Feature Access

```typescript
const hasFeatureAccess = (feature: string, userRole: string, subscription: any) => {
  // Admin always has access
  if (userRole === 'admin' || userRole === 'administrator') {
    return true;
  }
  
  // Check subscription features
  if (subscription?.subscription_plans?.features?.includes(feature)) {
    return true;
  }
  
  // Check trial access
  const trial = getUserActiveTrial(userId);
  if (trial && trial.is_active) {
    return true;
  }
  
  return false;
};
```

## Performance Optimization

### Query Optimization

```sql
-- Use indexes for common queries
EXPLAIN ANALYZE SELECT * FROM scores 
WHERE suspicion_level >= 70 
ORDER BY created_at DESC 
LIMIT 20;

-- Use materialized views for complex aggregations
CREATE MATERIALIZED VIEW daily_suspicion_stats AS
SELECT 
  date_trunc('day', created_at) as day,
  AVG(suspicion_level) as avg_suspicion,
  COUNT(*) as game_count
FROM scores
GROUP BY date_trunc('day', created_at);
```

### Connection Pooling

```typescript
const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'public',
  },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
```

### Caching Strategy

```typescript
// Cache dashboard KPIs for 30 seconds
const getCachedKPIs = async () => {
  const cacheKey = 'dashboard-kpis';
  const cached = localStorage.getItem(cacheKey);
  
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < 30000) {
      return data;
    }
  }
  
  const { data } = await supabase.rpc('get_dashboard_kpis');
  localStorage.setItem(cacheKey, JSON.stringify({
    data,
    timestamp: Date.now()
  }));
  
  return data;
};
```

For more detailed examples and advanced usage patterns, see the implementation files in the `/src` directory.