import { safeGetItem, safeRemoveItem } from './storage';

export const API_URL = '/api';

export const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
    const token = safeGetItem('token');
    const headers = new Headers(options.headers || {});
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }
    if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if (response.status === 401 || response.status === 403) {
        safeRemoveItem('token');
        safeRemoveItem('user');
        window.location.href = '/login';
        throw new Error('Unauthorized');
    }

    let data = {};
    const text = await response.text();
    try {
        if (text) {
            data = JSON.parse(text);
        }
    } catch (e) {
        console.warn("Failed to parse JSON response:", text);
    }
    
    if (!response.ok) {
        throw new Error((data as any).error || 'Something went wrong');
    }

    return data;
};
