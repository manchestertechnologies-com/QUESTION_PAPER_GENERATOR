/**
 * safeStorage.js - Fault-tolerant Web Storage Utility
 * Prevents QuotaExceededError from crashing React application views.
 */

export const safeStorage = {
    setItem(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            console.warn(`[safeStorage] localStorage quota exceeded or error for key "${key}". Cleaning old caches...`, e);
            try {
                // Prune old exam keys to free space (exclude current key)
                const staleKeys = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && (k.startsWith('exam_answers_') || k.startsWith('cbt_scorecard_')) && k !== key) {
                        staleKeys.push(k);
                    }
                }
                staleKeys.forEach(k => {
                    try { localStorage.removeItem(k); } catch (_) {}
                });

                // Retry setItem
                localStorage.setItem(key, value);
            } catch (retryErr) {
                console.warn(`[safeStorage] Retry after prune failed. Falling back to sessionStorage for key "${key}".`, retryErr);
                try {
                    sessionStorage.setItem(key, value);
                } catch (sessionErr) {
                    console.error(`[safeStorage] Even sessionStorage failed for key "${key}":`, sessionErr);
                }
            }
        }
    },

    getItem(key) {
        try {
            const val = localStorage.getItem(key);
            if (val !== null && val !== undefined) return val;
        } catch (e) {
            console.warn(`[safeStorage] Error reading localStorage key "${key}":`, e);
        }
        try {
            return sessionStorage.getItem(key);
        } catch (e) {
            return null;
        }
    },

    removeItem(key) {
        try { localStorage.removeItem(key); } catch (_) {}
        try { sessionStorage.removeItem(key); } catch (_) {}
    },

    clearOldExamCaches(excludeKey = null) {
        try {
            const staleKeys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && (k.startsWith('exam_answers_') || k.startsWith('cbt_scorecard_'))) {
                    if (!excludeKey || k !== excludeKey) {
                        staleKeys.push(k);
                    }
                }
            }
            staleKeys.forEach(k => {
                try { localStorage.removeItem(k); } catch (_) {}
            });
        } catch (_) {}
    }
};

export default safeStorage;
