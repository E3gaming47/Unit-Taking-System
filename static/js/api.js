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
        let data;
        try {
            data = await response.json();
        } catch (e) {
            // If response is not JSON (e.g., empty response for DELETE)
            if (response.ok) {
                return null;
            }
            throw new Error('خطا در ارتباط با سرور');
        }
        
        if (!response.ok) {
            // Handle validation errors
            if (response.status === 400 && typeof data === 'object') {
                const errors = [];
                for (const key in data) {
                    if (Array.isArray(data[key])) {
                        errors.push(...data[key]);
                    } else if (typeof data[key] === 'string') {
                        errors.push(data[key]);
                    }
                }
                if (errors.length > 0) {
                    throw new Error(errors.join('\n'));
                }
            }
            
            // Handle authentication errors
            if (response.status === 401 || response.status === 403) {
                this.clearAuth();
                window.location.href = '/';
                throw new Error('دسترسی غیرمجاز. لطفاً دوباره وارد شوید.');
            }
            
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
    },

    /**
     * Logout user (clear auth and redirect)
     */
    async logout() {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
            try {
                const response = await fetch(`${this.baseURL}/accounts/logout/`, {
                    method: 'POST',
                    headers: this.getAuthHeaders(),
                    body: JSON.stringify({ refresh: refreshToken })
                });
                // Even if logout fails on server, we still clear local storage
                if (!response.ok) {
                    console.warn('Logout API returned error, but clearing local auth anyway');
                }
            } catch (error) {
                console.error('Logout error:', error);
                // Continue to clear auth even if network error
            }
        }
        // Always clear auth data regardless of API response
        this.clearAuth();
    },

    // ========== DEPARTMENTS API ==========
    
    /**
     * Get all departments
     */
    async getDepartments() {
        const response = await fetch(`${this.baseURL}/departments/departments/`, {
            method: 'GET',
            headers: this.getAuthHeaders()
        });
        return this.handleResponse(response);
    },

    /**
     * Get single department by ID
     */
    async getDepartment(id) {
        const response = await fetch(`${this.baseURL}/departments/departments/${id}/`, {
            method: 'GET',
            headers: this.getAuthHeaders()
        });
        return this.handleResponse(response);
    },

    /**
     * Create new department
     */
    async createDepartment(data) {
        const response = await fetch(`${this.baseURL}/departments/departments/`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify(data)
        });
        return this.handleResponse(response);
    },

    /**
     * Update department
     */
    async updateDepartment(id, data) {
        const response = await fetch(`${this.baseURL}/departments/departments/${id}/`, {
            method: 'PUT',
            headers: this.getAuthHeaders(),
            body: JSON.stringify(data)
        });
        return this.handleResponse(response);
    },

    /**
     * Delete department
     */
    async deleteDepartment(id) {
        const response = await fetch(`${this.baseURL}/departments/departments/${id}/`, {
            method: 'DELETE',
            headers: this.getAuthHeaders()
        });
        if (response.status === 204) {
            return null;
        }
        return this.handleResponse(response);
    },

    // ========== COURSES API ==========

    /**
     * Get all courses
     */
    async getCourses() {
        const response = await fetch(`${this.baseURL}/courses/`, {
            method: 'GET',
            headers: this.getAuthHeaders()
        });
        return this.handleResponse(response);
    },

    /**
     * Get single course by ID
     */
    async getCourse(id) {
        const response = await fetch(`${this.baseURL}/courses/${id}/`, {
            method: 'GET',
            headers: this.getAuthHeaders()
        });
        return this.handleResponse(response);
    },

    /**
     * Create new course
     */
    async createCourse(data) {
        const response = await fetch(`${this.baseURL}/courses/`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify(data)
        });
        return this.handleResponse(response);
    },

    /**
     * Update course
     */
    async updateCourse(id, data) {
        const response = await fetch(`${this.baseURL}/courses/${id}/`, {
            method: 'PUT',
            headers: this.getAuthHeaders(),
            body: JSON.stringify(data)
        });
        return this.handleResponse(response);
    },

    /**
     * Delete course
     */
    async deleteCourse(id) {
        const response = await fetch(`${this.baseURL}/courses/${id}/`, {
            method: 'DELETE',
            headers: this.getAuthHeaders()
        });
        if (response.status === 204) {
            return null;
        }
        return this.handleResponse(response);
    }
};

