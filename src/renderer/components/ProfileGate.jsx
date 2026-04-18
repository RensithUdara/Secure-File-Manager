import React, { useEffect, useState } from 'react';

export default function ProfileGate({ profiles, status, onOpen, onCreate, onRefresh, onInviteCreate, onInviteRedeem }) {
    const [selected, setSelected] = useState(profiles[0]?.username || '');
    const [password, setPassword] = useState('');
    const [newName, setNewName] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [inviteProfile, setInviteProfile] = useState(profiles[0]?.username || '');
    const [invitePassword, setInvitePassword] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [inviteStatus, setInviteStatus] = useState('');
    const [redeemCode, setRedeemCode] = useState('');
    const [redeemName, setRedeemName] = useState('');
    const [redeemPassword, setRedeemPassword] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!selected && profiles.length) {
            setSelected(profiles[0].username);
        }
        if (!inviteProfile && profiles.length) {
            setInviteProfile(profiles[0].username);
        }
    }, [profiles, selected, inviteProfile]);

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

    const handleInviteCreate = async (event) => {
        event.preventDefault();
        if (!inviteProfile || !invitePassword) return;
        setBusy(true);
        const result = await onInviteCreate(inviteProfile, invitePassword);
        setBusy(false);
        if (result.ok) {
            setInviteCode(result.code);
            setInviteStatus(`Invite expires on ${new Date(result.expiresAt).toLocaleString()}.`);
            setInvitePassword('');
        } else {
            setInviteStatus(result.message || 'Unable to create invite.');
        }
    };

    const handleInviteRedeem = async (event) => {
        event.preventDefault();
        if (!redeemCode || !redeemName || !redeemPassword) return;
        setBusy(true);
        const result = await onInviteRedeem(redeemCode, redeemName, redeemPassword);
        setBusy(false);
        if (result.ok) {
            setRedeemCode('');
            setRedeemName('');
            setRedeemPassword('');
            setInviteStatus('Invite redeemed. You can now log in.');
            await onRefresh();
        } else {
            setInviteStatus(result.message || 'Unable to redeem invite.');
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

                <section>
                    <h2>Invite access</h2>
                    <form className="gate-form" onSubmit={handleInviteCreate}>
                        <label>
                            Authorize profile
                            <select value={inviteProfile} onChange={(event) => setInviteProfile(event.target.value)}>
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
                                value={invitePassword}
                                onChange={(event) => setInvitePassword(event.target.value)}
                                placeholder="Profile password"
                            />
                        </label>
                        <button className="ghost-btn" type="submit" disabled={busy}>
                            Create Invite Code
                        </button>
                    </form>
                    {inviteCode ? (
                        <div className="invite-code">
                            <span>Invite Code:</span>
                            <strong>{inviteCode}</strong>
                        </div>
                    ) : null}
                </section>

                <section>
                    <h2>Redeem invite</h2>
                    <form className="gate-form" onSubmit={handleInviteRedeem}>
                        <label>
                            Invite code
                            <input value={redeemCode} onChange={(event) => setRedeemCode(event.target.value)} />
                        </label>
                        <label>
                            New profile name
                            <input value={redeemName} onChange={(event) => setRedeemName(event.target.value)} />
                        </label>
                        <label>
                            Password
                            <input
                                type="password"
                                value={redeemPassword}
                                onChange={(event) => setRedeemPassword(event.target.value)}
                            />
                        </label>
                        <button className="primary-btn" type="submit" disabled={busy}>
                            Redeem Invite
                        </button>
                    </form>
                    {inviteStatus ? <p className="status-text">{inviteStatus}</p> : null}
                </section>
            </div>
        </div>
    );
}
