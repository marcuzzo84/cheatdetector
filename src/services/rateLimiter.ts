import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface RateLimitConfig {
  requestsPerSecond: number;
  requestsPerMinute?: number;
  requestsPerHour?: number;
  maxBodySize?: number; // in MB
  burstLimit?: number;
  cooldownPeriod?: number; // in ms
}

export interface RateLimitStatus {
  allowed: boolean;
  retryAfter?: number; // in ms
  remaining: number;
  resetTime: number;
  quotaExceeded?: boolean;
  reason?: string;
}

export interface RequestMetrics {
  timestamp: number;
  responseSize: number;
  duration: number;
  success: boolean;
}

class RateLimiter {
  private requestHistory: Map<string, RequestMetrics[]> = new Map();
  private lastRequestTime: Map<string, number> = new Map();
  private quotaUsage: Map<string, { size: number; requests: number; resetTime: number }> = new Map();
  
  constructor(private config: RateLimitConfig) {}

  async checkLimit(identifier: string): Promise<RateLimitStatus> {
    const now = Date.now();
    const history = this.requestHistory.get(identifier) || [];
    
    // Clean old entries
    const validHistory = history.filter(req => now - req.timestamp < 3600000); // Keep 1 hour
    this.requestHistory.set(identifier, validHistory);

    // Check per-second limit
    const lastSecond = validHistory.filter(req => now - req.timestamp < 1000);
    if (lastSecond.length >= this.config.requestsPerSecond) {
      const oldestInSecond = Math.min(...lastSecond.map(r => r.timestamp));
      const retryAfter = 1000 - (now - oldestInSecond);
      
      return {
        allowed: false,
        retryAfter,
        remaining: 0,
        resetTime: oldestInSecond + 1000,
        reason: 'Per-second rate limit exceeded'
      };
    }

    // Check per-minute limit
    if (this.config.requestsPerMinute) {
      const lastMinute = validHistory.filter(req => now - req.timestamp < 60000);
      if (lastMinute.length >= this.config.requestsPerMinute) {
        const oldestInMinute = Math.min(...lastMinute.map(r => r.timestamp));
        const retryAfter = 60000 - (now - oldestInMinute);
        
        return {
          allowed: false,
          retryAfter,
          remaining: 0,
          resetTime: oldestInMinute + 60000,
          reason: 'Per-minute rate limit exceeded'
        };
      }
    }

    // Check per-hour limit
    if (this.config.requestsPerHour) {
      if (validHistory.length >= this.config.requestsPerHour) {
        const oldestInHour = Math.min(...validHistory.map(r => r.timestamp));
        const retryAfter = 3600000 - (now - oldestInHour);
        
        return {
          allowed: false,
          retryAfter,
          remaining: 0,
          resetTime: oldestInHour + 3600000,
          reason: 'Per-hour rate limit exceeded'
        };
      }
    }

    // Check quota limits (for Lichess data volume)
    const quota = this.quotaUsage.get(identifier);
    if (quota && this.config.maxBodySize) {
      const quotaResetTime = quota.resetTime;
      if (now < quotaResetTime && quota.size >= this.config.maxBodySize * 1024 * 1024) {
        return {
          allowed: false,
          retryAfter: quotaResetTime - now,
          remaining: 0,
          resetTime: quotaResetTime,
          quotaExceeded: true,
          reason: 'Data quota exceeded'
        };
      }
    }

    // Calculate remaining requests
    const remaining = this.config.requestsPerSecond - lastSecond.length;
    
    return {
      allowed: true,
      remaining,
      resetTime: now + 1000
    };
  }

  async recordRequest(identifier: string, metrics: RequestMetrics): Promise<void> {
    const history = this.requestHistory.get(identifier) || [];
    history.push(metrics);
    this.requestHistory.set(identifier, history);
    this.lastRequestTime.set(identifier, metrics.timestamp);

    // Update quota usage
    const quota = this.quotaUsage.get(identifier) || { 
      size: 0, 
      requests: 0, 
      resetTime: Date.now() + 60000 // Reset every minute for Lichess
    };
    
    if (Date.now() > quota.resetTime) {
      quota.size = 0;
      quota.requests = 0;
      quota.resetTime = Date.now() + 60000;
    }
    
    quota.size += metrics.responseSize;
    quota.requests += 1;
    this.quotaUsage.set(identifier, quota);

    // Record metrics in database for monitoring
    try {
      await supabase.rpc('record_scheduler_metric', {
        p_metric_name: 'api_request',
        p_metric_type: 'counter',
        p_value: 1,
        p_labels: {
          identifier,
          success: metrics.success,
          duration_ms: metrics.duration,
          response_size_bytes: metrics.responseSize
        }
      });
    } catch (error) {
      console.warn('Failed to record rate limit metrics:', error);
    }
  }

