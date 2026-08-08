import React, { createContext, useState, useEffect } from 'react';
import api from '../api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            const savedToken = localStorage.getItem('token');
            const savedUser = localStorage.getItem('user');

            if (savedUser) {
                try {
                    setUser(JSON.parse(savedUser));
                } catch {
                    localStorage.removeItem('user');
                }
            }

            if (savedToken || savedUser) {
                try {
                    const res = await api.get('/api/auth/me');
                    setUser(res.data.user);
                    localStorage.setItem('user', JSON.stringify(res.data.user));
                } catch {
                    // Session invalid or expired
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    setUser(null);
                }
            }
            setLoading(false);
        };

        initAuth();
    }, []);

    const login = async (email, password) => {
        try {
            const res = await api.post('/api/auth/login', { email, password });
            if (res.data.token) {
                localStorage.setItem('token', res.data.token);
            }
            if (res.data.user) {
                localStorage.setItem('user', JSON.stringify(res.data.user));
                setUser(res.data.user);
            }
            return res.data.user;
        } catch (err) {
            throw err.response ? err.response.data : new Error('Login failed');
        }
    };

    const logout = async () => {
        try {
            await api.post('/api/auth/logout');
        } catch {
            // Ignore network error on logout
        } finally {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            sessionStorage.clear();
            setUser(null);
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
