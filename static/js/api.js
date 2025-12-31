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
     * @param {Response} response - Fetch response object
     * @param {boolean} skipAuthCheck - Skip automatic auth handling (for refresh token calls)
     */
    async handleResponse(response, skipAuthCheck = false) {
        let data;
        try {
            data = await response.json();
        } catch (e) {
            // If response is not JSON (e.g., empty response for DELETE)
            if (response.ok) {
                return null;
            }
            throw new Error('خطا در ارتباط با سرور. لطفاً اتصال اینترنت خود را بررسی کنید.');
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
            
            // Handle authentication errors (403 = forbidden, always redirect)
            if (response.status === 403) {
                if (!skipAuthCheck) {
                    this.clearAuth();
                    window.location.href = '/';
                }
                throw new Error('شما دسترسی لازم برای این عملیات را ندارید.');
            }
            
            // Handle 401 (unauthorized) - should be handled by request() method, but keep as fallback
            if (response.status === 401 && !skipAuthCheck) {
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
     * Make an authenticated API request with automatic token refresh on 401
     * @param {string} url - Request URL
     * @param {Object} options - Fetch options
     * @param {boolean} retryOn401 - Whether to retry on 401 (default: true)
     * @returns {Promise<Response>} Fetch response
     */
    async request(url, options = {}, retryOn401 = true) {
        // Make initial request
        let response = await fetch(url, {
            ...options,
            headers: {
                ...this.getAuthHeaders(),
                ...(options.headers || {})
            }
        });

        // If 401 and retry is enabled, try to refresh token and retry once
        if (response.status === 401 && retryOn401) {
            try {
                // Try to refresh the token
                await this.refreshToken();
                
                // Retry the original request with new token
                response = await fetch(url, {
                    ...options,
                    headers: {
                        ...this.getAuthHeaders(),
                        ...(options.headers || {})
                    }
                });
            } catch (refreshError) {
                // Refresh failed, clear auth and redirect to login
                this.clearAuth();
                window.location.href = '/';
                throw new Error('نشست شما منقضی شده است. لطفاً دوباره وارد شوید.');
            }
        }

        return response;
    },
    
    /**
     * Login user with username and password
     * @param {string} username - User's username
     * @param {string} password - User's password
     * @returns {Promise<Object>} User data and tokens
     */
    async login(username, password) {
        try {
            const response = await fetch(`${this.baseURL}/accounts/auth/login/`, {
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
                refreshToken: data.refresh,
                redirect_url: data.redirect_url
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
     * Note: Doesn't use request() method to avoid token refresh retry on logout
     */
    async logout() {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
            try {
                const response = await fetch(`${this.baseURL}/accounts/auth/logout/`, {
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

    /**
     * Refresh access token
     */
    async refreshToken() {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
            throw new Error('No refresh token available');
        }

        try {
            const response = await fetch(`${this.baseURL}/accounts/auth/refresh/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ refresh: refreshToken })
            });

            // Skip auth check for refresh endpoint to avoid infinite loop
            const data = await this.handleResponse(response, true);
            if (data && data.access) {
                localStorage.setItem('access_token', data.access);
                return data.access;
            }
            throw new Error('Invalid refresh response');
        } catch (error) {
            this.clearAuth();
            throw error;
        }
    },

    // ========== DEPARTMENTS API ==========
    
    /**
     * Get all departments (with pagination support)
     * @param {Object} params - Query parameters (page, page_size, search, ordering)
     */
    async getDepartments(params = {}) {
        const queryParams = new URLSearchParams();
        if (params.page) queryParams.append('page', params.page);
        if (params.page_size) queryParams.append('page_size', params.page_size);
        if (params.search) queryParams.append('search', params.search);
        if (params.ordering) queryParams.append('ordering', params.ordering);
        
        const url = `${this.baseURL}/departments/departments/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
        const response = await this.request(url, { method: 'GET' });
        const data = await this.handleResponse(response);
        
        // Handle paginated response
        if (data.results) {
            return data.results; // Return just the results array
        }
        return data; // Return as-is if not paginated
    },

    /**
     * Get single department by ID
     */
    async getDepartment(id) {
        const response = await this.request(`${this.baseURL}/departments/departments/${id}/`, { method: 'GET' });
        return this.handleResponse(response);
    },

    /**
     * Create new department
     */
    async createDepartment(data) {
        const response = await this.request(`${this.baseURL}/departments/departments/`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return this.handleResponse(response);
    },

    /**
     * Update department
     */
    async updateDepartment(id, data) {
        const response = await this.request(`${this.baseURL}/departments/departments/${id}/`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        return this.handleResponse(response);
    },

    /**
     * Delete department
     */
    async deleteDepartment(id) {
        const response = await this.request(`${this.baseURL}/departments/departments/${id}/`, { method: 'DELETE' });
        if (response.status === 204) {
            return null;
        }
        return this.handleResponse(response);
    },

    // ========== CLASSROOMS API ==========
    /**
     * Get all classrooms with optional filters
     * @param {Object} params - Query parameters (search, ordering, page, page_size)
     */
    async getClassrooms(params = {}) {
        const queryParams = new URLSearchParams();
        if (params.search) queryParams.append('search', params.search);
        if (params.ordering) queryParams.append('ordering', params.ordering);
        if (params.page) queryParams.append('page', params.page);
        if (params.page_size) queryParams.append('page_size', params.page_size);
        
        const url = `${this.baseURL}/departments/classrooms${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
        const response = await this.request(url, { method: 'GET' });
        const data = await this.handleResponse(response);
        
        // Handle paginated response
        if (data.results) {
            return data.results;
        }
        return data;
    },

    /**
     * Get single classroom by ID
     */
    async getClassroom(id) {
        const response = await this.request(`${this.baseURL}/departments/classrooms/${id}/`, { method: 'GET' });
        return this.handleResponse(response);
    },

    /**
     * Create new classroom
     */
    async createClassroom(data) {
        const response = await this.request(`${this.baseURL}/departments/classrooms/`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return this.handleResponse(response);
    },

    /**
     * Update classroom
     */
    async updateClassroom(id, data) {
        const response = await this.request(`${this.baseURL}/departments/classrooms/${id}/`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        return this.handleResponse(response);
    },

    /**
     * Delete classroom
     */
    async deleteClassroom(id) {
        const response = await this.request(`${this.baseURL}/departments/classrooms/${id}/`, { method: 'DELETE' });
        if (response.status === 204) {
            return null;
        }
        return this.handleResponse(response);
    },

    // ========== COURSES API ==========

    /**
     * Get all courses (with pagination and filtering support)
     * @param {Object} params - Query parameters (page, page_size, search, department, units, ordering)
     */
    async getCourses(params = {}) {
        const queryParams = new URLSearchParams();
        if (params.page) queryParams.append('page', params.page);
        if (params.page_size) queryParams.append('page_size', params.page_size);
        if (params.search) queryParams.append('search', params.search);
        if (params.department) queryParams.append('department', params.department);
        if (params.units) queryParams.append('units', params.units);
        if (params.ordering) queryParams.append('ordering', params.ordering);
        
        const url = `${this.baseURL}/courses/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
        const response = await this.request(url, { method: 'GET' });
        const data = await this.handleResponse(response);
        
        // Handle paginated response
        if (data.results) {
            return data.results; // Return just the results array
        }
        return data; // Return as-is if not paginated
    },

    /**
     * Get single course by ID
     */
    async getCourse(id) {
        const response = await this.request(`${this.baseURL}/courses/${id}/`, { method: 'GET' });
        return this.handleResponse(response);
    },

    /**
     * Create new course
     */
    async createCourse(data) {
        const response = await this.request(`${this.baseURL}/courses/`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return this.handleResponse(response);
    },

    /**
     * Update course
     */
    async updateCourse(id, data) {
        const response = await this.request(`${this.baseURL}/courses/${id}/`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        return this.handleResponse(response);
    },

    /**
     * Delete course
     */
    async deleteCourse(id) {
        const response = await this.request(`${this.baseURL}/courses/${id}/`, { method: 'DELETE' });
        if (response.status === 204) {
            return null;
        }
        return this.handleResponse(response);
    },

    // ========== USERS API ==========

    /**
     * Get all users (with pagination and filtering support)
     * @param {Object} params - Query parameters (page, page_size, search, role, ordering)
     */
    async getUsers(params = {}) {
        const queryParams = new URLSearchParams();
        if (params.page) queryParams.append('page', params.page);
        if (params.page_size) queryParams.append('page_size', params.page_size);
        if (params.search) queryParams.append('search', params.search);
        if (params.role) queryParams.append('role', params.role);
        if (params.ordering) queryParams.append('ordering', params.ordering);
        
        const url = `${this.baseURL}/accounts/users/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
        const response = await this.request(url, { method: 'GET' });
        const data = await this.handleResponse(response);
        
        // Handle paginated response
        if (data.results) {
            return data.results; // Return just the results array
        }
        return data; // Return as-is if not paginated
    },

    /**
     * Get single user by ID
     */
    async getUser(id) {
        const response = await this.request(`${this.baseURL}/accounts/users/${id}/`, { method: 'GET' });
        return this.handleResponse(response);
    },

    /**
     * Create new user
     */
    async createUser(data) {
        const response = await this.request(`${this.baseURL}/accounts/users/`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return this.handleResponse(response);
    },

    /**
     * Update user
     */
    async updateUser(id, data) {
        const response = await this.request(`${this.baseURL}/accounts/users/${id}/`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        return this.handleResponse(response);
    },

    /**
     * Delete user
     */
    async deleteUser(id) {
        const response = await this.request(`${this.baseURL}/accounts/users/${id}/`, { method: 'DELETE' });
        if (response.status === 204) {
            return null;
        }
        return this.handleResponse(response);
    },

    // ========== TERMS API ==========

    /**
     * Get all terms (with pagination support)
     * @param {Object} params - Query parameters (page, page_size, ordering)
     */
    async getTerms(params = {}) {
        const queryParams = new URLSearchParams();
        if (params.page) queryParams.append('page', params.page);
        if (params.page_size) queryParams.append('page_size', params.page_size);
        if (params.ordering) queryParams.append('ordering', params.ordering);
        
        const url = `${this.baseURL}/terms/terms/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
        const response = await this.request(url, { method: 'GET' });
        const data = await this.handleResponse(response);
        
        if (data.results) {
            return data.results;
        }
        return data;
    },

    /**
     * Get single term by ID
     */
    async getTerm(id) {
        const response = await this.request(`${this.baseURL}/terms/terms/${id}/`, { method: 'GET' });
        return this.handleResponse(response);
    },

    /**
     * Create new term
     */
    async createTerm(data) {
        const response = await this.request(`${this.baseURL}/terms/terms/`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return this.handleResponse(response);
    },

    /**
     * Update term
     */
    async updateTerm(id, data) {
        const response = await this.request(`${this.baseURL}/terms/terms/${id}/`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        return this.handleResponse(response);
    },

    /**
     * Delete term
     */
    async deleteTerm(id) {
        const response = await this.request(`${this.baseURL}/terms/terms/${id}/`, { method: 'DELETE' });
        if (response.status === 204) {
            return null;
        }
        return this.handleResponse(response);
    },

    /**
     * Activate term
     */
    async activateTerm(id) {
        const response = await this.request(`${this.baseURL}/terms/terms/${id}/activate/`, { method: 'POST' });
        return this.handleResponse(response);
    },

    /**
     * Deactivate term
     */
    async deactivateTerm(id) {
        const response = await this.request(`${this.baseURL}/terms/terms/${id}/deactivate/`, { method: 'POST' });
        return this.handleResponse(response);
    },

    // ========== SECTIONS API ==========

    /**
     * Get all sections (with pagination and filtering support)
     * @param {Object} params - Query parameters (page, page_size, search, term, department, professor, ordering)
     */
    async getSections(params = {}) {
        const queryParams = new URLSearchParams();
        if (params.page) queryParams.append('page', params.page);
        if (params.page_size) queryParams.append('page_size', params.page_size);
        if (params.search) queryParams.append('search', params.search);
        if (params.term) queryParams.append('term', params.term);
        if (params.department) queryParams.append('department', params.department);
        if (params.professor) queryParams.append('professor', params.professor);
        if (params.ordering) queryParams.append('ordering', params.ordering);
        
        const url = `${this.baseURL}/offerings/sections/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
        const response = await this.request(url, { method: 'GET' });
        const data = await this.handleResponse(response);
        
        if (data.results) {
            return data.results;
        }
        return data;
    },

    /**
     * Get single section by ID
     */
    async getSection(id) {
        const response = await this.request(`${this.baseURL}/offerings/sections/${id}/`, { method: 'GET' });
        return this.handleResponse(response);
    },

    /**
     * Create new section
     */
    async createSection(data) {
        const response = await this.request(`${this.baseURL}/offerings/sections/`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return this.handleResponse(response);
    },

    /**
     * Update section
     */
    async updateSection(id, data) {
        const response = await this.request(`${this.baseURL}/offerings/sections/${id}/`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        return this.handleResponse(response);
    },

    /**
     * Delete section
     */
    async deleteSection(id) {
        const response = await this.request(`${this.baseURL}/offerings/sections/${id}/`, { method: 'DELETE' });
        if (response.status === 204) {
            return null;
        }
        return this.handleResponse(response);
    },

    /**
     * Get time slots
     */
    async getTimeSlots() {
        const response = await this.request(`${this.baseURL}/offerings/sections/time-slots/`, { method: 'GET' });
        const data = await this.handleResponse(response);
        return data.time_slots || [];
    },

    // ========== PREREQUISITES API ==========

    /**
     * Get all prerequisites (with pagination support)
     * @param {Object} params - Query parameters (page, page_size, course, ordering)
     */
    async getPrerequisites(params = {}) {
        const queryParams = new URLSearchParams();
        if (params.page) queryParams.append('page', params.page);
        if (params.page_size) queryParams.append('page_size', params.page_size);
        if (params.course) queryParams.append('course', params.course);
        if (params.ordering) queryParams.append('ordering', params.ordering);
        
        const url = `${this.baseURL}/offerings/prerequisites/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
        const response = await this.request(url, { method: 'GET' });
        const data = await this.handleResponse(response);
        
        if (data.results) {
            return data.results;
        }
        return data;
    },

    /**
     * Get single prerequisite by ID
     */
    async getPrerequisite(id) {
        const response = await this.request(`${this.baseURL}/offerings/prerequisites/${id}/`, { method: 'GET' });
        return this.handleResponse(response);
    },

    /**
     * Create new prerequisite
     */
    async createPrerequisite(data) {
        const response = await this.request(`${this.baseURL}/offerings/prerequisites/`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return this.handleResponse(response);
    },

    /**
     * Add prerequisite using custom action
     */
    async addPrerequisite(data) {
        const response = await this.request(`${this.baseURL}/offerings/prerequisites/add_prerequisite/`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return this.handleResponse(response);
    },

    /**
     * Remove prerequisite using custom action
     */
    async removePrerequisite(data) {
        const response = await this.request(`${this.baseURL}/offerings/prerequisites/remove_prerequisite/`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        
        // 204 No Content means success
        if (response.status === 204) {
            return null;
        }
        
        // For any other status, handle as error
        return this.handleResponse(response);
    },

    /**
     * Update prerequisite
     */
    async updatePrerequisite(id, data) {
        const response = await this.request(`${this.baseURL}/offerings/prerequisites/${id}/`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        return this.handleResponse(response);
    },

    /**
     * Delete prerequisite
     */
    async deletePrerequisite(id) {
        const response = await this.request(`${this.baseURL}/offerings/prerequisites/${id}/`, { method: 'DELETE' });
        if (response.status === 204) {
            return null;
        }
        return this.handleResponse(response);
    }
};

