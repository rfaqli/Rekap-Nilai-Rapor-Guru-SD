export const API_URL = '/api';

export const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
        credentials: 'include'
    });

    if (response.status === 401 || response.status === 403) {
        window.location.href = '/login';
        throw new Error('Unauthorized');
    }

    let data: any = {};
    const text = await response.text();
    try {
        if (text) {
            data = JSON.parse(text);
        }
    } catch (e) {
        console.warn("Failed to parse JSON response:", text);
    }
    
    if (!response.ok) {
        throw new Error(data?.error || 'Something went wrong');
    }

    return data;
};