  async waitForSlot(identifier: string): Promise<void> {
    const status = await this.checkLimit(identifier);
    if (!status.allowed && status.retryAfter) {
      console.log(`Rate limited for ${identifier}, waiting ${status.retryAfter}ms`);
      await new Promise(resolve => setTimeout(resolve, status.retryAfter));
    }
  }

  getQuotaStatus(identifier: string): { used: number; limit: number; resetTime: number } {
    const quota = this.quotaUsage.get(identifier);
    return {
      used: quota?.size || 0,
      limit: (this.config.maxBodySize || 0) * 1024 * 1024,
      resetTime: quota?.resetTime || Date.now()
    };
  }

  reset(identifier?: string): void {
    if (identifier) {
      this.requestHistory.delete(identifier);
      this.lastRequestTime.delete(identifier);
      this.quotaUsage.delete(identifier);
    } else {
      this.requestHistory.clear();
      this.lastRequestTime.clear();
      this.quotaUsage.clear();
    }
  }
}

// Pre-configured rate limiters for each API
export const chessComLimiter = new RateLimiter({
  requestsPerSecond: 1,
  requestsPerMinute: 60,
  requestsPerHour: 3600,
  burstLimit: 2, // Allow small bursts
  cooldownPeriod: 1100 // 1.1 seconds between requests
});

export const lichessLimiter = new RateLimiter({
  requestsPerSecond: 15, // Conservative limit (API allows 20)
  requestsPerMinute: 900, // 15 * 60
  requestsPerHour: 54000, // 15 * 3600
  maxBodySize: 5, // 5 MB per minute
  burstLimit: 20,
  cooldownPeriod: 67 // ~67ms between requests
});

// Throttle function factory with rate limiting
export function createThrottledFetch(limiter: RateLimiter, identifier: string) {
  return async function throttledFetch(url: string, options: RequestInit = {}): Promise<Response> {
    // Wait for rate limit slot
    await limiter.waitForSlot(identifier);
    
    const startTime = Date.now();
    let response: Response;
    let success = false;
    let responseSize = 0;

    try {
      // Add user agent and other headers
      const headers = {
        'User-Agent': 'FairPlay-Scout/1.0 (Chess Analysis Tool)',
        ...options.headers,
      };

      response = await fetch(url, { ...options, headers });
      success = response.ok;
      
      // Estimate response size from content-length or actual content
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        responseSize = parseInt(contentLength, 10);
      } else {
        // For responses without content-length, we'll estimate
        const text = await response.clone().text();
        responseSize = new Blob([text]).size;
      }

      return response;
    } catch (error) {
      console.error(`Throttled fetch error for ${url}:`, error);
      throw error;
    } finally {
      // Record the request metrics
      const duration = Date.now() - startTime;
      await limiter.recordRequest(identifier, {
        timestamp: startTime,
        responseSize,
        duration,
        success
      });
    }
  };
}

// Utility function to check if we're approaching limits
export async function checkApiHealth(site: 'chess.com' | 'lichess'): Promise<{
  healthy: boolean;
  quotaStatus: any;
  recommendations: string[];
}> {
  const limiter = site === 'chess.com' ? chessComLimiter : lichessLimiter;
  const identifier = `${site}-health-check`;
  
  const status = await limiter.checkLimit(identifier);
  const quotaStatus = limiter.getQuotaStatus(identifier);
  
  const recommendations: string[] = [];
  
  if (!status.allowed) {
    recommendations.push(`Rate limited: ${status.reason}`);
  }
  
  if (quotaStatus.used > quotaStatus.limit * 0.8) {
    recommendations.push('Approaching data quota limit');
  }
  
  if (site === 'chess.com' && status.remaining < 5) {
    recommendations.push('Consider reducing Chess.com request frequency');
  }
  
  if (site === 'lichess' && quotaStatus.used > quotaStatus.limit * 0.9) {
    recommendations.push('Reduce Lichess request size or frequency');
  }

  return {
    healthy: status.allowed && !status.quotaExceeded,
    quotaStatus,
    recommendations
  };
}

export { RateLimiter };