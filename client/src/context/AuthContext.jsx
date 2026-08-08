import React, { createContext, useState, useEffect } from 'react';
import api from '../api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Restore session by calling /api/auth/me (validates the HttpOnly cookie server-side)
    // No longer reading from localStorage — cookie is validated on server
    useEffect(() => {
        const restoreSession = async () => {
            try {
                const res = await api.get('/api/auth/me');
                setUser(res.data.user);
            } catch {
                // Not authenticated — that's fine
                setUser(null);
            } finally {
                setLoading(false);
            }
        };
        restoreSession();
    }, []);

    const login = async (email, password) => {
        try {
            const res = await api.post('/api/auth/login', { email, password });
            // Token is set as HttpOnly cookie by server — NOT in localStorage
            // Response body only contains user info (no token)
            setUser(res.data.user);
            return res.data.user;
        } catch (err) {
            throw err.response ? err.response.data : new Error('Login failed');
        }
    };

    const logout = async () => {
        try {
            await api.post('/api/auth/logout'); // Server clears the HttpOnly cookie
        } catch {
            // Even if logout API fails, clear local state
        } finally {
            setUser(null);
            sessionStorage.clear(); // Clear any remaining exam state
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
