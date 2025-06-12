// Environment configuration for FairPlay-Scout Extension
// This file should be loaded only in background scripts to avoid token leakage

export const CONFIG = {
  // API Configuration
  API_BASE: "https://api.bolt.new",
  
  // JWT Token (short-lived, fetched via staff portal)
  // In production, this should be fetched dynamically from a secure endpoint
  JWT: process.env.FAIRPLAY_JWT || "demo-jwt-token-replace-in-production",
  
  // WebSocket Configuration
  WS_BASE: "wss://api.bolt.new",
  
  // Rate Limiting
  RATE_LIMITS: {
    CHESS_COM: {
      requests_per_second: 1,
      requests_per_minute: 60
    },
    LICHESS: {
      requests_per_second: 15,
      requests_per_minute: 900
    }
  },
  
  // Import Limits
  MAX_GAMES_PER_IMPORT: 100,
  DEFAULT_GAMES_LIMIT: 50,
  
  // Supported Sites
  SUPPORTED_SITES: {
    CHESS_COM: {
      name: "Chess.com",
      domain: "chess.com",
      api_identifier: "chess.com"
    },
    LICHESS: {
      name: "Lichess",
      domain: "lichess.org", 
      api_identifier: "lichess"
    }
  },
  
  // Extension Settings
  EXTENSION: {
    name: "FairPlay-Scout",
    version: "1.0.0",
    update_check_interval: 24 * 60 * 60 * 1000, // 24 hours
    storage_quota_mb: 10
  },
  
  // Debug Settings
  DEBUG: process.env.NODE_ENV === 'development',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info'
};

// Validation function
export function validateConfig() {
  const required = ['API_BASE', 'JWT'];
  const missing = required.filter(key => !CONFIG[key] || CONFIG[key].includes('replace-in-production'));
  
  if (missing.length > 0) {
    console.warn('⚠️ Missing required config values:', missing);
    return false;
  }
  
  return true;
}

// Get API headers with authentication
export function getApiHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${CONFIG.JWT}`,
    'User-Agent': `${CONFIG.EXTENSION.name}/${CONFIG.EXTENSION.version}`,
    'X-Extension-Version': CONFIG.EXTENSION.version
  };
}

// Get site configuration by domain
export function getSiteConfig(domain) {
  return Object.values(CONFIG.SUPPORTED_SITES).find(site => 
    domain.includes(site.domain)
  );
}