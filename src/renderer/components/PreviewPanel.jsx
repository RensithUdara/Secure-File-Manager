import React, { useState } from 'react';

export default function PreviewPanel({ entry, preview, meta, versions, onSaveMeta, onRestoreVersion, onCreateVersion }) {
    const [tagDraft, setTagDraft] = useState('');
    const [noteDraft, setNoteDraft] = useState('');

    React.useEffect(() => {
        setTagDraft((meta?.tags || []).join(', '));
        setNoteDraft(meta?.note || '');
    }, [meta, entry]);
    if (!entry) {
        return (
            <section className="preview-panel empty">
                <p>Select a file to preview.</p>
            </section>
        );
    }

    if (!preview?.ok) {
        return (
            <section className="preview-panel">
                <h3>{entry.name}</h3>
                <p className="status-text">{preview?.message || 'Preview unavailable.'}</p>
            </section>
        );
    }

    return (
        <section className="preview-panel">
            <h3>{entry.name}</h3>
            {preview.type === 'image' ? (
                <img
                    className="preview-image"
                    src={`data:${preview.mime};base64,${preview.data}`}
                    alt={entry.name}
                />
            ) : null}
            {preview.type === 'pdf' ? (
                <iframe
                    className="preview-pdf"
                    title={entry.name}
                    src={`data:${preview.mime};base64,${preview.data}`}
                />
            ) : null}
            {preview.type === 'text' ? <pre className="preview-text">{preview.data}</pre> : null}

            <div className="preview-meta">
                <label>
                    Tags (comma separated)
                    <input
                        value={tagDraft}
                        onChange={(event) => setTagDraft(event.target.value)}
                        placeholder="vault, work, personal"
                    />
                </label>
                <label>
                    Notes
                    <textarea
                        rows="3"
                        value={noteDraft}
                        onChange={(event) => setNoteDraft(event.target.value)}
                        placeholder="Add a quick note"
                    />
                </label>
                <button
                    className="ghost-btn"
                    type="button"
                    onClick={() => onSaveMeta(tagDraft, noteDraft)}
                >
                    Save Notes
                </button>
            </div>

            {onCreateVersion ? (
                <div className="version-panel">
                    <div className="version-header">
                        <h4>Versions</h4>
                        <button className="ghost-btn" type="button" onClick={onCreateVersion}>
                            Save Version
                        </button>
                    </div>
                    {versions?.length ? (
                        <div className="version-list">
                            {versions.map((version) => (
                                <button
                                    key={version.id}
                                    className="version-item"
                                    type="button"
                                    onClick={() => onRestoreVersion(version.id)}
                                >
                                    {new Date(version.createdAt).toLocaleString()}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="empty-hint">No versions yet.</p>
                    )}
                </div>
            ) : null}
        </section>
    );
}
