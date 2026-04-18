import React, { useEffect, useState } from 'react';

export default function SettingsModal({
    open,
    profile,
    status,
    theme,
    startupEnabled,
    onClose,
    onSave,
    onSetTheme,
    onSetStartupPassword,
    onClearStartupPassword,
    onExportActivity,
    onExportVault,
}) {
    const [name, setName] = useState(profile?.username || '');
    const [password, setPassword] = useState('');
    const [startupPassword, setStartupPassword] = useState('');
    const [localTheme, setLocalTheme] = useState(theme || 'neon');

    useEffect(() => {
        setName(profile?.username || '');
    }, [profile]);

    useEffect(() => {
        setLocalTheme(theme || 'neon');
    }, [theme]);

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
                    <label>
                        Theme
                        <select
                            value={localTheme}
                            onChange={(event) => {
                                setLocalTheme(event.target.value);
                                onSetTheme(event.target.value);
                            }}
                        >
                            <option value="neon">Neon</option>
                            <option value="ember">Ember</option>
                            <option value="frost">Frost</option>
                            <option value="noir">Noir</option>
                        </select>
                    </label>
                    <label>
                        Startup password
                        <input
                            type="password"
                            placeholder={startupEnabled ? 'Set a new startup password' : 'Set startup password'}
                            value={startupPassword}
                            onChange={(event) => setStartupPassword(event.target.value)}
                        />
                    </label>
                    <div className="inline-actions">
                        <button
                            type="button"
                            className="ghost-btn"
                            onClick={async () => {
                                if (!startupPassword) return;
                                await onSetStartupPassword(startupPassword);
                                setStartupPassword('');
                            }}
                        >
                            Set Startup Password
                        </button>
                        {startupEnabled ? (
                            <button type="button" className="ghost-btn" onClick={onClearStartupPassword}>
                                Clear Startup Password
                            </button>
                        ) : null}
                    </div>
                    <div className="inline-actions">
                        <button type="button" className="ghost-btn" onClick={onExportActivity}>
                            Export Activity CSV
                        </button>
                        <button type="button" className="ghost-btn" onClick={onExportVault}>
                            Export Vault ZIP
                        </button>
                    </div>
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
