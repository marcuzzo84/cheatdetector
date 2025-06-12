// Background Service Worker for FairPlay-Scout Extension
import { CONFIG, validateConfig, getApiHeaders } from '../config.js';

// Global state
let importQueue = [];
let activeImports = new Map();
let wsConnection = null;

// Initialize extension
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('🚀 FairPlay-Scout Extension installed/updated');
  
  // Validate configuration
  if (!validateConfig()) {
    console.error('❌ Invalid configuration detected');
    return;
  }
  
  // Set up initial storage
  await chrome.storage.local.set({
    extension_version: CONFIG.EXTENSION.version,
    install_date: new Date().toISOString(),
    import_history: [],
    settings: {
      auto_import: false,
      default_limit: CONFIG.DEFAULT_GAMES_LIMIT,
      notifications: true
    }
  });
  
  // Initialize WebSocket connection for real-time updates
  initializeWebSocket();
  
  console.log('✅ Extension initialized successfully');
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log('🔄 Extension starting up');
  initializeWebSocket();
});

// Message handling from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Received message:', message.type);
  
  switch (message.type) {
    case 'IMPORT_GAMES':
      handleImportRequest(message.data, sendResponse);
      return true; // Keep channel open for async response
      
    case 'GET_IMPORT_STATUS':
      handleGetImportStatus(message.data, sendResponse);
      return true;
      
    case 'CANCEL_IMPORT':
      handleCancelImport(message.data, sendResponse);
      return true;
      
    case 'GET_SETTINGS':
      handleGetSettings(sendResponse);
      return true;
      
    case 'UPDATE_SETTINGS':
      handleUpdateSettings(message.data, sendResponse);
      return true;
      
    case 'GET_IMPORT_HISTORY':
      handleGetImportHistory(sendResponse);
      return true;
      
    default:
      console.warn('⚠️ Unknown message type:', message.type);
      sendResponse({ error: 'Unknown message type' });
  }
});

// Initialize WebSocket connection for real-time score updates
async function initializeWebSocket() {
  try {
    if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
      return; // Already connected
    }
    
    const wsUrl = `${CONFIG.WS_BASE}/scores/stream`;
    wsConnection = new WebSocket(wsUrl);
    
    wsConnection.onopen = () => {
      console.log('🔗 WebSocket connected for real-time updates');
      
      // Authenticate WebSocket connection
      wsConnection.send(JSON.stringify({
        type: 'auth',
        token: CONFIG.JWT
      }));
    };
    
    wsConnection.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (error) {
        console.error('❌ Error parsing WebSocket message:', error);
      }
    };
    
    wsConnection.onclose = () => {
      console.log('🔌 WebSocket disconnected, attempting reconnect in 5s');
      setTimeout(initializeWebSocket, 5000);
    };
    
    wsConnection.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
    };
    
  } catch (error) {
    console.error('❌ Failed to initialize WebSocket:', error);
  }
}

// Handle WebSocket messages (real-time score updates)
function handleWebSocketMessage(data) {
  switch (data.type) {
    case 'score_update':
      // Broadcast to popup if open
      chrome.runtime.sendMessage({
        type: 'SCORE_UPDATE',
        data: data.payload
      }).catch(() => {
        // Popup might not be open, ignore error
      });
      break;
      
    case 'import_progress':
      // Update import progress
      const importId = data.import_id;
      if (activeImports.has(importId)) {
        const importData = activeImports.get(importId);
        importData.progress = data.progress;
        importData.games_imported = data.games_imported;
        
        // Notify popup
        chrome.runtime.sendMessage({
          type: 'IMPORT_PROGRESS',
          data: { importId, ...data }
        }).catch(() => {});
      }
      break;
      
    default:
      console.log('📡 Received WebSocket message:', data.type);
  }
}

// Handle import request from popup
async function handleImportRequest(data, sendResponse) {
  try {
    const { site, username, limit = CONFIG.DEFAULT_GAMES_LIMIT } = data;
    
    // Validate input
    if (!site || !username) {
      sendResponse({ error: 'Missing required fields: site and username' });
      return;
    }
    
    if (limit > CONFIG.MAX_GAMES_PER_IMPORT) {
      sendResponse({ error: `Limit cannot exceed ${CONFIG.MAX_GAMES_PER_IMPORT} games` });
      return;
    }
    
    // Generate import ID
    const importId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Add to active imports
    activeImports.set(importId, {
      id: importId,
      site,
      username,
      limit,
      status: 'queued',
      progress: 0,
      games_imported: 0,
      started_at: new Date().toISOString(),
      errors: []
    });
    
    // Queue the import
    importQueue.push(importId);
    
    // Start processing if not already running
    processImportQueue();
    
    sendResponse({ 
      success: true, 
      importId,
      message: 'Import queued successfully' 
    });
    
  } catch (error) {
    console.error('❌ Error handling import request:', error);
    sendResponse({ error: error.message });
  }
}

