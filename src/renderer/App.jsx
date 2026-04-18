import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './components/Sidebar';
import Toolbar from './components/Toolbar';
import FileGrid from './components/FileGrid';
import ContextMenu from './components/ContextMenu';
import SettingsModal from './components/SettingsModal';
import ProfileGate from './components/ProfileGate';
import NewFolderModal from './components/NewFolderModal';
import ActivityPanel from './components/ActivityPanel';
import PreviewPanel from './components/PreviewPanel';
import StartupGate from './components/StartupGate';
import PinEntryModal from './components/PinEntryModal';
import TextInputModal from './components/TextInputModal';
import useContextMenu from './hooks/useContextMenu';

const api = window.vault || null;

export default function App() {
  const [profiles, setProfiles] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentPath, setCurrentPath] = useState('');
  const [entries, setEntries] = useState([]);
  const [viewMode, setViewMode] = useState('storage');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [activity, setActivity] = useState([]);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [preview, setPreview] = useState(null);
  const [entryMeta, setEntryMeta] = useState({ tags: [], note: '' });
  const [versions, setVersions] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [startupLocked, setStartupLocked] = useState(false);
  const [startupEnabled, setStartupEnabled] = useState(false);
  const [startupStatus, setStartupStatus] = useState('');
  const [theme, setTheme] = useState('neon');
  const [settingsReady, setSettingsReady] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinModalTitle, setPinModalTitle] = useState('');
  const [pinModalMessage, setPinModalMessage] = useState('');
  const [pinModalIsUnlock, setPinModalIsUnlock] = useState(false);
  const [textModalOpen, setTextModalOpen] = useState(false);
  const [textModalTitle, setTextModalTitle] = useState('');
  const [textModalLabel, setTextModalLabel] = useState('');
  const [textModalInitialValue, setTextModalInitialValue] = useState('');
  const pinModalResolveRef = useRef(null);
  const textModalResolveRef = useRef(null);
  const { menu, openMenu, closeMenu } = useContextMenu();
  const fileInputRef = useRef(null);
  const autoLockTimer = useRef(null);

  const requestPin = (message, title = 'Enter PIN', isUnlock = false) => {
    return new Promise((resolve) => {
      setPinModalTitle(title);
      setPinModalMessage(message);
      setPinModalIsUnlock(isUnlock);
      pinModalResolveRef.current = resolve;
      setPinModalOpen(true);
    });
  };

  const handlePinSubmit = async (pin) => {
    console.log('[PIN] PIN submitted:', pin.length === 4 ? '****' : 'invalid');
    pinModalResolveRef.current?.(pin);
    setPinModalOpen(false);
    return true;
  };

  const requestTextInput = (title, label, initialValue = '') => {
    return new Promise((resolve) => {
      setTextModalTitle(title);
      setTextModalLabel(label);
      setTextModalInitialValue(initialValue);
      textModalResolveRef.current = resolve;
      setTextModalOpen(true);
    });
  };

  const handleTextSubmit = async (value) => {
    textModalResolveRef.current?.(value);
    setTextModalOpen(false);
    return true;
  };

  const currentPathLabel = useMemo(() => (currentPath ? `/${currentPath}` : '/'), [currentPath]);
  const viewLabel = useMemo(() => {
    if (viewMode === 'storage') return currentPathLabel;
    if (viewMode === 'recent') return '/Recent';
    if (viewMode === 'favorites') return '/Favorites';
    if (viewMode === 'trash') return '/Trash';
    return currentPathLabel;
  }, [currentPathLabel, viewMode]);

  const refreshProfiles = useCallback(async () => {
    if (!api) return;
    const list = await api.getProfiles();
    setProfiles(list);
  }, []);

  const refreshEntries = useCallback(
    async (nextPath = currentPath, user = currentUser, mode = viewMode) => {
      if (!api || !user) return;
      if (mode === 'storage') {
        const list = await api.listEntries({ userId: user.id, path: nextPath });
        setEntries(list);
        return;
      }
      if (mode === 'favorites') {
        const list = await api.listFavorites({ userId: user.id });
        setEntries(list);
        return;
      }
      if (mode === 'recent') {
        const list = await api.listRecent({ userId: user.id, limit: 40 });
        setEntries(list);
        return;
      }
      if (mode === 'trash') {
        const list = await api.listTrash({ userId: user.id });
        setEntries(list);
      }
    },
    [currentPath, currentUser, viewMode]
  );

  const refreshActivity = useCallback(
    async (user = currentUser) => {
      if (!api || !user) return;
      const list = await api.listActivity({ userId: user.id, limit: 20 });
      setActivity(list);
    },
    [currentUser]
  );

  useEffect(() => {
    refreshProfiles();
  }, [refreshProfiles]);

  useEffect(() => {
    if (!api) return;
    api
      .getSettings()
      .then((data) => {
        setStartupEnabled(Boolean(data?.startupEnabled));
        setStartupLocked(Boolean(data?.startupEnabled));
        setTheme(data?.theme || 'neon');
        setSettingsReady(true);
      })
      .catch(() => {
        setSettingsReady(true);
      });
  }, []);

  useEffect(() => {
    const themes = ['theme-neon', 'theme-ember', 'theme-frost', 'theme-noir'];
    document.body.classList.remove(...themes);
    document.body.classList.add(`theme-${theme}`);
  }, [theme]);

  useEffect(() => {
    if (!status) return undefined;
    const timer = setTimeout(() => setStatus(''), 5000);
    return () => clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (!startupStatus) return undefined;
    const timer = setTimeout(() => setStartupStatus(''), 5000);
    return () => clearTimeout(timer);
  }, [startupStatus]);

  useEffect(() => {
    if (!api || !currentUser) return;
    refreshActivity();
  }, [currentUser, refreshActivity]);

  useEffect(() => {
    if (!api || !currentUser || viewMode !== 'storage') {
      setSearchResults([]);
      return;
    }
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      const results = await api.searchEntries({
        userId: currentUser.id,
        query: searchTerm,
        path: currentPath,
      });
      setSearchResults(results);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, currentUser, currentPath, viewMode]);

  const lockVault = useCallback(async () => {
    if (!api || !currentUser) return;
    await api.lockSession({ userId: currentUser.id });
    setCurrentUser(null);
    setCurrentPath('');
    setEntries([]);
    setSearchTerm('');
    setSearchResults([]);
    setSelectedEntry(null);
    setPreview(null);
    setEntryMeta({ tags: [], note: '' });
    setVersions([]);
    setViewMode('storage');
    setActivity([]);
  }, [currentUser]);

  const handleUnlockStartup = async (password) => {
    if (!api) return false;
    setStartupStatus('');
    const result = await api.unlockStartup({ password });
    if (!result.ok) {
      setStartupStatus(result.message || 'Unable to unlock startup gate.');
      return false;
    }
    setStartupLocked(false);
    return true;
  };

  const handleSelectView = async (mode) => {
    if (!currentUser) return;
    setViewMode(mode);
    setSearchTerm('');
    setSearchResults([]);
    setSelectedEntry(null);
    setPreview(null);
    setEntryMeta({ tags: [], note: '' });
    setVersions([]);
    setIsDragging(false);
    if (mode === 'storage') {
      await refreshEntries(currentPath, currentUser, 'storage');
    } else {
      await refreshEntries('', currentUser, mode);
    }
  };

  const handleSetTheme = async (nextTheme) => {
    if (!api) return;
    setTheme(nextTheme);
    await api.setTheme({ theme: nextTheme });
  };

  const handleSetStartupPassword = async (password) => {
    if (!api || !password) return;
    const result = await api.setStartupPassword({ password });
    if (!result.ok) {
      setStatus(result.message || 'Unable to set startup password.');
      return;
    }
    setStartupEnabled(true);
    setStatus('Startup password updated.');
  };

  const handleClearStartupPassword = async () => {
    if (!api) return;
    const result = await api.clearStartupPassword();
    if (!result.ok) {
      setStatus(result.message || 'Unable to clear startup password.');
      return;
    }
    setStartupEnabled(false);
    setStatus('Startup password removed.');
  };

  const handleExportActivity = async () => {
    if (!api || !currentUser) return;
    const result = await api.exportActivity({ userId: currentUser.id });
    if (result?.ok) {
      setStatus('Activity exported.');
    }
  };

  const handleExportVault = async () => {
    if (!api || !currentUser) return;
    const result = await api.exportVaultArchive({ userId: currentUser.id });
    if (result?.ok) {
      setStatus('Vault archive exported.');
    }
  };

  useEffect(() => {
    if (!currentUser) return undefined;

    const resetTimer = () => {
      if (autoLockTimer.current) {
        clearTimeout(autoLockTimer.current);
      }
      autoLockTimer.current = setTimeout(() => {
        lockVault();
      }, 5 * 60 * 1000);
    };

    const events = ['mousemove', 'keydown', 'mousedown', 'scroll', 'touchstart'];
    events.forEach((evt) => window.addEventListener(evt, resetTimer));
    resetTimer();

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, resetTimer));
      if (autoLockTimer.current) {
        clearTimeout(autoLockTimer.current);
      }
    };
  }, [currentUser, lockVault]);

  const handleOpenProfile = async (username, password) => {
    if (!api) return false;
    setStatus('');
    const result = await api.openProfile({ username, password });
    if (!result.ok) {
      setStatus(result.message || 'Unable to unlock profile.');
      return false;
    }

    setCurrentUser(result.user);
    setCurrentPath('');
    setViewMode('storage');
    await refreshEntries('', result.user, 'storage');
    await refreshActivity(result.user);
    return true;
  };

  const handleCreateProfile = async (username, password) => {
    if (!api) return false;
    setStatus('');
    const result = await api.createProfile({ username, password });
    if (!result.ok) {
      setStatus(result.message || 'Unable to create profile.');
      return false;
    }

    await refreshProfiles();
    return true;
  };

  const handleInviteCreate = async (username, password) => {
    if (!api) return { ok: false, message: 'Invite service unavailable.' };
    setStatus('');
    return api.createInvite({ username, password });
  };

  const handleInviteRedeem = async (code, username, password) => {
    if (!api) return { ok: false, message: 'Invite service unavailable.' };
    setStatus('');
    return api.redeemInvite({ code, username, password });
  };

  const handleUpdateProfile = async (payload) => {
    if (!api) return false;
    const result = await api.updateProfile({ userId: currentUser.id, ...payload });
    if (!result.ok) {
      setStatus(result.message || 'Unable to update profile.');
      return false;
    }

    await refreshProfiles();
    setCurrentUser((prev) => ({ ...prev, username: payload.username }));
    return true;
  };

  const handleOpenEntry = async (entry) => {
    if (!api || !currentUser) return;
    const entryPath = entry.storagePath || entry.relPath;
    if (entry.type === 'folder') {
      setViewMode('storage');
      setCurrentPath(entryPath);
      setSelectedEntry(null);
      setPreview(null);
      setEntryMeta({ tags: [], note: '' });
      setVersions([]);
      await refreshEntries(entryPath, currentUser, 'storage');
      return;
    }

    let password = '';
    if (entry.isLocked && entry.hasPassword) {
      const pin = requestPin('Enter 4-digit PIN to open this file:');
      if (pin === null) return;
      password = pin;
    }

    const result = await api.openEntry({ userId: currentUser.id, path: entryPath, password });
    if (result?.ok === false) {
      setStatus(result.message || 'Unable to open file.');
    }
    await refreshActivity();
  };

  const handleSelectEntry = async (entry) => {
    if (!api || !currentUser) return;
    const entryPath = entry.storagePath || entry.relPath;
    if (entry.type === 'folder') {
      setSelectedEntry(null);
      setPreview(null);
      setEntryMeta({ tags: [], note: '' });
      setVersions([]);
      return;
    }

    let password = '';
    if (entry.isLocked && entry.hasPassword) {
      const pin = requestPin('Enter 4-digit PIN to preview this file:');
      if (pin === null) return;
      password = pin;
    }

    const result = await api.previewEntry({ userId: currentUser.id, path: entryPath, password });
    setSelectedEntry(entry);
    setPreview(result);
    const metaResult = await api.getEntryMeta({ userId: currentUser.id, path: entryPath });
    setEntryMeta({ tags: metaResult.tags || [], note: metaResult.note || '' });
    const versionList = await api.listVersions({ userId: currentUser.id, path: entryPath });
    setVersions(versionList || []);
  };

  const handleBack = async () => {
    if (viewMode !== 'storage' || !currentPath) return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const nextPath = parts.join('/');
    setCurrentPath(nextPath);
    setSelectedEntry(null);
    setPreview(null);
    setEntryMeta({ tags: [], note: '' });
    setVersions([]);
    await refreshEntries(nextPath, currentUser, 'storage');
  };

  const handleNewFolder = async (name) => {
    if (!api || !currentUser || viewMode !== 'storage') return;
    const result = await api.createFolder({ userId: currentUser.id, path: currentPath, name });
    if (!result.ok) {
      setStatus(result.message || 'Unable to create folder.');
      return;
    }
    await refreshStorageView();
    await refreshActivity();
  };

  const handleDelete = async (entry) => {
    if (!api || !currentUser) return;
    const entryPath = entry.storagePath || entry.relPath;
    const confirmed = window.confirm(`Delete ${entry.name}? This cannot be undone.`);
    if (!confirmed) return;
    await api.deleteEntry({ userId: currentUser.id, path: entryPath });
    if (selectedEntry?.storagePath === entryPath || selectedEntry?.relPath === entry.relPath) {
      setSelectedEntry(null);
      setPreview(null);
      setEntryMeta({ tags: [], note: '' });
      setVersions([]);
    }
    if (viewMode === 'storage') {
      await refreshStorageView();
    } else {
      await refreshEntries(currentPath, currentUser, viewMode);
    }
    await refreshActivity();
  };

  const handleRename = async (entry) => {
    if (!api || !currentUser || viewMode !== 'storage') return;
    const entryPath = entry.storagePath || entry.relPath;
    const next = await requestTextInput('Rename Item', 'New name', entry.name);
    if (!next || next === entry.name) return;
    const result = await api.renameEntry({ userId: currentUser.id, path: entryPath, name: next });
    if (!result.ok) {
      setStatus(result.message || 'Unable to rename.');
      return;
    }
    await refreshStorageView();
    await refreshActivity();
  };

  const handleToggleLock = async (entry) => {
    try {
      console.log('[PIN Lock] Toggle lock clicked for entry:', entry);
      if (!api || !currentUser) {
        console.warn('[PIN Lock] API or currentUser missing');
        setStatus('Session error. Try refreshing.');
        return;
      }
      if (viewMode !== 'storage') {
        console.warn('[PIN Lock] Not in storage view:', viewMode);
        setStatus('PIN lock only works in storage view.');
        return;
      }
      if (!entry) {
        console.warn('[PIN Lock] No entry provided');
        setStatus('No file selected.');
        return;
      }
      if (entry.type !== 'file') {
        console.warn('[PIN Lock] Entry is not a file:', entry.type);
        setStatus('PIN lock is available for files only.');
        return;
      }

      const entryPath = entry.storagePath || entry.relPath;
      if (!entryPath) {
        console.warn('[PIN Lock] No entry path found');
        setStatus('Unable to identify file path.');
        return;
      }
      console.log('[PIN Lock] Processing entry:', entryPath, 'IsLocked:', entry.isLocked);

      if (entry.isLocked) {
        console.log('[PIN Lock] File is locked, prompting for unlock PIN');
        let password = '';
        if (entry.hasPassword) {
          const pin = await requestPin('Enter 4-digit PIN to unlock this file:', 'Unlock File', true);
          if (!pin) {
            console.log('[PIN Lock] Unlock cancelled by user');
            return;
          }
          password = pin;
          console.log('[PIN Lock] PIN entered for unlock');
        }

        console.log('[PIN Lock] Calling API to unlock...');
        const result = await api.toggleLock({
          userId: currentUser.id,
          path: entryPath,
          entryType: entry.type,
          locked: false,
          password,
        });
        console.log('[PIN Lock] Unlock result:', result);
        if (!result.ok) {
          console.error('[PIN Lock] Unlock failed:', result.message);
          setStatus(result.message || 'Unable to unlock.');
          return;
        }
        console.log('[PIN Lock] File unlocked successfully');
        setStatus('File unlocked.');
        
        // Update selected entry if it's the unlocked file
        if (selectedEntry?.storagePath === entryPath || selectedEntry?.relPath === entryPath) {
          setSelectedEntry(prev => ({ ...prev, isLocked: false }));
        }
        
        await refreshStorageView();
        await refreshActivity();
        return;
      }

      console.log('[PIN Lock] File is unlocked, prompting for new PIN');
      const password = await requestPin('Set a 4-digit PIN for this file:', 'Lock File', false);
      if (!password) {
        console.log('[PIN Lock] Lock cancelled by user');
        return;
      }
      console.log('[PIN Lock] Requesting PIN confirmation');
      const confirmPin = await requestPin('Re-enter the 4-digit PIN to confirm:', 'Confirm PIN', false);
      if (!confirmPin) {
        console.log('[PIN Lock] Confirmation cancelled by user');
        return;
      }
      if (password !== confirmPin) {
        console.warn('[PIN Lock] PIN mismatch');
        setStatus('PIN confirmation does not match.');
        return;
      }
      console.log('[PIN Lock] PINs match, calling API to lock...');
      const result = await api.toggleLock({
        userId: currentUser.id,
        path: entryPath,
        entryType: entry.type,
        locked: true,
        password,
      });
      console.log('[PIN Lock] Lock result:', result);
      if (result?.ok === false) {
        console.error('[PIN Lock] Lock failed:', result.message);
        setStatus(result.message || 'Unable to lock.');
        return;
      }
      console.log('[PIN Lock] File locked successfully');
      setStatus('File locked with 4-digit PIN.');
      
      // Update selected entry if it's the locked file
      if (selectedEntry?.storagePath === entryPath || selectedEntry?.relPath === entryPath) {
        setSelectedEntry(prev => ({ ...prev, isLocked: true, hasPassword: true }));
      }
      
      await refreshStorageView();
      await refreshActivity();
    } catch (error) {
      console.error('[PIN Lock] Unexpected error:', error);
      setStatus(`Error: ${error.message || 'Unknown error occurred'}`);
    }
  };

  const handleToggleFavorite = async (entry) => {
    if (!api || !currentUser) return;
    const entryPath = entry.storagePath || entry.relPath;
    const result = await api.toggleFavorite({ userId: currentUser.id, path: entryPath });
    if (!result.ok) {
      setStatus(result.message || 'Unable to update favorites.');
      return;
    }
    if (viewMode === 'favorites' && result.favorite === false) {
      if (selectedEntry?.storagePath === entryPath || selectedEntry?.relPath === entry.relPath) {
        setSelectedEntry(null);
        setPreview(null);
        setEntryMeta({ tags: [], note: '' });
        setVersions([]);
      }
    }
    if (viewMode === 'storage' && searchTerm.trim()) {
      const results = await api.searchEntries({
        userId: currentUser.id,
        query: searchTerm,
        path: currentPath,
      });
      setSearchResults(results);
      return;
    }
    await refreshEntries(currentPath, currentUser, viewMode);
  };

  const handleSaveMeta = async (tagsText, noteText) => {
    if (!api || !currentUser || !selectedEntry) return;
    const entryPath = selectedEntry.storagePath || selectedEntry.relPath;
    const tags = tagsText
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    const result = await api.setEntryMeta({ userId: currentUser.id, path: entryPath, tags, note: noteText });
    if (!result.ok) {
      setStatus(result.message || 'Unable to save notes.');
      return;
    }
    setEntryMeta({ tags, note: noteText });
    setStatus('Notes saved.');
  };

  const handleCreateVersion = async (entry) => {
    if (!api || !currentUser) return;
    const entryPath = entry.storagePath || entry.relPath;
    const result = await api.createVersion({ userId: currentUser.id, path: entryPath });
    if (!result.ok) {
      setStatus(result.message || 'Unable to save version.');
      return;
    }
    const versionList = await api.listVersions({ userId: currentUser.id, path: entryPath });
    setVersions(versionList || []);
    setStatus('Version saved.');
  };

  const handleRestoreVersion = async (versionId) => {
    if (!api || !currentUser) return;
    const result = await api.restoreVersion({ userId: currentUser.id, versionId });
    if (!result.ok) {
      setStatus(result.message || 'Unable to restore version.');
      return;
    }
    setStatus('Version restored.');
  };

  const handleRestoreTrash = async (entry) => {
    if (!api || !currentUser) return;
    const result = await api.restoreTrash({ userId: currentUser.id, trashId: entry.id });
    if (!result.ok) {
      setStatus(result.message || 'Unable to restore item.');
      return;
    }
    if (selectedEntry?.id === entry.id) {
      setSelectedEntry(null);
      setPreview(null);
      setEntryMeta({ tags: [], note: '' });
      setVersions([]);
    }
    await refreshEntries('', currentUser, 'trash');
    await refreshActivity();
  };

  const handlePurgeTrash = async (entry) => {
    if (!api || !currentUser) return;
    const confirmed = window.confirm(`Delete ${entry.name} permanently?`);
    if (!confirmed) return;
    const result = await api.purgeTrash({ userId: currentUser.id, trashId: entry.id });
    if (!result.ok) {
      setStatus(result.message || 'Unable to delete permanently.');
      return;
    }
    if (selectedEntry?.id === entry.id) {
      setSelectedEntry(null);
      setPreview(null);
      setEntryMeta({ tags: [], note: '' });
      setVersions([]);
    }
    await refreshEntries('', currentUser, 'trash');
    await refreshActivity();
  };

  const handleOpenCmd = async () => {
    if (!api || !currentUser || viewMode !== 'storage') return;
    await api.openCmd({ userId: currentUser.id, path: currentPath });
  };

  const handleImportFiles = async (fileList) => {
    if (!api || !currentUser || viewMode !== 'storage') return;
    const files = await Promise.all(
      Array.from(fileList).map(async (file) => ({
        name: file.name,
        data: await file.arrayBuffer(),
      }))
    );
    const result = await api.importFiles({ userId: currentUser.id, path: currentPath, files });
    if (!result.ok) {
      setStatus(result.message || 'Unable to import files.');
    }
    await refreshStorageView();
    await refreshActivity();
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    setIsDragging(false);
    if (viewMode !== 'storage') return;
    if (!event.dataTransfer?.files?.length) return;
    await handleImportFiles(event.dataTransfer.files);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    if (viewMode !== 'storage') return;
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleImportClick = () => {
    if (viewMode !== 'storage') return;
    fileInputRef.current?.click();
  };

  const handleSearchChange = (value) => {
    if (viewMode !== 'storage') return;
    setSearchTerm(value);
  };

  const refreshStorageView = async () => {
    if (!api || !currentUser) return;
    if (searchTerm.trim()) {
      const results = await api.searchEntries({
        userId: currentUser.id,
        query: searchTerm,
        path: currentPath,
      });
      setSearchResults(results);
      return;
    }
    await refreshEntries(currentPath, currentUser, 'storage');
  };

  const visibleEntries = viewMode === 'storage' && searchTerm.trim() ? searchResults : entries;

  if (!api) {
    return (
      <div className="app-shell error-shell">
        <div className="error-card">
          <h1>Electron context not detected</h1>
          <p>Run the app with `npm run dev` so the preload bridge can connect.</p>
        </div>
      </div>
    );
  }

  if (!settingsReady) {
    return (
      <div className="app-shell error-shell">
        <div className="error-card">
          <h1>Loading vault</h1>
          <p>Preparing security settings...</p>
        </div>
      </div>
    );
  }

  if (startupLocked) {
    return <StartupGate status={startupStatus} onUnlock={handleUnlockStartup} />;
  }

  if (!currentUser) {
    return (
      <ProfileGate
        profiles={profiles}
        status={status}
        onCreate={handleCreateProfile}
        onOpen={handleOpenProfile}
        onRefresh={refreshProfiles}
        onInviteCreate={handleInviteCreate}
        onInviteRedeem={handleInviteRedeem}
      />
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        currentUser={currentUser}
        onSettings={() => setSettingsOpen(true)}
        onLock={lockVault}
        activeView={viewMode}
        onSelectView={handleSelectView}
      />
      <main className="app-main">
        <Toolbar
          pathLabel={viewLabel}
          onBack={handleBack}
          onNewFolder={() => setNewFolderOpen(true)}
          onOpenCmd={handleOpenCmd}
          onSettings={() => setSettingsOpen(true)}
          onLock={lockVault}
          onImport={handleImportClick}
          searchTerm={searchTerm}
          onSearch={handleSearchChange}
          canNavigate={viewMode === 'storage' && Boolean(currentPath)}
          canMutate={viewMode === 'storage'}
          searchDisabled={viewMode !== 'storage'}
        />
        {status ? <div className="status-banner">{status}</div> : null}
        <section
          className={`app-content ${isDragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragLeave={handleDragLeave}
        >
          {isDragging ? <div className="drop-overlay">Drop files to encrypt & store</div> : null}
          <div className="content-grid">
            <div className="content-main">
              {viewMode === 'storage' && searchTerm.trim() ? (
                <p className="search-note">Showing results for "{searchTerm}"</p>
              ) : null}
              <FileGrid
                entries={visibleEntries}
                onOpen={handleOpenEntry}
                onContextMenu={openMenu}
                onSelect={handleSelectEntry}
                selectedPath={selectedEntry?.relPath}
              />
            </div>
            <div className="content-side">
              <PreviewPanel
                entry={selectedEntry}
                preview={preview}
                meta={entryMeta}
                versions={versions}
                onSaveMeta={handleSaveMeta}
                onRestoreVersion={handleRestoreVersion}
                onCreateVersion={
                  viewMode === 'storage' && selectedEntry?.type === 'file'
                    ? () => handleCreateVersion(selectedEntry)
                    : null
                }
              />
              <ActivityPanel items={activity} />
            </div>
          </div>
        </section>
      </main>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden-file-input"
        onChange={(event) => {
          if (!event.target.files?.length) return;
          handleImportFiles(event.target.files);
          event.target.value = '';
        }}
      />

      <ContextMenu
        menu={menu}
        onClose={closeMenu}
        viewMode={viewMode}
        onAction={(action) => {
          if (!menu.entry) return;
          if (action === 'open') handleOpenEntry(menu.entry);
          if (action === 'rename') handleRename(menu.entry);
          if (action === 'delete') handleDelete(menu.entry);
          if (action === 'toggleLock') handleToggleLock(menu.entry);
          if (action === 'toggleFavorite') handleToggleFavorite(menu.entry);
          if (action === 'createVersion') handleCreateVersion(menu.entry);
          if (action === 'restore') handleRestoreTrash(menu.entry);
          if (action === 'purge') handlePurgeTrash(menu.entry);
          closeMenu();
        }}
      />

      <SettingsModal
        open={settingsOpen}
        profile={currentUser}
        status={status}
        theme={theme}
        startupEnabled={startupEnabled}
        onClose={() => setSettingsOpen(false)}
        onSave={handleUpdateProfile}
        onSetTheme={handleSetTheme}
        onSetStartupPassword={handleSetStartupPassword}
        onClearStartupPassword={handleClearStartupPassword}
        onExportActivity={handleExportActivity}
        onExportVault={handleExportVault}
      />

      <NewFolderModal
        open={newFolderOpen}
        onClose={() => setNewFolderOpen(false)}
        onCreate={handleNewFolder}
      />

      <PinEntryModal
        open={pinModalOpen}
        title={pinModalTitle}
        message={pinModalMessage}
        isUnlock={pinModalIsUnlock}
        onClose={() => setPinModalOpen(false)}
        onSubmit={handlePinSubmit}
      />

      <TextInputModal
        open={textModalOpen}
        title={textModalTitle}
        label={textModalLabel}
        initialValue={textModalInitialValue}
        onClose={() => setTextModalOpen(false)}
        onSubmit={handleTextSubmit}
      />
    </div>
  );
}
