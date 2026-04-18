import React from 'react';

export default function FileGrid({ entries, onOpen, onContextMenu, onSelect, selectedPath }) {
    if (!entries.length) {
        return (
            <div className="empty-state">
                <div className="empty-graphic" />
                <h2>Clean vault, zero clutter.</h2>
                <p>Create a folder or drop files in this space to begin.</p>
            </div>
        );
    }

    return (
        <div className="file-grid">
            {entries.map((entry) => (
                <button
                    type="button"
                    key={entry.relPath}
                    className={`file-card ${entry.type} ${selectedPath === entry.relPath ? 'selected' : ''}`}
                    onClick={() => onSelect?.(entry)}
                    onDoubleClick={() => onOpen(entry)}
                    onContextMenu={(event) => onContextMenu(event, entry)}
                >
                    <div className="file-icon">
                        {entry.type === 'folder' ? '📁' : '📄'}
                    </div>
                    <div className="file-meta">
                        <p className="file-name">{entry.name}</p>
                        <p className="file-detail">{entry.detail || (entry.isLocked ? 'Locked' : 'Unlocked')}</p>
                    </div>
                    {entry.isLocked ? <span className="lock-badge">Locked</span> : null}
                </button>
            ))}
        </div>
    );
}