// Process import queue
async function processImportQueue() {
  if (importQueue.length === 0) return;
  
  const importId = importQueue.shift();
  const importData = activeImports.get(importId);
  
  if (!importData) return;
  
  try {
    console.log(`🔄 Starting import: ${importId}`);
    
    // Update status
    importData.status = 'processing';
    
    // Call the import API
    const response = await fetch(`${CONFIG.API_BASE}/functions/v1/import-games`, {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({
        site: importData.site,
        username: importData.username,
        limit: importData.limit
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    // Update import data
    importData.status = 'completed';
    importData.games_imported = result.imported || 0;
    importData.completed_at = new Date().toISOString();
    importData.result = result;
    
    // Save to history
    await saveImportToHistory(importData);
    
    // Notify popup
    chrome.runtime.sendMessage({
      type: 'IMPORT_COMPLETED',
      data: { importId, result }
    }).catch(() => {});
    
    console.log(`✅ Import completed: ${importId} (${result.imported} games)`);
    
  } catch (error) {
    console.error(`❌ Import failed: ${importId}`, error);
    
    // Update import data
    importData.status = 'failed';
    importData.error = error.message;
    importData.completed_at = new Date().toISOString();
    
    // Notify popup
    chrome.runtime.sendMessage({
      type: 'IMPORT_FAILED',
      data: { importId, error: error.message }
    }).catch(() => {});
  } finally {
    // Continue processing queue
    setTimeout(processImportQueue, 1000);
  }
}

// Save import to history
async function saveImportToHistory(importData) {
  try {
    const { import_history = [] } = await chrome.storage.local.get(['import_history']);
    
    // Add to history (keep last 100 imports)
    import_history.unshift({
      id: importData.id,
      site: importData.site,
      username: importData.username,
      games_imported: importData.games_imported,
      status: importData.status,
      started_at: importData.started_at,
      completed_at: importData.completed_at,
      error: importData.error
    });
    
    // Keep only last 100 imports
    if (import_history.length > 100) {
      import_history.splice(100);
    }
    
    await chrome.storage.local.set({ import_history });
    
  } catch (error) {
    console.error('❌ Error saving import to history:', error);
  }
}

// Handle get import status
async function handleGetImportStatus(data, sendResponse) {
  const { importId } = data;
  const importData = activeImports.get(importId);
  
  if (importData) {
    sendResponse({ success: true, data: importData });
  } else {
    sendResponse({ error: 'Import not found' });
  }
}

// Handle cancel import
async function handleCancelImport(data, sendResponse) {
  const { importId } = data;
  
  // Remove from queue
  const queueIndex = importQueue.indexOf(importId);
  if (queueIndex > -1) {
    importQueue.splice(queueIndex, 1);
  }
  
  // Update active import
  const importData = activeImports.get(importId);
  if (importData) {
    importData.status = 'cancelled';
    importData.completed_at = new Date().toISOString();
  }
  
  sendResponse({ success: true, message: 'Import cancelled' });
}

// Handle get settings
async function handleGetSettings(sendResponse) {
  try {
    const { settings } = await chrome.storage.local.get(['settings']);
    sendResponse({ success: true, data: settings });
  } catch (error) {
    sendResponse({ error: error.message });
  }
}

// Handle update settings
async function handleUpdateSettings(data, sendResponse) {
  try {
    await chrome.storage.local.set({ settings: data });
    sendResponse({ success: true, message: 'Settings updated' });
  } catch (error) {
    sendResponse({ error: error.message });
  }
}

// Handle get import history
async function handleGetImportHistory(sendResponse) {
  try {
    const { import_history = [] } = await chrome.storage.local.get(['import_history']);
    sendResponse({ success: true, data: import_history });
  } catch (error) {
    sendResponse({ error: error.message });
  }
}

// Cleanup on extension shutdown
chrome.runtime.onSuspend.addListener(() => {
  console.log('🔄 Extension suspending, cleaning up...');
  
  if (wsConnection) {
    wsConnection.close();
  }
});