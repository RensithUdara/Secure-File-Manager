import React, { useState, useEffect } from 'react';

export default function TextInputModal({ open, onClose, onSubmit, title = 'Enter text', label = 'Text', initialValue = '' }) {
    const [value, setValue] = useState(initialValue);
    const [error, setError] = useState('');

    useEffect(() => {
        if (open) {
            setValue(initialValue);
            setError('');
        }
    }, [open, initialValue]);

    if (!open) return null;

    const handleSubmit = async (event) => {
        event.preventDefault();
        
        if (!value.trim()) {
            setError('This field cannot be empty.');
            return;
        }

        const result = await onSubmit(value.trim());
        if (result === true) {
            setValue('');
            setError('');
            onClose();
        } else if (typeof result === 'string') {
            setError(result);
        }
    };

    const handleCancel = () => {
        setValue('');
        setError('');
        onClose();
    };

    return (
        <div className="modal-backdrop" onClick={handleCancel}>
            <div className="modal-card" onClick={(event) => event.stopPropagation()}>
                <header>
                    <h2>{title}</h2>
                </header>
                <form onSubmit={handleSubmit}>
                    <label>
                        {label}
                        <input 
                            type="text"
                            value={value} 
                            onChange={(event) => setValue(event.target.value)}
                            autoFocus
                        />
                    </label>
                    {error && <div className="error-message">{error}</div>}
                    <div className="modal-actions">
                        <button type="button" className="ghost-btn" onClick={handleCancel}>
                            Cancel
                        </button>
                        <button type="submit" className="primary-btn">
                            Submit
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
