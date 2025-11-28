// API configuration and helper functions
const API = {
    // Base URL for API endpoints
    baseURL: '/api',
    
    /**
     * Get authentication headers with access token
     */
    getAuthHeaders() {
        const token = localStorage.getItem('access_token');
        return {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        };
    },
    
    /**
     * Handle API response and parse JSON
     */
    async handleResponse(response) {
        const data = await response.json();
        
        if (!response.ok) {
            const error = data.detail || data.message || data.username || data.password || 'خطا در ارتباط با سرور';
            throw new Error(error);
        }
        
        return data;
    },
    
    /**
     * Login user with username and password
     * @param {string} username - User's username
     * @param {string} password - User's password
     * @returns {Promise<Object>} User data and tokens
     */
    async login(username, password) {
        try {
            const response = await fetch(`${this.baseURL}/accounts/login/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: username,
                    password: password
                })
            });

            const data = await this.handleResponse(response);

            // Store tokens in localStorage
            localStorage.setItem('access_token', data.access);
            localStorage.setItem('refresh_token', data.refresh);
            localStorage.setItem('user', JSON.stringify(data.user));

            return {
                user: data.user,
                accessToken: data.access,
                refreshToken: data.refresh
            };
        } catch (error) {
            throw error;
        }
    },
    
    /**
     * Get stored user data from localStorage
     */
    getStoredUser() {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    },
    
    /**
     * Get access token from localStorage
     */
    getAccessToken() {
        return localStorage.getItem('access_token');
    },
    
    /**
     * Clear all stored authentication data
     */
    clearAuth() {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
    }
};

