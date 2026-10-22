import axios from 'axios';

// ── Base URL Configuration ──────────────────────────────────────────────────
const API_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
    baseURL: API_URL,
    withCredentials: true,
});

// Global loading callbacks
let loadingCallback = (_isLoading) => {};
export const setLoadingCallback = (cb) => { loadingCallback = cb; };

const shouldSkipLoader = (config) => {
    if (config?.skipLoader) return true;
    const url = String(config?.url || '').toLowerCase();
    if (
        url.includes('notification') ||
        url.includes('lab-active') ||
        url.includes('save-progress') ||
        url.includes('daily-stats') ||
        url.includes('malpractice') ||
        url.includes('student/')
    ) {
        return true;
    }
    return false;
};

// ── Request Interceptor: Attach token from localStorage if present ──────────
api.interceptors.request.use((config) => {
    if (!shouldSkipLoader(config)) {
        loadingCallback(true);
    }
    const token = localStorage.getItem('token');
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
        config.headers['x-auth-token'] = token;
    }
    return config;
}, (error) => {
    loadingCallback(false);
    return Promise.reject(error);
});

// ── Response Interceptor: Handle token expiry globally ─────────────────────
api.interceptors.response.use(
    (response) => {
        if (!shouldSkipLoader(response.config)) {
            loadingCallback(false);
        }
        return response;
    },
    (error) => {
        loadingCallback(false);
        if (error.response && error.response.status === 401) {
            // Clear local credentials on 401
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            sessionStorage.clear();
            if (window.location.pathname !== '/') {
                window.location.href = '/';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
export { API_URL };
