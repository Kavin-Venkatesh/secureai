import React, { useEffect, useState } from 'react';
import styles from './redactionmodal.module.css';

interface PII {
    id: string;
    type?: string;
    value?: string;
    redactedValue?: string;
    confidence?: number;
    position?: { start: number; end: number };
    selected?: boolean;
}

interface RedactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    content: {
        type: 'text' | 'image';
        original: string;
        redacted?: string;
    };
    detectedPII: PII[];
    onConfirm: (redactedContent: string) => void;
}

const RedactionModal: React.FC<RedactionModalProps> = ({
    isOpen,
    onClose,
    content,
    detectedPII,
    onConfirm
}) => {
    const [piiItems, setPiiItems] = useState<PII[]>([]);
    const [editableRedactedText, setEditableRedactedText] = useState('');

    useEffect(() => {
        // initialize when modal opens / props change
        setPiiItems(detectedPII.map((p, i) => ({ selected: true, id: p.id ? String(p.id) : String(i), ...p })));
    }, [detectedPII]);

    useEffect(() => {
        if (content.type === 'text' && content.redacted !== undefined) {
            setEditableRedactedText(content.redacted);
        }
        if (content.type === 'image') {
            // no-op for images here
        }
    }, [content]);

    const togglePIISelection = (id: string) => {
        setPiiItems(items =>
            items.map(item =>
                item.id === id ? { ...item, selected: !item.selected } : item
            )
        );
    };

    const selectAll = () => setPiiItems(items => items.map(it => ({ ...it, selected: true })));
    const clearAll = () => setPiiItems(items => items.map(it => ({ ...it, selected: false })));

    // Create a preview of redacted text based on selected items (if positions provided)
    const getRedactedPreview = () => {
        if (content.type !== 'text') return content.redacted ?? '';
        // if positions present, apply them, otherwise return editableRedactedText
        const hasPositions = piiItems.some(p => p.position);
        if (!hasPositions) return editableRedactedText;
        let text = content.original;
        // apply selected redactions sorted descending by end
        piiItems
            .filter(p => p.selected && p.position)
            .sort((a, b) => (b.position!.end - a.position!.end))
            .forEach(p => {
                const s = p.position!.start;
                const e = p.position!.end;
                text = text.slice(0, s) + '█'.repeat(e - s) + text.slice(e);
            });
        return text;
    };

    if (!isOpen) return null;

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                <div className={styles.header}>
                    <h2>Review Redactions</h2>
                    {content.type === 'text' && (
                        <span className={styles.piiCount}>
                            {piiItems.filter(item => item.selected).length} of {piiItems.length} items detected
                        </span>
                    )}
                </div>

                {content.type === 'text' ? (
                    <div className={styles.compareContainer}>
                        <div className={styles.textPanel}>
                            <h3>Original Text</h3>
                            <div className={styles.textContent}>
                                {content.original}
                            </div>
                        </div>
                        <div className={styles.textPanel}>
                            <h3>Redacted Text (Editable)</h3>
                            <textarea
                                className={styles.editableRedacted}
                                value={editableRedactedText}
                                onChange={(e) => setEditableRedactedText(e.target.value)}
                                placeholder="Edit redacted text here..."
                            />
                            <div style={{ marginTop: 8 }}>
                                <strong>Preview:</strong>
                                <div className={styles.textContent} style={{ marginTop: 6 }}>
                                    {getRedactedPreview()}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className={styles.imageContainer}>
                        <div className={styles.imagePanel}>
                            <h3>Original Image</h3>
                            <img src={content.original} alt="Original" />
                        </div>
                        <div className={styles.imagePanel}>
                            <h3>Redacted Image</h3>
                            <img src={content.redacted} alt="Redacted" />
                        </div>
                    </div>
                )}

                {content.type === 'text' && (
                    <div className={styles.piiList}>
                        <div className={styles.piiListHeader}>
                            <h3>Detected PII</h3>
                            <div className={styles.actions}>
                                <button type="button" onClick={selectAll}>Redact All</button>
                                <button type="button" onClick={clearAll}>Clear All</button>
                            </div>
                        </div>
                        {piiItems.map(item => (
                            <div key={item.id} className={styles.piiItem}>
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={!!item.selected}
                                        onChange={() => togglePIISelection(item.id as string)}
                                    />
                                    <span className={styles.piiValue}>{item.value ?? item.redactedValue}</span>
                                    <span className={styles.piiType}>{item.type}</span>
                                    <span className={styles.confidence}>
                                        {item.confidence ? (item.confidence * 100).toFixed(1) + '%' : null}
                                    </span>
                                </label>
                            </div>
                        ))}
                    </div>
                )}

                <div className={styles.footer}>
                    <button onClick={onClose}>Cancel</button>
                    <button
                        onClick={() => {
                            if (content.type === 'text') {
                                // return the edited redacted text (user may have edited it)
                                // If positions were used and user didn't edit, use preview
                                const out = editableRedactedText || getRedactedPreview();
                                onConfirm(out);
                            } else {
                                // pass back redacted image URL provided by server
                                onConfirm(content.redacted ?? content.original);
                            }
                        }}
                        className={styles.primary}
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RedactionModal;