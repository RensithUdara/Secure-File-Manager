import React from 'react';

export default function PreviewPanel({ entry, preview }) {
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
        </section>
    );
}
