import React from 'react';

const ACTION_LABELS = {
    'create-folder': 'Created folder',
    import: 'Imported file',
    delete: 'Deleted',
    rename: 'Renamed',
    lock: 'Locked',
    unlock: 'Unlocked',
    open: 'Opened',
};

export default function ActivityPanel({ items }) {
    return (
        <section className="activity-panel">
            <div className="activity-header">
                <h3>Activity</h3>
                <span className="activity-count">{items.length} recent</span>
            </div>
            <div className="activity-list">
                {items.length === 0 ? (
                    <p className="empty-hint">No activity yet.</p>
                ) : (
                    items.map((item, index) => (
                        <div key={`${item.createdAt}-${index}`} className="activity-item">
                            <div>
                                <p className="activity-title">{ACTION_LABELS[item.action] || item.action}</p>
                                <p className="activity-path">{item.entryPath || 'Vault root'}</p>
                            </div>
                            <span className="activity-time">{new Date(item.createdAt).toLocaleTimeString()}</span>
                        </div>
                    ))
                )}
            </div>
        </section>
    );
}
