# FairPlay-Scout Browser Extension

A browser extension for importing chess games directly from Chess.com and Lichess for anti-cheat analysis.

## Features

- **Direct Import**: Import games from Chess.com and Lichess with one click
- **Real-time Analysis**: Live score updates during import process
- **Rate Limiting**: Respects API rate limits automatically
- **Settings Management**: Configurable import preferences
- **History Tracking**: View import history and statistics

## Installation

### Development Mode
1. Build the extension:
   ```bash
   cd src/extension
   npm install
   npm run build
   ```

2. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/` folder

### Production Build
```bash
npm run package
```

This creates a `fairplay-scout-extension.zip` file ready for distribution.

## Usage

1. Navigate to Chess.com or Lichess
2. Click the FairPlay-Scout extension icon
3. Configure import settings (username, game limit)
4. Click "Import Games" to start the process
5. Monitor progress in real-time

## Architecture

- **Manifest V3**: Modern extension architecture
- **Content Scripts**: Inject functionality into chess sites
- **Background Service Worker**: Handle API calls and data processing
- **Popup Interface**: User-friendly import configuration

## Files

- `manifest.json`: Extension configuration
- `popup.html/js/css`: User interface
- `content-script.js`: Site integration
- `service-worker.js`: Background processing

## Development

```bash
# Install dependencies
npm install

# Development build with watch
npm run dev

# Production build
npm run build

# Clean build artifacts
npm run clean
```

## Permissions

- `activeTab`: Access current tab for site detection
- `storage`: Save user preferences and import history
- `scripting`: Inject content scripts
- Host permissions for Chess.com and Lichess APIs