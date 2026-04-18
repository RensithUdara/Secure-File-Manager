import React from 'react';

export default function Toolbar({
    pathLabel,
    onBack,
    onNewFolder,
    onOpenCmd,
    onSettings,
    onLock,
    onImport,
    searchTerm,
    onSearch,
    canNavigate,
    canMutate,
    searchDisabled,
}) {
    return (
        <header className="toolbar">
            <div className="toolbar-left">
                <button className="icon-btn" onClick={onBack} aria-label="Back" disabled={!canNavigate}>
                    <span aria-hidden="true">&lt;</span>
                </button>
                <div className="toolbar-path">
                    <span className="path-label">Vault</span>
                    <span className="path-divider">/</span>
                    <span className="path-location">{pathLabel}</span>
                </div>
            </div>

            <div className="toolbar-actions">
                <label className="search-field">
                    <span className="search-label">Search</span>
                    <input
                        value={searchTerm}
                        onChange={(event) => onSearch(event.target.value)}
                        placeholder="Search files"
                        disabled={searchDisabled}
                    />
                </label>
                <button className="ghost-btn" onClick={onImport} disabled={!canMutate}>
                    Import Files
                </button>
                <button className="primary-btn" onClick={onNewFolder} disabled={!canMutate}>
                    New Folder
                </button>
                <button className="ghost-btn" onClick={onOpenCmd} disabled={!canMutate}>
                    Open CMD
                </button>
                <button className="ghost-btn" onClick={onLock}>
                    Lock Vault
                </button>
                <button className="ghost-btn" onClick={onSettings}>
                    Settings
                </button>
            </div>
        </header>
    );
}
