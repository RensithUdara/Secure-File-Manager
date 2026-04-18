import React, { useEffect, useState } from 'react';

export default function ProfileGate({ profiles, status, onOpen, onCreate, onRefresh }) {
    const [selected, setSelected] = useState(profiles[0]?.username || '');
    const [password, setPassword] = useState('');
    const [newName, setNewName] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!selected && profiles.length) {
            setSelected(profiles[0].username);
        }
    }, [profiles, selected]);

    const handleOpen = async (event) => {
        event.preventDefault();
        if (!selected) return;
        setBusy(true);
        const ok = await onOpen(selected, password);
        setBusy(false);
        if (ok) {
            setPassword('');
        }
    };

    const handleCreate = async (event) => {
        event.preventDefault();
        if (!newName || !newPassword) return;
        setBusy(true);
        const ok = await onCreate(newName, newPassword);
        setBusy(false);
        if (ok) {
            setNewName('');
            setNewPassword('');
            await onRefresh();
            setSelected(newName);
        }
    };

    return (
        <div className="gate-shell">
            <div className="gate-hero">
                <div>
                    <p className="gate-eyebrow">Secure File Vault</p>
                    <h1>Who is opening the vault?</h1>
                    <p className="gate-subtitle">Choose a profile to unlock or create a fresh identity.</p>
                    {status ? <p className="status-text">{status}</p> : null}
                </div>
            </div>

            <div className="gate-panel">
                <section>
                    <h2>Profiles</h2>
                    <div className="profile-grid">
                        {profiles.map((profile) => (
                            <button
                                key={profile.id}
                                className={`profile-card ${selected === profile.username ? 'active' : ''}`}
                                type="button"
                                onClick={() => setSelected(profile.username)}
                            >
                                <div className="profile-avatar">{profile.username.slice(0, 2).toUpperCase()}</div>
                                <div>
                                    <p className="profile-name">{profile.username}</p>
                                    <p className="profile-role">Vault Profile</p>
                                </div>
                            </button>
                        ))}
                        {!profiles.length ? <p className="empty-hint">No profiles yet. Create one below.</p> : null}
                    </div>
                </section>

                <section>
                    <h2>Unlock</h2>
                    <form className="gate-form" onSubmit={handleOpen}>
                        <label>
                            Selected profile
                            <select value={selected} onChange={(event) => setSelected(event.target.value)}>
                                <option value="" disabled>
                                    Select a profile
                                </option>
                                {profiles.map((profile) => (
                                    <option key={profile.id} value={profile.username}>
                                        {profile.username}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            Password
                            <input
                                type="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                placeholder="Vault password"
                            />
                        </label>
                        <button className="primary-btn" type="submit" disabled={busy}>
                            Open Vault
                        </button>
                    </form>
                </section>

                <section>
                    <h2>Create new profile</h2>
                    <form className="gate-form" onSubmit={handleCreate}>
                        <label>
                            Profile name
                            <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Profile name" />
                        </label>
                        <label>
                            Password
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(event) => setNewPassword(event.target.value)}
                                placeholder="Set a strong password"
                            />
                        </label>
                        <button className="ghost-btn" type="submit" disabled={busy}>
                            Create Profile
                        </button>
                    </form>
                </section>
            </div>
        </div>
    );
}
