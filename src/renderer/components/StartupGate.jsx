import React, { useState } from 'react';

export default function StartupGate({ status, onUnlock }) {
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setBusy(true);
        const ok = await onUnlock(password);
        setBusy(false);
        if (ok) {
            setPassword('');
        }
    };

    return (
        <div className="gate-shell">
            <div className="gate-hero">
                <div>
                    <p className="gate-eyebrow">Secure File Vault</p>
                    <h1>Enter startup password</h1>
                    <p className="gate-subtitle">This vault is protected by a global password.</p>
                    {status ? <p className="status-text">{status}</p> : null}
                </div>
            </div>
            <div className="gate-panel">
                <section>
                    <h2>Unlock</h2>
                    <form className="gate-form" onSubmit={handleSubmit}>
                        <label>
                            Startup password
                            <input
                                type="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                placeholder="Startup password"
                            />
                        </label>
                        <button className="primary-btn" type="submit" disabled={busy}>
                            Unlock
                        </button>
                    </form>
                </section>
            </div>
        </div>
    );
}
