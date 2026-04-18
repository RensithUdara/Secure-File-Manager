import React, { useEffect } from 'react';

export default function ContextMenu({ menu, onClose, onAction }) {
    useEffect(() => {
        if (!menu.open) return;
        const handler = () => onClose();
        window.addEventListener('click', handler);
        return () => window.removeEventListener('click', handler);
    }, [menu.open, onClose]);

    if (!menu.open || !menu.entry) return null;

    return (
        <div className="context-menu" style={{ top: menu.y, left: menu.x }}>
            <button className="context-item" onClick={() => onAction('open')}>
                Open
            </button>
            <button className="context-item" onClick={() => onAction('rename')}>
                Rename
            </button>
            <button className="context-item" onClick={() => onAction('toggleLock')}>
                {menu.entry.isLocked ? 'Unlock' : 'Lock'}
            </button>
            <button className="context-item danger" onClick={() => onAction('delete')}>
                Delete
            </button>
        </div>
    );
}
