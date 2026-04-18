import React, { useState } from 'react';

export default function NewFolderModal({ open, onClose, onCreate }) {
    const [name, setName] = useState('');

    if (!open) return null;

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!name.trim()) return;
        await onCreate(name.trim());
        setName('');
        onClose();
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-card" onClick={(event) => event.stopPropagation()}>
                <header>
                    <h2>New Folder</h2>
                    <p>Name the folder and keep your vault tidy.</p>
                </header>
                <form onSubmit={handleSubmit}>
                    <label>
                        Folder name
                        <input value={name} onChange={(event) => setName(event.target.value)} />
                    </label>
                    <div className="modal-actions">
                        <button type="button" className="ghost-btn" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="primary-btn">
                            Create
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
