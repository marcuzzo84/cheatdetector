// FairPlay-Scout Extension Popup JavaScript
import { CONFIG, getApiHeaders, getSiteConfig } from '../config.js';

class PopupManager {
  constructor() {
    this.currentTab = 'import';
    this.activeImportId = null;
    this.wsConnection = null;
    this.settings = {};
    
    this.init();
  }

  async init() {
    console.log('🚀 Popup initializing...');
    
    // Load settings
    await this.loadSettings();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Initialize tabs
    this.initializeTabs();
    
    // Load import history
    this.loadImportHistory();
    
    // Setup WebSocket for real-time updates
    this.initializeWebSocket();
    
    // Check connection status
    this.updateConnectionStatus();
    
    // Auto-detect current site and user
    this.autoDetectSiteInfo();
    
    console.log('✅ Popup initialized');
  }

  setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.tab-button').forEach(button => {
      button.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // Import form
    document.getElementById('import-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleImportSubmit();
    });

    // Cancel import
    document.getElementById('cancel-import-btn').addEventListener('click', () => {
      this.cancelImport();
    });

    // Settings
    document.getElementById('save-settings-btn').addEventListener('click', () => {
      this.saveSettings();
    });

    // External links
    document.getElementById('open-dashboard').addEventListener('click', () => {
      chrome.tabs.create({ url: CONFIG.API_BASE.replace('api.', '') });
    });

    document.getElementById('view-docs').addEventListener('click', () => {
      chrome.tabs.create({ url: `${CONFIG.API_BASE}/docs` });
    });
  }

  initializeTabs() {
    this.switchTab('import');
  }

  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');

    this.currentTab = tabName;

    // Load tab-specific data
    if (tabName === 'history') {
      this.loadImportHistory();
    } else if (tabName === 'settings') {
      this.loadSettingsUI();
    }
  }

  async autoDetectSiteInfo() {
    try {
      // Get current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) return;

      // Check if it's a supported site
      const siteConfig = getSiteConfig(tab.url);
      if (!siteConfig) return;

      // Update site selector
      document.getElementById('site-select').value = siteConfig.api_identifier;

      // Try to get user info from content script
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_USER_INFO' });
        if (response && response.username) {
          document.getElementById('username-input').value = response.username;
        }
      } catch (error) {
        console.log('Could not get user info from content script:', error);
      }

    } catch (error) {
      console.error('Error auto-detecting site info:', error);
    }
  }

  async handleImportSubmit() {
    const site = document.getElementById('site-select').value;
    const username = document.getElementById('username-input').value.trim();
    const gamesCount = parseInt(document.getElementById('games-input').value);

    // Validation
    if (!site) {
      this.showError('Please select a site');
      return;
    }

    if (!username) {
      this.showError('Please enter a username');
      return;
    }

    if (gamesCount < 1 || gamesCount > CONFIG.MAX_GAMES_PER_IMPORT) {
      this.showError(`Games count must be between 1 and ${CONFIG.MAX_GAMES_PER_IMPORT}`);
      return;
    }

    // Show loading state
    this.showImportStatus('Queuing import...');

    try {
      // Send import request to background script
      const response = await this.sendMessage({
        type: 'IMPORT_GAMES',
        data: { site, username, limit: gamesCount }
      });

      if (response.success) {
        this.activeImportId = response.importId;
        this.showImportStatus('Import queued successfully!');
        this.listenForImportProgress();
      } else {
        this.showError(response.error);
        this.hideImportStatus();
      }
    } catch (error) {
      this.showError(`Import failed: ${error.message}`);
      this.hideImportStatus();
    }
  }

  async cancelImport() {
    if (!this.activeImportId) return;

    try {
      await this.sendMessage({
        type: 'CANCEL_IMPORT',
        data: { importId: this.activeImportId }
      });

      this.hideImportStatus();
      this.activeImportId = null;
    } catch (error) {
      console.error('Error cancelling import:', error);
    }
  }

  showImportStatus(message) {
    const statusElement = document.getElementById('import-status');
    const statusText = document.getElementById('status-text');
    const progressText = document.getElementById('progress-text');
    const progressFill = document.getElementById('progress-fill');

    statusText.textContent = message;
    progressText.textContent = '0 games imported';
    progressFill.style.width = '0%';
    statusElement.style.display = 'block';

    // Disable import button
    document.getElementById('import-btn').disabled = true;
  }

  hideImportStatus() {
    document.getElementById('import-status').style.display = 'none';
    document.getElementById('import-btn').disabled = false;
  }

  updateImportProgress(data) {
    const statusText = document.getElementById('status-text');
    const progressText = document.getElementById('progress-text');
    const progressFill = document.getElementById('progress-fill');

    if (data.status === 'processing') {
      statusText.textContent = 'Processing games...';
      progressText.textContent = `${data.games_imported} games imported`;
      
      // Calculate progress percentage
      const progress = data.total_games > 0 ? (data.games_imported / data.total_games) * 100 : 0;
      progressFill.style.width = `${Math.min(progress, 100)}%`;
    } else if (data.status === 'completed') {
      statusText.textContent = '✅ Import completed!';
      progressText.textContent = `${data.games_imported} games imported successfully`;
      progressFill.style.width = '100%';
      
      // Auto-hide after 3 seconds
      setTimeout(() => {
        this.hideImportStatus();
        this.activeImportId = null;
        this.loadImportHistory(); // Refresh history
      }, 3000);
    } else if (data.status === 'failed') {
      statusText.textContent = '❌ Import failed';
      progressText.textContent = data.error || 'Unknown error occurred';
      
      setTimeout(() => {
        this.hideImportStatus();
        this.activeImportId = null;
      }, 5000);
    }
  }

  listenForImportProgress() {
    // Listen for messages from background script
    const messageListener = (message) => {
      if (message.type === 'IMPORT_PROGRESS' && message.data.importId === this.activeImportId) {
        this.updateImportProgress(message.data);
      } else if (message.type === 'IMPORT_COMPLETED' && message.data.importId === this.activeImportId) {
        this.updateImportProgress({
          status: 'completed',
          games_imported: message.data.result.imported
        });
      } else if (message.type === 'IMPORT_FAILED' && message.data.importId === this.activeImportId) {
        this.updateImportProgress({
          status: 'failed',
          error: message.data.error
        });
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    // Clean up listener when import is done
    const cleanup = () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };

    // Auto-cleanup after 10 minutes
    setTimeout(cleanup, 10 * 60 * 1000);
  }

  async loadImportHistory() {
    const historyList = document.getElementById('history-list');
    
    try {
      const response = await this.sendMessage({ type: 'GET_IMPORT_HISTORY' });
      
      if (response.success && response.data.length > 0) {
        historyList.innerHTML = response.data.map(item => this.createHistoryItem(item)).join('');
      } else {
        historyList.innerHTML = '<div class="empty-state">No import history yet</div>';
      }
    } catch (error) {
      historyList.innerHTML = '<div class="empty-state">Error loading history</div>';
    }
  }

  createHistoryItem(item) {
    const statusClass = item.status === 'completed' ? 'completed' : 
                       item.status === 'failed' ? 'failed' : 'cancelled';
    
    const timeAgo = this.formatTimeAgo(new Date(item.started_at));
    
    return `
      <div class="history-item">
        <div class="history-header">
          <span class="history-site">${item.site}</span>
          <span class="history-username">@${item.username}</span>
          <span class="history-status ${statusClass}">${item.status}</span>
        </div>
        <div class="history-details">
          <span>${item.games_imported || 0} games imported</span>
          <span>${timeAgo}</span>
        </div>
      </div>
    `;
  }

  formatTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  }

  async loadSettings() {
    try {
      const response = await this.sendMessage({ type: 'GET_SETTINGS' });
      if (response.success) {
        this.settings = response.data || {};
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      this.settings = {};
    }
  }

  loadSettingsUI() {
    // Load current settings into UI
    document.getElementById('auto-import-setting').checked = this.settings.auto_import || false;
    document.getElementById('default-limit-setting').value = this.settings.default_limit || CONFIG.DEFAULT_GAMES_LIMIT;
    document.getElementById('notifications-setting').checked = this.settings.notifications !== false;
  }

  async saveSettings() {
    const newSettings = {
      auto_import: document.getElementById('auto-import-setting').checked,
      default_limit: parseInt(document.getElementById('default-limit-setting').value),
      notifications: document.getElementById('notifications-setting').checked
    };

    try {
      const response = await this.sendMessage({
        type: 'UPDATE_SETTINGS',
        data: newSettings
      });

      if (response.success) {
        this.settings = newSettings;
        this.showSuccess('Settings saved successfully!');
        
        // Update default limit in import form
        document.getElementById('games-input').value = newSettings.default_limit;
      } else {
        this.showError('Failed to save settings');
      }
    } catch (error) {
      this.showError(`Error saving settings: ${error.message}`);
    }
  }

  initializeWebSocket() {
    // WebSocket connection is managed by background script
    // We just listen for score updates here
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'SCORE_UPDATE') {
        this.handleScoreUpdate(message.data);
      }
    });
  }

  handleScoreUpdate(scoreData) {
    // Show notification for high-risk scores if enabled
    if (this.settings.notifications && scoreData.suspicion_level >= 80) {
      this.showNotification(`High-risk game detected: ${scoreData.suspicion_level}% suspicion`);
    }
  }

  updateConnectionStatus() {
    const statusElement = document.getElementById('connection-status');
    const indicator = statusElement.querySelector('.status-indicator');
    const text = statusElement.querySelector('span');

    // Check if background script is responsive
    this.sendMessage({ type: 'PING' })
      .then(() => {
        indicator.className = 'status-indicator online';
        text.textContent = 'Connected';
      })
      .catch(() => {
        indicator.className = 'status-indicator offline';
        text.textContent = 'Disconnected';
      });
  }

  // Utility methods
  async sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  showError(message) {
    this.showNotification(message, 'error');
  }

  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 1000;
      padding: 12px 16px;
      border-radius: 6px;
      color: white;
      font-size: 13px;
      font-weight: 500;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
      transform: translateX(100%);
      transition: transform 0.3s ease;
    `;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 10);

    // Auto-remove
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => notification.remove(), 300);
    }, 4000);
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});