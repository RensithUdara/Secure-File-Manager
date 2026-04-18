import React, { useState, useEffect } from 'react';

export default function PinEntryModal({ open, onClose, onSubmit, title = 'Enter PIN', message = '', isUnlock = false }) {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [attempts, setAttempts] = useState(0);
    const maxAttempts = 3;

    useEffect(() => {
        if (!open) {
            setPin('');
            setError('');
            setAttempts(0);
        }
    }, [open]);

    if (!open) return null;

    const isValidPin = (value) => /^\d{4}$/.test(String(value || ''));

    const handleSubmit = async (event) => {
        event.preventDefault();
        
        if (!isValidPin(pin)) {
            const newAttempts = attempts + 1;
            setAttempts(newAttempts);
            if (newAttempts < maxAttempts) {
                const remaining = maxAttempts - newAttempts;
                setError(`PIN must be exactly 4 digits. ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.`);
            } else {
                setError('Too many invalid PIN attempts.');
                setTimeout(() => {
                    onClose();
                }, 1500);
            }
            return;
        }

        const result = await onSubmit(pin);
        if (result === true) {
            setPin('');
            setError('');
            onClose();
        } else if (typeof result === 'string') {
            setError(result);
            const newAttempts = attempts + 1;
            setAttempts(newAttempts);
            if (newAttempts >= maxAttempts) {
                setTimeout(() => {
                    onClose();
                }, 1500);
            }
        }
    };

    const handleCancel = () => {
        setPin('');
        setError('');
        onClose();
    };

    return (
        <div className="modal-backdrop" onClick={handleCancel}>
            <div className="modal-card" onClick={(event) => event.stopPropagation()}>
                <header>
                    <h2>{title}</h2>
                    {message && <p>{message}</p>}
                </header>
                <form onSubmit={handleSubmit}>
                    <label>
                        PIN
                        <input 
                            type="password" 
                            inputMode="numeric"
                            maxLength="4"
                            value={pin} 
                            onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
                            placeholder="Enter 4-digit PIN"
                            autoFocus
                        />
                    </label>
                    {error && <div className="error-message">{error}</div>}
                    <div className="modal-actions">
                        <button type="button" className="ghost-btn" onClick={handleCancel}>
                            Cancel
                        </button>
                        <button type="submit" className="primary-btn">
                            {isUnlock ? 'Unlock' : 'Lock'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
