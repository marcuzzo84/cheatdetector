// Content Script for FairPlay-Scout Extension
// Runs on Chess.com and Lichess pages

(function() {
  'use strict';
  
  console.log('🎯 FairPlay-Scout content script loaded');
  
  // Detect current site
  const currentSite = detectSite();
  if (!currentSite) {
    console.log('❌ Unsupported site, content script exiting');
    return;
  }
  
  console.log(`✅ Detected site: ${currentSite.name}`);
  
  // Initialize site-specific functionality
  initializeSiteFeatures(currentSite);
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'GET_PAGE_INFO':
        sendResponse(getPageInfo());
        break;
        
      case 'GET_USER_INFO':
        sendResponse(getUserInfo());
        break;
        
      case 'EXTRACT_GAME_DATA':
        sendResponse(extractGameData());
        break;
        
      default:
        console.log('📨 Unknown message type:', message.type);
    }
  });
  
  // Detect which chess site we're on
  function detectSite() {
    const hostname = window.location.hostname;
    
    if (hostname.includes('chess.com')) {
      return {
        name: 'Chess.com',
        identifier: 'chess.com',
        domain: 'chess.com'
      };
    } else if (hostname.includes('lichess.org')) {
      return {
        name: 'Lichess',
        identifier: 'lichess',
        domain: 'lichess.org'
      };
    }
    
    return null;
  }
  
  // Initialize site-specific features
  function initializeSiteFeatures(site) {
    // Add import button to page
    addImportButton(site);
    
    // Set up page observers
    setupPageObservers(site);
    
    // Initialize game detection
    initializeGameDetection(site);
  }
  
  // Add import button to the page
  function addImportButton(site) {
    // Create import button
    const importButton = document.createElement('div');
    importButton.id = 'fairplay-scout-import-btn';
    importButton.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        cursor: pointer;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s ease;
        border: none;
        user-select: none;
      " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(0,0,0,0.2)'" 
         onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7,10 12,15 17,10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Import to FairPlay-Scout
      </div>
    `;
    
    // Add click handler
    importButton.addEventListener('click', () => {
      openImportPopup(site);
    });
    
    // Add to page
    document.body.appendChild(importButton);
    
    console.log('✅ Import button added to page');
  }
  
  // Open import popup
  function openImportPopup(site) {
    // Get current user info
    const userInfo = getUserInfo();
    
    if (!userInfo.username) {
      showNotification('Please log in to import your games', 'warning');
      return;
    }
    
    // Create popup overlay
    const overlay = document.createElement('div');
    overlay.id = 'fairplay-scout-popup';
    overlay.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        z-index: 20000;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        <div style="
          background: white;
          border-radius: 12px;
          padding: 24px;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
          position: relative;
        ">
          <button id="close-popup" style="
            position: absolute;
            top: 12px;
            right: 12px;
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #666;
            padding: 4px;
          ">&times;</button>
          
          <h2 style="margin: 0 0 16px 0; color: #333; font-size: 20px; font-weight: 600;">
            Import Games to FairPlay-Scout
          </h2>
          
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #555;">Site</label>
            <input type="text" value="${site.name}" disabled style="
              width: 100%;
              padding: 8px 12px;
              border: 1px solid #ddd;
              border-radius: 6px;
              background: #f5f5f5;
              color: #666;
            ">
          </div>
          
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #555;">Username</label>
            <input type="text" id="username-input" value="${userInfo.username}" style="
              width: 100%;
              padding: 8px 12px;
              border: 1px solid #ddd;
              border-radius: 6px;
              font-size: 14px;
            ">
          </div>
          
          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #555;">Number of Games</label>
            <input type="number" id="games-input" value="50" min="1" max="100" style="
              width: 100%;
              padding: 8px 12px;
              border: 1px solid #ddd;
              border-radius: 6px;
              font-size: 14px;
            ">
            <small style="color: #666; font-size: 12px;">Maximum 100 games per import</small>
          </div>
          
          <div style="display: flex; gap: 12px;">
            <button id="cancel-import" style="
              flex: 1;
              padding: 10px 16px;
              border: 1px solid #ddd;
              background: white;
              color: #666;
              border-radius: 6px;
              cursor: pointer;
              font-weight: 500;
            ">Cancel</button>
            <button id="start-import" style="
              flex: 1;
              padding: 10px 16px;
              border: none;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              border-radius: 6px;
              cursor: pointer;
              font-weight: 500;
            ">Import Games</button>
          </div>
          
          <div id="import-status" style="margin-top: 16px; display: none;">
            <div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 6px; padding: 12px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <div style="width: 16px; height: 16px; border: 2px solid #0ea5e9; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <span style="font-weight: 500; color: #0369a1;">Import in progress...</span>
              </div>
              <div id="progress-text" style="font-size: 14px; color: #0369a1;">Queued for processing</div>
            </div>
          </div>
        </div>
      </div>
      
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
    
    document.body.appendChild(overlay);
    
    // Add event listeners
    document.getElementById('close-popup').addEventListener('click', closePopup);
    document.getElementById('cancel-import').addEventListener('click', closePopup);
    document.getElementById('start-import').addEventListener('click', startImport);
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closePopup();
    });
  }
  
  // Close popup
  function closePopup() {
    const popup = document.getElementById('fairplay-scout-popup');
    if (popup) {
      popup.remove();
    }
  }
  
  // Start import process
  function startImport() {
    const username = document.getElementById('username-input').value.trim();
    const gamesCount = parseInt(document.getElementById('games-input').value);
    
    if (!username) {
      showNotification('Please enter a username', 'error');
      return;
    }
    
    if (gamesCount < 1 || gamesCount > 100) {
      showNotification('Games count must be between 1 and 100', 'error');
      return;
    }
    
    // Show status
    document.getElementById('import-status').style.display = 'block';
    document.getElementById('start-import').disabled = true;
    document.getElementById('start-import').style.opacity = '0.5';
    
    // Send import request to background script
    chrome.runtime.sendMessage({
      type: 'IMPORT_GAMES',
      data: {
        site: currentSite.identifier,
        username: username,
        limit: gamesCount
      }
    }, (response) => {
      if (response.success) {
        document.getElementById('progress-text').textContent = 'Import queued successfully!';
        
        // Listen for progress updates
        listenForImportProgress(response.importId);
        
        showNotification(`Import started for ${username} (${gamesCount} games)`, 'success');
      } else {
        document.getElementById('progress-text').textContent = `Error: ${response.error}`;
        showNotification(`Import failed: ${response.error}`, 'error');
      }
    });
  }
  
  // Listen for import progress updates
  function listenForImportProgress(importId) {
    const progressListener = (message) => {
      if (message.type === 'IMPORT_PROGRESS' && message.data.importId === importId) {
        const progressText = document.getElementById('progress-text');
        if (progressText) {
          progressText.textContent = `Processing... ${message.data.games_imported} games imported`;
        }
      } else if (message.type === 'IMPORT_COMPLETED' && message.data.importId === importId) {
        const progressText = document.getElementById('progress-text');
        if (progressText) {
          progressText.textContent = `✅ Import completed! ${message.data.result.imported} games imported`;
        }
        chrome.runtime.onMessage.removeListener(progressListener);
        
        // Auto-close popup after 3 seconds
        setTimeout(closePopup, 3000);
      } else if (message.type === 'IMPORT_FAILED' && message.data.importId === importId) {
        const progressText = document.getElementById('progress-text');
        if (progressText) {
          progressText.textContent = `❌ Import failed: ${message.data.error}`;
        }
        chrome.runtime.onMessage.removeListener(progressListener);
      }
    };
    
    chrome.runtime.onMessage.addListener(progressListener);
  }
  
  // Show notification
  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 25000;
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: all 0.3s ease;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(-50%) translateY(-20px)';
      setTimeout(() => notification.remove(), 300);
    }, 4000);
  }
  
  // Setup page observers for dynamic content
  function setupPageObservers(site) {
    // Observe for page changes (SPA navigation)
    const observer = new MutationObserver((mutations) => {
      // Check if we need to re-add the import button
      if (!document.getElementById('fairplay-scout-import-btn')) {
        setTimeout(() => addImportButton(site), 1000);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  // Initialize game detection
  function initializeGameDetection(site) {
    // This could be expanded to automatically detect when games are played
    // and offer to import them immediately
    console.log(`🎮 Game detection initialized for ${site.name}`);
  }
  
  // Get page information
  function getPageInfo() {
    return {
      url: window.location.href,
      title: document.title,
      site: currentSite,
      timestamp: new Date().toISOString()
    };
  }
  
  // Get user information from the page
  function getUserInfo() {
    const site = currentSite;
    let username = '';
    let userInfo = {};
    
    if (site.identifier === 'chess.com') {
      // Chess.com user detection
      const userElement = document.querySelector('[data-username]') || 
                         document.querySelector('.user-username') ||
                         document.querySelector('.username');
      
      if (userElement) {
        username = userElement.getAttribute('data-username') || 
                  userElement.textContent.trim();
      }
      
      // Try to get from URL
      if (!username) {
        const urlMatch = window.location.pathname.match(/\/member\/([^\/]+)/);
        if (urlMatch) {
          username = urlMatch[1];
        }
      }
      
    } else if (site.identifier === 'lichess') {
      // Lichess user detection
      const userElement = document.querySelector('.user-link') ||
                         document.querySelector('[data-user]') ||
                         document.querySelector('.username');
      
      if (userElement) {
        username = userElement.getAttribute('data-user') ||
                  userElement.textContent.trim().replace('@', '');
      }
      
      // Try to get from URL
      if (!username) {
        const urlMatch = window.location.pathname.match(/\/@\/([^\/]+)/);
        if (urlMatch) {
          username = urlMatch[1];
        }
      }
    }
    
    return {
      username: username,
      site: site.identifier,
      ...userInfo
    };
  }
  
  // Extract game data from current page
  function extractGameData() {
    // This could be expanded to extract specific game information
    // from game analysis pages
    return {
      hasGameData: false,
      gameId: null,
      players: [],
      result: null
    };
  }
  
})();