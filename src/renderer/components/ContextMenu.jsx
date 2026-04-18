import React, { useEffect } from 'react';

export default function ContextMenu({ menu, onClose, onAction, viewMode }) {
    useEffect(() => {
        if (!menu.open) return;
        const handler = () => onClose();
        window.addEventListener('click', handler);
        return () => window.removeEventListener('click', handler);
    }, [menu.open, onClose]);

    if (!menu.open || !menu.entry) return null;

    const isTrash = viewMode === 'trash';
    const canMutate = viewMode === 'storage';

    return (
        <div className="context-menu" style={{ top: menu.y, left: menu.x }}>
            {isTrash ? (
                <>
                    <button className="context-item" onClick={() => onAction('restore')}>
                        Restore
                    </button>
                    <button className="context-item danger" onClick={() => onAction('purge')}>
                        Delete Permanently
                    </button>
                </>
            ) : (
                <>
                    <button className="context-item" onClick={() => onAction('open')}>
                        Open
                    </button>
                    {canMutate ? (
                        <button className="context-item" onClick={() => onAction('rename')}>
                            Rename
                        </button>
                    ) : null}
                    {canMutate && menu.entry.type === 'file' ? (
                        <button className="context-item" onClick={() => onAction('toggleLock')}>
                            {menu.entry.isLocked ? 'Unlock with PIN' : 'Lock with PIN'}
                        </button>
                    ) : null}
                    <button className="context-item" onClick={() => onAction('toggleFavorite')}>
                        {menu.entry.isFavorite ? 'Remove Favorite' : 'Add Favorite'}
                    </button>
                    {canMutate && menu.entry.type === 'file' ? (
                        <button className="context-item" onClick={() => onAction('createVersion')}>
                            Save Version
                        </button>
                    ) : null}
                    <button className="context-item danger" onClick={() => onAction('delete')}>
                        Move to Trash
                    </button>
                </>
            )}
        </div>
    );
}
