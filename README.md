# Secure File Manager 🔐

A desktop file vault application built with Electron and React, providing encrypted file storage with multi-profile support, advanced file management, and comprehensive audit logging. Perfect for securely organizing and sharing sensitive files.

## Features

### Core Security Features
- **AES-256-GCM Encryption**: Military-grade encryption for all stored files
- **Multi-Profile Support**: Separate encrypted vaults for different users
- **Global Startup Password**: Optional gate before profile selection
- **Session-Based Access**: Per-profile encryption key management
- **Auto-Lock**: Automatic vault locking after period of inactivity
- **Bcrypt Password Hashing**: Secure password storage with salting and stretching

### File Management
- **Drag & Drop Import**: Intuitive file import with folder structure preservation
- **Encrypted Storage**: All files automatically encrypted before storage
- **File Preview**: Quick preview of encrypted file metadata
- **Rename Files**: In-vault file renaming with encryption preservation
- **Lock Individual Files**: Pin important files to prevent accidental deletion
- **Search Functionality**: Full-text search across all file names and metadata
- **Favorites System**: Mark important files for quick access
- **Recent Files View**: Quick access to recently viewed/modified files
- **File Versioning**: Create and restore from multiple file versions
- **Trash System**: Soft delete with restore capability instead of permanent deletion
- **Metadata & Tagging**: Add custom tags and notes to any file

### Data Management & Export
- **Activity Logging**: Comprehensive audit log of all vault operations
- **Activity Export**: Export activity logs as CSV for auditing
- **Vault Export**: Full backup of encrypted vault as ZIP archive
- **Auto-Backup/Export**: Configurable automatic vault exports

### Sharing & Collaboration
- **Invite Codes**: Generate one-time codes to invite others to create local profiles
- **Code Generation**: Unique invite codes with expiration tracking
- **Code Redemption**: Simple redemption flow for new users

### Customization
- **Theme Presets**: Four built-in themes (Neon, Ember, Frost, Noir)
- **Custom Styling**: Full theme customization via CSS variables
- **Dark Mode**: Professional dark interface by default

### Extended Features
- **Folder Navigation**: Create and navigate folder structures
- **File Locking**: Pin important files to prevent accidental operations
- **Detailed Previews**: View comprehensive file information and history
- **Batch Operations**: Context menu for file operations

## Installation

### Prerequisites
- **Node.js**: v16 or higher
- **npm**: v7 or higher
- **Windows/macOS/Linux**: Desktop OS with Electron support

### Setup Steps

1. **Clone the Repository**
   ```bash
   git clone https://github.com/yourusername/secure-file-manager.git
   cd secure-file-manager
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```
   This installs:
   - Electron 31.1.0 (desktop framework)
   - React 18.3.1 (UI framework)
   - better-sqlite3 (encrypted database)
   - bcryptjs (password hashing)
   - archiver (vault export/backup)
   - And development tools (Vite, concurrently, electron-builder)

3. **Start Development Server**
   ```bash
   npm run dev
   ```
   This launches:
   - Vite dev server on `http://localhost:5173`
   - Electron app connected to dev server
   - Hot reload enabled for React components

4. **Build for Production**
   ```bash
   npm run build
   ```

5. **Package Application**
   ```bash
   npm run pack
   ```
   Creates installers for your platform using electron-builder

## Quick Start Guide

### First Launch

1. **Create Your First Profile**
   - Application opens to ProfileGate
   - Click "Create New Profile"
   - Enter desired username and password
   - Click "Create Profile"

2. **Set Global Security (Optional)**
   - Open Settings (gear icon)
   - Enable "Startup Password"
   - Enter and confirm password
   - This password will be required before profile selection on future launches

3. **Import Files**
   - Click "Import Files" in toolbar
   - Select files or folders
   - Files are automatically encrypted and organized

### Working with Vaults

#### Storage View (Default)
- Main view showing all files and folders
- Drag & drop files to import
- Right-click for context menu options
- Search bar for finding files

#### Favorites
- Click ⭐ Sidebar item to view favorites
- Right-click files to add/remove from favorites
- Quick access to important files

#### Recent Files
- Click "Recent" in sidebar
- Shows 60 most recently accessed files
- Automatically updated as you browse

#### Trash
- Click "Trash" in sidebar
- Shows deleted files with original paths
- Restore individual files or purge all
- Files stay encrypted in trash

#### File Versioning
- Select any file and click "Create Version" in preview panel
- All versions stored in hidden `.versions/` directory
- Restore from any previous version
- Versions automatically created on import if enabled

