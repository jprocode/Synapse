import { useState, useEffect } from 'react';

interface Toast {
    id: number;
    message: string;
    type: 'error' | 'success' | 'info';
}

let toastIdCounter = 0;

// Global toast functions
const toastListeners: Set<(t: Toast) => void> = new Set();

export function showToast(message: string, type: Toast['type'] = 'info') {
    const toast: Toast = { id: ++toastIdCounter, message, type };
    toastListeners.forEach(fn => fn(toast));
}

export default function ToastContainer() {
    const [toasts, setToasts] = useState<Toast[]>([]);

    useEffect(() => {
        const listener = (toast: Toast) => {
            setToasts(prev => [...prev, toast]);
            // Auto-remove after 4 seconds
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== toast.id));
            }, 4000);
        };

        toastListeners.add(listener);
        return () => { toastListeners.delete(listener); };
    }, []);

    if (toasts.length === 0) return null;

    return (
        <div className="toast-container">
            {toasts.map(toast => (
                <div key={toast.id} className={`toast toast-${toast.type}`}>
                    <span className="toast-icon">
                        {toast.type === 'error' ? '✕' : toast.type === 'success' ? '✓' : 'ℹ'}
                    </span>
                    <span className="toast-message">{toast.message}</span>
                    <button
                        className="toast-close"
                        onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                    >
                        ×
                    </button>
                </div>
            ))}
        </div>
    );
}
