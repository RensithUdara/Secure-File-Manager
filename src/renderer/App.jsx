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
import useContextMenu from './hooks/useContextMenu';

const api = window.vault || null;

export default function App() {
  const [profiles, setProfiles] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentPath, setCurrentPath] = useState('');
  const [entries, setEntries] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [activity, setActivity] = useState([]);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const { menu, openMenu, closeMenu } = useContextMenu();
  const fileInputRef = useRef(null);
  const autoLockTimer = useRef(null);

  const currentPathLabel = useMemo(() => (currentPath ? `/${currentPath}` : '/'), [currentPath]);

  const refreshProfiles = useCallback(async () => {
    if (!api) return;
    const list = await api.getProfiles();
    setProfiles(list);
  }, []);

  const refreshEntries = useCallback(
    async (nextPath = currentPath, user = currentUser) => {
      if (!api || !user) return;
      const list = await api.listEntries({ userId: user.id, path: nextPath });
      setEntries(list);
    },
    [currentPath, currentUser]
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
    if (!status) return undefined;
    const timer = setTimeout(() => setStatus(''), 5000);
    return () => clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (!api || !currentUser) return;
    refreshActivity();
  }, [currentUser, refreshActivity]);

  useEffect(() => {
    if (!currentUser) return;
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
  }, [searchTerm, currentUser, currentPath]);

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
    setActivity([]);
  }, [currentUser]);

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
    await refreshEntries('', result.user);
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
    if (entry.type === 'folder') {
      setCurrentPath(entry.relPath);
      setSelectedEntry(null);
      setPreview(null);
      await refreshEntries(entry.relPath);
      return;
    }

    let password = '';
    if (entry.isLocked && entry.hasPassword) {
      const input = window.prompt('Enter lock password:', '');
      if (input === null) return;
      password = input;
    }

    const result = await api.openEntry({ userId: currentUser.id, path: entry.relPath, password });
    if (result?.ok === false) {
      setStatus(result.message || 'Unable to open file.');
    }
    await refreshActivity();
  };

  const handleSelectEntry = async (entry) => {
    if (!api || !currentUser) return;
    if (entry.type === 'folder') {
      setSelectedEntry(null);
      setPreview(null);
      return;
    }

    let password = '';
    if (entry.isLocked && entry.hasPassword) {
      const input = window.prompt('Enter lock password to preview:', '');
      if (input === null) return;
      password = input;
    }

    const result = await api.previewEntry({ userId: currentUser.id, path: entry.relPath, password });
    setSelectedEntry(entry);
    setPreview(result);
  };

  const handleBack = async () => {
    if (!currentPath) return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const nextPath = parts.join('/');
    setCurrentPath(nextPath);
    setSelectedEntry(null);
    setPreview(null);
    await refreshEntries(nextPath);
  };

  const handleNewFolder = async (name) => {
    if (!api || !currentUser) return;
    const result = await api.createFolder({ userId: currentUser.id, path: currentPath, name });
    if (!result.ok) {
      setStatus(result.message || 'Unable to create folder.');
      return;
    }
    await refreshEntries(currentPath);
    await refreshActivity();
  };

  const handleDelete = async (entry) => {
    if (!api || !currentUser) return;
    const confirmed = window.confirm(`Delete ${entry.name}? This cannot be undone.`);
    if (!confirmed) return;
    await api.deleteEntry({ userId: currentUser.id, path: entry.relPath });
    await refreshEntries(currentPath);
    await refreshActivity();
  };

  const handleRename = async (entry) => {
    if (!api || !currentUser) return;
    const next = window.prompt('Rename item:', entry.name);
    if (!next || next === entry.name) return;
    const result = await api.renameEntry({ userId: currentUser.id, path: entry.relPath, name: next });
    if (!result.ok) {
      setStatus(result.message || 'Unable to rename.');
      return;
    }
    await refreshEntries(currentPath);
    await refreshActivity();
  };

  const handleToggleLock = async (entry) => {
    if (!api || !currentUser) return;
    if (entry.isLocked) {
      let password = '';
      if (entry.hasPassword) {
        const input = window.prompt('Enter lock password to unlock:', '');
        if (input === null) return;
        password = input;
      }

      const result = await api.toggleLock({
        userId: currentUser.id,
        path: entry.relPath,
        entryType: entry.type,
        locked: false,
        password,
      });
      if (!result.ok) {
        setStatus(result.message || 'Unable to unlock.');
        return;
      }
      await refreshEntries(currentPath);
      await refreshActivity();
      return;
    }

    const password = window.prompt('Set a lock password (optional):', '');
    const result = await api.toggleLock({
      userId: currentUser.id,
      path: entry.relPath,
      entryType: entry.type,
      locked: true,
      password: password || '',
    });
    if (result?.ok === false) {
      setStatus(result.message || 'Unable to lock.');
      return;
    }
    await refreshEntries(currentPath);
    await refreshActivity();
  };

  const handleOpenCmd = async () => {
    if (!api || !currentUser) return;
    await api.openCmd({ userId: currentUser.id, path: currentPath });
  };

  const handleImportFiles = async (fileList) => {
    if (!api || !currentUser) return;
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
    await refreshEntries(currentPath);
    await refreshActivity();
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    setIsDragging(false);
    if (!event.dataTransfer?.files?.length) return;
    await handleImportFiles(event.dataTransfer.files);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleSearchChange = (value) => {
    setSearchTerm(value);
  };

  const visibleEntries = searchTerm.trim() ? searchResults : entries;

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

  if (!currentUser) {
    return (
      <ProfileGate
        profiles={profiles}
        status={status}
        onCreate={handleCreateProfile}
        onOpen={handleOpenProfile}
        onRefresh={refreshProfiles}
      />
    );
  }

  return (
    <div className="app-shell">
      <Sidebar currentUser={currentUser} onSettings={() => setSettingsOpen(true)} onLock={lockVault} />
      <main className="app-main">
        <Toolbar
          pathLabel={currentPathLabel}
          onBack={handleBack}
          onNewFolder={() => setNewFolderOpen(true)}
          onOpenCmd={handleOpenCmd}
          onSettings={() => setSettingsOpen(true)}
          onLock={lockVault}
          onImport={handleImportClick}
          searchTerm={searchTerm}
          onSearch={handleSearchChange}
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
              {searchTerm.trim() ? (
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
              <PreviewPanel entry={selectedEntry} preview={preview} />
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
        onAction={(action) => {
          if (!menu.entry) return;
          if (action === 'open') handleOpenEntry(menu.entry);
          if (action === 'rename') handleRename(menu.entry);
          if (action === 'delete') handleDelete(menu.entry);
          if (action === 'toggleLock') handleToggleLock(menu.entry);
          closeMenu();
        }}
      />

      <SettingsModal
        open={settingsOpen}
        profile={currentUser}
        status={status}
        onClose={() => setSettingsOpen(false)}
        onSave={handleUpdateProfile}
      />

      <NewFolderModal
        open={newFolderOpen}
        onClose={() => setNewFolderOpen(false)}
        onCreate={handleNewFolder}
      />
    </div>
  );
}