### Adding File Metadata

1. **Select a File**
   - Click any file in the vault
   - Preview panel opens on the right

2. **Add Tags**
   - Enter comma-separated tags (e.g., "important, work, 2024")
   - Tags are saved automatically

3. **Add Notes**
   - Type description or notes about the file
   - Click "Save Notes" to persist

### Exporting & Backup

1. **Export Activity Log**
   - Open Settings
   - Click "Export Activity (CSV)"
   - Audit log downloaded with timestamps

2. **Export Full Vault**
   - Open Settings
   - Click "Export Vault (ZIP)"
   - Complete encrypted vault backed up
   - Use for recovery or migration

### Inviting Others

1. **Create Invite Code**
   - Open ProfileGate or click "Invite Access"
   - Click "Create Invite Code"
   - Select profile and verify password
   - Code generated and displayed

2. **Share Code**
   - Copy the 8-character invite code
   - Share via secure channel
   - Code valid for 7 days

3. **Redeem Invite**
   - New user launches app
   - Click "Redeem Invite" on ProfileGate
   - Enter code, desired username, and password
   - New profile created with invite-linked history

## Architecture

### Technology Stack

**Frontend**
- React 18.3.1 - UI framework
- Vite 5.4.6 - Build tool with HMR
- CSS3 - Styling with theme variables

**Backend**
- Electron 31.1.0 - Desktop framework
- better-sqlite3 - Local database
- Node.js APIs - File system operations

**Security**
- crypto (Node.js native) - AES-256-GCM encryption
- scrypt - Key derivation from passwords
- bcryptjs - Password hashing (12 rounds)

**Build & Distribution**
- electron-builder - App packaging
- concurrently - Development server orchestration

### Application Structure

```
secure-file-manager/
├── src/
│   ├── main/
│   │   ├── main.js                 # Electron main process entry
│   │   ├── ipc.js                  # IPC handlers (main↔renderer communication)
│   │   ├── db/
│   │   │   └── index.js            # SQLite schema & initialization
│   │   ├── services/
│   │   │   ├── crypto.js           # Encryption/decryption logic
│   │   │   ├── sessions.js         # Session & key management
│   │   │   ├── vault.js            # File operations & vault logic
│   │   │   └── settings.js         # Application settings
│   │   └── utils/
│   │       └── paths.js            # File system path utilities
│   ├── preload/
│   │   └── index.js                # Preload bridge to expose APIs
│   └── renderer/
│       ├── App.jsx                 # Main React component
│       ├── styles.css              # Application styles & themes
│       └── components/
│           ├── StartupGate.jsx     # Global password gate
│           ├── ProfileGate.jsx     # Profile selection & creation
│           ├── Toolbar.jsx         # Top navigation & search
│           ├── Sidebar.jsx         # View switching (Storage/Recent/Favorites/Trash)
│           ├── FileGrid.jsx        # File display grid
│           ├── ContextMenu.jsx     # Right-click actions
│           ├── PreviewPanel.jsx    # File details & metadata
│           ├── SettingsModal.jsx   # Settings & preferences
│           ├── ActivityPanel.jsx   # Activity log viewer
│           └── NewFolderModal.jsx  # Folder creation modal
├── vite.config.js                  # Vite configuration
├── package.json                    # Dependencies & scripts
└── README.md                        # This file
```

### Data Flow

**File Import Flow**
```
User selects files
    ↓
Files read from disk
    ↓
Each file encrypted with user's key (AES-256-GCM)
    ↓
Encrypted data stored in vault directory
    ↓
File metadata stored in database
    ↓
Activity log entry created
    ↓
UI updated with new files
```

**Profile Management Flow**
```
App launch
    ↓
Check if startup password set
    ↓
If set: StartupGate → verify password → clear
    ↓
ProfileGate: Select or create profile
    ↓
Verify profile password
    ↓
Derive encryption key from password
    ↓
Load profile vault
    ↓
User can now view/manage files
```

**Settings Encryption Flow**
```
User enters password
    ↓
Password hashed with bcrypt (12 rounds)
    ↓
Hash stored in database
    ↓
On verification: hash entered password and compare
    ↓
Never store plaintext passwords
```

## Database Schema

### Tables

**profiles**
- `id` - UUID primary key
- `name` - Profile username
- `passwordHash` - bcrypt hash of profile password
- `vaultPath` - Path to encrypted file storage
- `createdAt` - Timestamp

**settings**
- `key` - Setting name (unique)
- `value` - JSON-serialized value
- Stores: startup password hash, theme, auto-lock timeout

