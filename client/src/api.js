import axios from 'axios';

// ── Base URL Configuration ──────────────────────────────────────────────────
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '' : 'https://qpg-backend-5h72.onrender.com');

const api = axios.create({
    baseURL: API_URL,
    withCredentials: true, // IMPORTANT: send HttpOnly auth_token cookie on every request
});

// Global loading callbacks
let loadingCallback = (_isLoading) => {};
export const setLoadingCallback = (cb) => { loadingCallback = cb; };

// ── Request interceptor ─────────────────────────────────────────────────────
// Note: No longer injecting Authorization header — cookie is sent automatically
// via withCredentials: true. The header fallback is kept for API testing tools.
api.interceptors.request.use((config) => {
    loadingCallback(true);
    return config;
}, (error) => {
    loadingCallback(false);
    return Promise.reject(error);
});

// ── Response interceptor ────────────────────────────────────────────────────
api.interceptors.response.use(
    (response) => {
        loadingCallback(false);
        return response;
    },
    (error) => {
        loadingCallback(false);
        if (error.response && error.response.status === 401) {
            // Token expired or invalid — clear any remaining client-side state
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
