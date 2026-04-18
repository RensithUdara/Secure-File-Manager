import React, { useEffect, useState } from 'react';

export default function SettingsModal({ open, profile, status, onClose, onSave }) {
    const [name, setName] = useState(profile?.username || '');
    const [password, setPassword] = useState('');

    useEffect(() => {
        setName(profile?.username || '');
    }, [profile]);

    if (!open) return null;

    const handleSubmit = async (event) => {
        event.preventDefault();
        const ok = await onSave({ username: name.trim(), password });
        if (ok) {
            setPassword('');
            onClose();
        }
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-card" onClick={(event) => event.stopPropagation()}>
                <header>
                    <h2>Settings & Passwords</h2>
                    <p>Manage your profile details and lock passwords.</p>
                </header>

                <form onSubmit={handleSubmit}>
                    <label>
                        Profile name
                        <input value={name} onChange={(event) => setName(event.target.value)} />
                    </label>
                    <label>
                        New password
                        <input
                            type="password"
                            placeholder="Leave blank to keep current"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                        />
                    </label>
                    {status ? <p className="status-text">{status}</p> : null}
                    <div className="modal-actions">
                        <button type="button" className="ghost-btn" onClick={onClose}>
                            Close
                        </button>
                        <button type="submit" className="primary-btn">
                            Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