**favorites**
- `userId` - Profile ID (FK)
- `entryPath` - File path in vault
- `addedAt` - Timestamp
- Composite PK: (userId, entryPath)

**entry_meta**
- `userId` - Profile ID (FK)
- `entryPath` - File path
- `tags` - JSON array of tags
- `notes` - Text notes
- Composite PK: (userId, entryPath)

**trash**
- `userId` - Profile ID (FK)
- `originalPath` - Original location in vault
- `trashPath` - Location in `.trash/`
- `trashedAt` - Timestamp
- Foreign key ensures orphan cleanup on profile deletion

**versions**
- `userId` - Profile ID (FK)
- `entryPath` - File path
- `versionId` - Unique version identifier
- `versionPath` - Path in `.versions/`
- `createdAt` - Timestamp
- Foreign key ensures cleanup on profile deletion

**invites**
- `code` - 8-char unique invite code
- `creatorId` - Profile that created code (FK)
- `createdAt` - Timestamp
- `expiresAt` - Expiration timestamp (7 days)
- `redeemedAt` - Redemption timestamp (nullable)
- UNIQUE constraint on code field

**activity**
- `id` - Auto-increment primary key
- `userId` - Profile ID (FK)
- `action` - Type of action (import, create, delete, etc.)
- `targetPath` - File/folder affected
- `details` - JSON with additional info
- `timestamp` - Exact time of action

## Security Considerations

### Encryption Implementation

1. **File Encryption**
   - Algorithm: AES-256-GCM
   - IV: Randomly generated for each file (prepended to ciphertext)
   - Authentication: Galois/Counter Mode provides authenticated encryption
   - Key derivation: scrypt (N=16384, r=8, p=1)

2. **Password Security**
   - Passwords never stored in plaintext
   - Profile passwords hashed with bcrypt (12 rounds)
   - Startup password hashed with bcrypt (12 rounds)
   - Each encryption key derived from password on each unlock

3. **Session Management**
   - Encryption keys kept only in memory
   - Keys cleared when switching profiles
   - Auto-lock feature locks and clears keys

4. **File Storage**
   - All files encrypted before disk write
   - Vault directory contains only encrypted blobs
   - Metadata encrypted separately
   - Hidden directories (`.trash/`, `.versions/`) outside user vault

### Security Best Practices

- ✅ Use strong, unique passwords (8+ characters, mix of types)
- ✅ Enable startup password for additional security
- ✅ Regularly export vault backups to external storage
- ✅ Don't share invite codes via insecure channels
- ✅ Lock vault when stepping away (auto-lock enabled by default)
- ✅ Review activity logs periodically
- ✅ Keep application and dependencies updated
- ⚠️ Backup encryption key location locally (not in cloud by default)

## API Reference

### Vault Operations

**List Entries**
```javascript
api.listEntries(folderPath)
// Returns: [{ name, path, isFolder, isFavorite, isLocked, createdAt }]
```

**Import Files**
```javascript
api.importFiles(sourcePaths, targetFolder)
// Returns: { ok, message, count }
```

**Delete Entry**
```javascript
api.deleteEntry(path)
// Moves to trash instead of permanent deletion
// Returns: { ok, message }
```

**Create Folder**
```javascript
api.createFolder(parentPath, folderName)
// Returns: { ok, message }
```

**Search**
```javascript
api.searchEntries(query, folderPath)
// Returns: [matching entries]
```

### Metadata & Favorites

**Get Metadata**
```javascript
api.getEntryMeta(path)
// Returns: { tags: [], notes: "" }
```

**Set Metadata**
```javascript
api.setEntryMeta(path, { tags, notes })
// Returns: { ok, message }
```

**Toggle Favorite**
```javascript
api.toggleFavorite(path)
// Returns: { ok, message, isFavorite }
```

**List Favorites**
```javascript
api.listFavorites()
// Returns: [favorite entries]
```

### File Versioning

**Create Version**
```javascript
api.createVersion(path)
// Returns: { ok, message, versionId }
```

**List Versions**
```javascript
api.listVersions(path)
// Returns: [{ versionId, createdAt }]
```

**Restore Version**
```javascript
api.restoreVersion(path, versionId)
// Returns: { ok, message }
```

### Trash Management

**List Trash**
```javascript
api.listTrash()
// Returns: [{ originalPath, trashedAt }]
```

**Restore from Trash**
```javascript
api.restoreTrash(originalPath)
// Returns: { ok, message }
```

**Purge Trash**
```javascript
api.purgeTrash(originalPath)
// Returns: { ok, message }
```

