import React from 'react';

export default function Sidebar({ currentUser, onSettings, onLock }) {
    return (
        <aside className="sidebar">
            <div className="sidebar-brand">
                <div className="brand-badge">VF</div>
                <div>
                    <p className="brand-title">Vaultline</p>
                    <p className="brand-subtitle">Secure File Vault</p>
                </div>
            </div>

            <div className="sidebar-section">
                <p className="sidebar-label">Quick Access</p>
                <button className="sidebar-item active">
                    <span className="dot" /> App Storage
                </button>
                <button className="sidebar-item">Recent</button>
                <button className="sidebar-item">Favorites</button>
            </div>

            <div className="sidebar-footer">
                <div className="profile-pill">
                    <div className="profile-avatar">{currentUser.username.slice(0, 2).toUpperCase()}</div>
                    <div>
                        <p className="profile-name">{currentUser.username}</p>
                        <p className="profile-role">Vault Owner</p>
                    </div>
                </div>
                <button className="ghost-btn" onClick={onLock}>
                    Lock Vault
                </button>
                <button className="ghost-btn" onClick={onSettings}>
                    Settings
                </button>
            </div>
        </aside>
    );
}