### Exports

**Export Activity**
```javascript
api.exportActivity()
// Returns: CSV file path
// Includes: action, targetPath, timestamp, details
```

**Export Vault**
```javascript
api.exportVault()
// Returns: ZIP file path
// Contains: Full encrypted vault backup
```

### Settings

**Get All Settings**
```javascript
api.getSettings()
// Returns: { theme, startupEnabled }
```

**Set Theme**
```javascript
api.setTheme(themeName)
// themeName: 'neon' | 'ember' | 'frost' | 'noir'
```

**Set Startup Password**
```javascript
api.setStartupPassword(password)
// Returns: { ok, message }
```

### Invites

**Create Invite**
```javascript
api.createInviteCode(profileId, password)
// Returns: { ok, code, expiresAt }
```

**Redeem Invite**
```javascript
api.redeemInvite(code, username, password)
// Returns: { ok, message, profileId }
```

## Development

### Development Commands

```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Package as installer
npm run pack

# Start production app
npm start
```

### Development Workflow

1. **Start Dev Server**
   ```bash
   npm run dev
   ```
   - Vite dev server runs on localhost:5173
   - Electron connects to dev server
   - React hot reload enabled
   - Changes auto-reflect in running app

2. **Make Changes**
   - Edit files in `src/renderer/` or `src/main/`
   - React components auto-reload
   - Main process changes require manual reload (Ctrl+R)

3. **Test Changes**
   - Use DevTools: Ctrl+Shift+I
   - Console shows errors and logs
   - Network tab shows IPC communication

4. **Debug Sessions**
   - Set breakpoints in DevTools
   - Step through code execution
   - Inspect variables and state

### Building Locally

```bash
# Production build
npm run build

# Creates optimized bundle in dist/
# Run with: npm start
```

### Troubleshooting Development

**Issue: Vite dev server not connecting**
- Ensure port 5173 is available
- Clear browser cache
- Restart dev server

**Issue: Database locked error**
- Close app completely
- Delete database lock files
- Restart dev server

**Issue: Module not found**
- Run `npm install` again
- Delete `node_modules/` and reinstall
- Check import paths match file locations

**Issue: Electron app crashes**
- Check main process logs in terminal
- Enable verbose logging
- Run `npm rebuild better-sqlite3` if DB errors

## Configuration

### Environment Variables

Create `.env` file in project root:

```env
# Optional: Set custom vault directory
VAULT_DIR=~/.secure-vault

# Optional: Enable debug logging
DEBUG=secure-file-manager:*

# Optional: Set auto-lock timeout (minutes)
AUTO_LOCK_TIMEOUT=15
```

### Themes

Built-in themes (set in Settings):

- **Neon**: Vibrant cyan/purple accents (default)
- **Ember**: Warm orange/red tones
- **Frost**: Cool blue/white minimalist
- **Noir**: Grayscale professional

Customize via CSS variables in `src/renderer/styles.css`:

```css
body.theme-custom {
  --primary-color: #your-color;
  --secondary-color: #your-color;
  --accent-color: #your-color;
  --background-color: #your-color;
  --text-color: #your-color;
}
```

## Production Build & Distribution

### Building for Release

```bash
# Build optimized bundle
npm run build

# Package as installer (creates installer files)
npm run pack
```

### Platform-Specific Builds

Configure in `vite.config.js` and `electron-builder`:

```bash
# Windows
npm run pack -- --win

# macOS
npm run pack -- --mac

# Linux
npm run pack -- --linux
```

## Performance Optimization

- Vite provides instant HMR for development
- Code splitting for optimal bundle size
- Lazy loading of components in production
- SQLite indexed queries for fast searches
- Streaming file operations for large imports

## Future Enhancements

- Cloud sync with E2E encryption
- Mobile companion app
- Batch file operations
- Advanced search filters
- Custom encryption algorithms
- Two-factor authentication
- File sharing with expiration
- Collaborative vault access
- Plugin system for extensibility

## License

ISC

## Contributing

Contributions welcome! Please:

1. Fork repository
2. Create feature branch
3. Make changes with clear commit messages
4. Submit pull request

## Support

For issues, questions, or suggestions:

- Open GitHub issue
- Check existing issues for solutions
- Include error logs and steps to reproduce

## Security Policy

Security is a priority. If you discover vulnerabilities:

1. **Do not** open public issue
2. Email security report privately
3. Include reproduction steps
4. Allow time for patch development

---

**Built with ❤️ for secure file management**

*Last Updated: April 2026*
*Version: 1.0.0*