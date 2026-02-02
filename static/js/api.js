// API configuration and helper functions
const API = {
    // Base URL for API endpoints
    baseURL: '/api',
    
    // Flag to track if we're currently redirecting (prevent multiple redirects)
    _isRedirecting: false,
    
    /**
     * Get authentication headers with access token
     */
    getAuthHeaders() {
        const token = localStorage.getItem('access_token');
        if (!token) {
            console.warn('No access token found in localStorage');
        }
        return {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        };
    },
    
    /**
     * Handle API response and parse JSON
     * @param {Response} response - Fetch response object
     * @param {boolean} skipRedirect - Skip automatic redirect on auth errors
     */
    async handleResponse(response, skipRedirect = true) {
        let data;
        try {
            // Check content type before trying to parse JSON
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                // If not JSON and response is ok, return null (e.g., empty DELETE response)
                if (response.ok) {
                    return null;
                }
                // If error and not JSON, try to get text
                const text = await response.text();
                throw new Error(text || 'خطا در ارتباط با سرور. لطفاً اتصال اینترنت خود را بررسی کنید.');
            }
        } catch (e) {
            // If response is not JSON (e.g., empty response for DELETE)
            if (response.ok && e.name === 'SyntaxError') {
                return null;
            }
            // If it's already an Error object, re-throw it
            if (e instanceof Error && e.message !== 'خطا در ارتباط با سرور. لطفاً اتصال اینترنت خود را بررسی کنید.') {
                throw e;
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
                    } else if (typeof data[key] === 'object' && data[key].message) {
                        errors.push(data[key].message);
                    }
                }
                if (errors.length > 0) {
                    throw new Error(errors.join('\n'));
                }
            }
            
            // Handle authentication errors - NEVER redirect automatically
            // Let the calling code decide what to do
            if (response.status === 403) {
                throw new Error('شما دسترسی لازم برای این عملیات را ندارید.');
            }
            
            if (response.status === 401) {
                throw new Error('نشست شما منقضی شده است. لطفاً دوباره وارد شوید.');
            }
            
            const error = data.detail || data.error || data.message || data.username || data.password || 'خطا در ارتباط با سرور';
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
                // Refresh failed - clear auth but DON'T redirect
                // Let the calling code handle the error
                console.error('Token refresh failed:', refreshError);
                this.clearAuth();
                // Return the original 401 response so caller can handle it
                return response;
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

            // Skip redirect for refresh endpoint to avoid infinite loop
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

    /**
     * Check if user is authenticated (has valid token)
     */
    isAuthenticated() {
        return !!localStorage.getItem('access_token');
    },

    /**
     * Redirect to login page (only call this explicitly when needed)
     */
    redirectToLogin() {
        if (this._isRedirecting) return;
        this._isRedirecting = true;
        this.clearAuth();
        setTimeout(() => {
            window.location.href = '/';
            this._isRedirecting = false;
        }, 100);
    },

    // ========== DEPARTMENTS API ==========
    
    /**
     * Get all departments (with pagination support)
     * @param {Object} params - Query parameters (page, page_size, search, ordering)
     */
    async getDepartments(params = {}) {
        try {
            const queryParams = new URLSearchParams();
            if (params.page) queryParams.append('page', params.page);
            if (params.page_size) queryParams.append('page_size', params.page_size);
            if (params.search) queryParams.append('search', params.search);
            if (params.ordering) queryParams.append('ordering', params.ordering);
            
            const url = `${this.baseURL}/departments/departments${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
            const response = await this.request(url, { method: 'GET' });
            const data = await this.handleResponse(response);
            
            // Handle paginated response
            if (data.results) {
                return data.results; // Return just the results array
            }
            return Array.isArray(data) ? data : [];
        } catch (err) {
            console.error('Error loading departments:', err);
            return [];
        }
    },

    /**
     * Get single department by ID
     */
    async getDepartment(id) {
        try {
            const response = await this.request(`${this.baseURL}/departments/departments/${id}/`, { method: 'GET' });
            return await this.handleResponse(response);
        } catch (err) {
            console.error('Error loading department:', err);
            throw err;
        }
    },

    /**
     * Create new department
     */
    async createDepartment(data) {
        const response = await this.request(`${this.baseURL}/departments/departments/`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return await this.handleResponse(response);
    },

    /**
     * Update department
     */
    async updateDepartment(id, data) {
        const response = await this.request(`${this.baseURL}/departments/departments/${id}/`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        return await this.handleResponse(response);
    },

    /**
     * Delete department
     */
    async deleteDepartment(id) {
        const response = await this.request(`${this.baseURL}/departments/departments/${id}/`, { method: 'DELETE' });
        if (response.status === 204) {
            return null;
        }
        return await this.handleResponse(response);
    },

    // ========== CLASSROOMS API ==========
    /**
     * Get all classrooms with optional filters
     * @param {Object} params - Query parameters (search, ordering, page, page_size)
     */
    async getClassrooms(params = {}) {
        try {
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
            return Array.isArray(data) ? data : [];
        } catch (err) {
            console.error('Error loading classrooms:', err);
            return [];
        }
    },

    /**
     * Get single classroom by ID
     */
    async getClassroom(id) {
        try {
            const response = await this.request(`${this.baseURL}/departments/classrooms/${id}/`, { method: 'GET' });
            return await this.handleResponse(response);
        } catch (err) {
            console.error('Error loading classroom:', err);
            throw err;
        }
    },

    /**
     * Create new classroom
     */
    async createClassroom(data) {
        const response = await this.request(`${this.baseURL}/departments/classrooms/`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return await this.handleResponse(response);
    },

    /**
     * Update classroom
     */
    async updateClassroom(id, data) {
        const response = await this.request(`${this.baseURL}/departments/classrooms/${id}/`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        return await this.handleResponse(response);
    },

    /**
     * Delete classroom
     */
    async deleteClassroom(id) {
        const response = await this.request(`${this.baseURL}/departments/classrooms/${id}/`, { method: 'DELETE' });
        if (response.status === 204) {
            return null;
        }
        return await this.handleResponse(response);
    },

    // ========== COURSES API ==========

    /**
     * Get all courses (with pagination and filtering support)
     * @param {Object} params - Query parameters (page, page_size, search, department, units, ordering)
     */
    async getCourses(params = {}) {
        try {
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
            return Array.isArray(data) ? data : [];
        } catch (err) {
            console.error('Error loading courses:', err);
            return [];
        }
    },

    /**
     * Get single course by ID
     */
    async getCourse(id) {
        try {
            const response = await this.request(`${this.baseURL}/courses/${id}/`, { method: 'GET' });
            return await this.handleResponse(response);
        } catch (err) {
            console.error('Error loading course:', err);
            throw err;
        }
    },

    /**
     * Create new course
     */
    async createCourse(data) {
        const response = await this.request(`${this.baseURL}/courses/`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return await this.handleResponse(response);
    },

    /**
     * Update course
     */
    async updateCourse(id, data) {
        const response = await this.request(`${this.baseURL}/courses/${id}/`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        return await this.handleResponse(response);
    },

    /**
     * Delete course
     */
    async deleteCourse(id) {
        const response = await this.request(`${this.baseURL}/courses/${id}/`, { method: 'DELETE' });
        if (response.status === 204) {
            return null;
        }
        return await this.handleResponse(response);
    },

    // ========== USERS API ==========

    /**
     * Get all users (with pagination and filtering support)
     * @param {Object} params - Query parameters (page, page_size, search, role, ordering)
     */
    async getUsers(params = {}) {
        try {
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
            return Array.isArray(data) ? data : [];
        } catch (err) {
            console.error('Error loading users:', err);
            return [];
        }
    },

    /**
     * Get single user by ID
     */
    async getUser(id) {
        try {
            const response = await this.request(`${this.baseURL}/accounts/users/${id}/`, { method: 'GET' });
            return await this.handleResponse(response);
        } catch (err) {
            console.error('Error loading user:', err);
            throw err;
        }
    },

    /**
     * Create new user
     */
    async createUser(data) {
        const response = await this.request(`${this.baseURL}/accounts/users/`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return await this.handleResponse(response);
    },

    /**
     * Update user
     */
    async updateUser(id, data) {
        const response = await this.request(`${this.baseURL}/accounts/users/${id}/`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        return await this.handleResponse(response);
    },

    /**
     * Delete user
     */
    async deleteUser(id) {
        const response = await this.request(`${this.baseURL}/accounts/users/${id}/`, { method: 'DELETE' });
        if (response.status === 204) {
            return null;
        }
        return await this.handleResponse(response);
    },

    // ========== TERMS API ==========

    /**
     * Get all terms (with pagination support)
     * @param {Object} params - Query parameters (page, page_size, ordering)
     */
    async getTerms(params = {}) {
        try {
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
            return Array.isArray(data) ? data : [];
        } catch (err) {
            console.error('Error loading terms:', err);
            return [];
        }
    },

    /**
     * Get single term by ID
     */
    async getTerm(id) {
        try {
            const response = await this.request(`${this.baseURL}/terms/terms/${id}/`, { method: 'GET' });
            return await this.handleResponse(response);
        } catch (err) {
            console.error('Error loading term:', err);
            throw err;
        }
    },

    /**
     * Create new term
     */
    async createTerm(data) {
        const response = await this.request(`${this.baseURL}/terms/terms/`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return await this.handleResponse(response);
    },

    /**
     * Update term
     */
    async updateTerm(id, data) {
        const response = await this.request(`${this.baseURL}/terms/terms/${id}/`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        return await this.handleResponse(response);
    },

    /**
     * Delete term
     */
    async deleteTerm(id) {
        const response = await this.request(`${this.baseURL}/terms/terms/${id}/`, { method: 'DELETE' });
        if (response.status === 204) {
            return null;
        }
        return await this.handleResponse(response);
    },

    /**
     * Activate term
     */
    async activateTerm(id) {
        const response = await this.request(`${this.baseURL}/terms/terms/${id}/activate/`, { method: 'POST' });
        return await this.handleResponse(response);
    },

    /**
     * Deactivate term
     */
    async deactivateTerm(id) {
        const response = await this.request(`${this.baseURL}/terms/terms/${id}/deactivate/`, { method: 'POST' });
        return await this.handleResponse(response);
    },

    // ========== SECTIONS API ==========

    /**
     * Get all sections (with pagination and filtering support)
     * @param {Object} params - Query parameters (page, page_size, search, term, department, professor, ordering)
     */
    async getSections(params = {}) {
        try {
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
            return Array.isArray(data) ? data : [];
        } catch (err) {
            console.error('Error loading sections:', err);
            return [];
        }
    },

    /**
     * Get single section by ID
     */
    async getSection(id) {
        try {
            const response = await this.request(`${this.baseURL}/offerings/sections/${id}/`, { method: 'GET' });
            return await this.handleResponse(response);
        } catch (err) {
            console.error('Error loading section:', err);
            throw err;
        }
    },

    /**
     * Create new section
     */
    async createSection(data) {
        const response = await this.request(`${this.baseURL}/offerings/sections/`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return await this.handleResponse(response);
    },

    /**
     * Update section
     */
    async updateSection(id, data) {
        const response = await this.request(`${this.baseURL}/offerings/sections/${id}/`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        return await this.handleResponse(response);
    },

    /**
     * Delete section
     */
    async deleteSection(id) {
        const response = await this.request(`${this.baseURL}/offerings/sections/${id}/`, { method: 'DELETE' });
        if (response.status === 204) {
            return null;
        }
        return await this.handleResponse(response);
    },

    /**
     * Get time slots
     */
    async getTimeSlots() {
        try {
            const response = await this.request(`${this.baseURL}/offerings/sections/time-slots/`, { method: 'GET' });
            const data = await this.handleResponse(response);
            return data.time_slots || [];
        } catch (err) {
            console.error('Error loading time slots:', err);
            return [];
        }
    },

    // ========== PREREQUISITES API ==========

    /**
     * Get all prerequisites (with pagination support)
     * @param {Object} params - Query parameters (page, page_size, course, ordering)
     */
    async getPrerequisites(params = {}) {
        try {
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
            return Array.isArray(data) ? data : [];
        } catch (err) {
            console.error('Error loading prerequisites:', err);
            return [];
        }
    },

    /**
     * Get single prerequisite by ID
     */
    async getPrerequisite(id) {
        try {
            const response = await this.request(`${this.baseURL}/offerings/prerequisites/${id}/`, { method: 'GET' });
            return await this.handleResponse(response);
        } catch (err) {
            console.error('Error loading prerequisite:', err);
            throw err;
        }
    },

    /**
     * Create new prerequisite
     */
    async createPrerequisite(data) {
        const response = await this.request(`${this.baseURL}/offerings/prerequisites/`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return await this.handleResponse(response);
    },

    /**
     * Add prerequisite using custom action
     */
    async addPrerequisite(data) {
        const response = await this.request(`${this.baseURL}/offerings/prerequisites/add_prerequisite/`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return await this.handleResponse(response);
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
        return await this.handleResponse(response);
    },

    /**
     * Update prerequisite
     */
    async updatePrerequisite(id, data) {
        const response = await this.request(`${this.baseURL}/offerings/prerequisites/${id}/`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        return await this.handleResponse(response);
    },

    /**
     * Delete prerequisite
     */
    async deletePrerequisite(id) {
        const response = await this.request(`${this.baseURL}/offerings/prerequisites/${id}/`, { method: 'DELETE' });
        if (response.status === 204) {
            return null;
        }
        return await this.handleResponse(response);
    },

    // ========== REGISTRATION API ==========

    /**
     * Get all registrations for current student (with pagination support)
     * @param {Object} params - Query parameters (page, page_size)
     */
    async getMyRegistrations(params = {}) {
        try {
            const queryParams = new URLSearchParams();
            if (params.page) queryParams.append('page', params.page);
            if (params.page_size) queryParams.append('page_size', params.page_size);
            
            const url = `${this.baseURL}/registration/registrations/my-registrations/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
            const response = await this.request(url, { method: 'GET' });
            const data = await this.handleResponse(response);
            
            if (data.results) {
                return data.results;
            }
            return Array.isArray(data) ? data : [];
        } catch (err) {
            console.warn('Could not load registrations:', err.message);
            return [];
        }
    },

    /**
     * Get weekly schedule for current student
     */
    async getWeeklySchedule() {
        try {
            const response = await this.request(`${this.baseURL}/registration/registrations/weekly-schedule/`, { method: 'GET' });
            return await this.handleResponse(response);
        } catch (err) {
            console.warn('Could not load weekly schedule:', err.message);
            return null;
        }
    },

    /**
     * Get total units for current student in active term
     */
    async getTotalUnits() {
        try {
            const response = await this.request(`${this.baseURL}/registration/registrations/total-units/`, { method: 'GET' });
            return await this.handleResponse(response);
        } catch (err) {
            console.warn('Could not load total units:', err.message);
            return { total_units: 0, term: null };
        }
    },

    /**
     * Register student for a section
     * @param {number} sectionId - Section ID to register for
     */
    async registerForSection(sectionId) {
        const response = await this.request(`${this.baseURL}/registration/registrations/`, {
            method: 'POST',
            body: JSON.stringify({ section_id: sectionId })
        });
        return await this.handleResponse(response);
    },

    async changeRegistrationSection(registrationId, sectionId) {
        const response = await this.request(`${this.baseURL}/registration/registrations/${registrationId}/change-section/`, {
            method: 'POST',
            body: JSON.stringify({ section_id: sectionId })
        });
        return await this.handleResponse(response);
    },

    /**
     * Drop a course (delete registration)
     * @param {number} registrationId - Registration ID to delete
     */
    async dropCourse(registrationId) {
        const response = await this.request(`${this.baseURL}/registration/registrations/${registrationId}/`, { method: 'DELETE' });
        if (response.status === 204) {
            return null;
        }
        return await this.handleResponse(response);
    },

    // ========== PROFESSOR SECTIONS API ==========

    /**
     * Get all sections taught by current professor
     * @param {Object} params - Query parameters (term, page, page_size)
     */
    async getMySections(params = {}) {
        try {
            const queryParams = new URLSearchParams();
            if (params.term) queryParams.append('term', params.term);
            if (params.page) queryParams.append('page', params.page);
            if (params.page_size) queryParams.append('page_size', params.page_size);
            
            const url = `${this.baseURL}/offerings/sections/my-sections/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
            const response = await this.request(url, { method: 'GET' });
            const data = await this.handleResponse(response);
            
            if (data.results) {
                return data.results;
            }
            return Array.isArray(data) ? data : [];
        } catch (err) {
            console.error('Error loading my sections:', err);
            return [];
        }
    },

    /**
     * Get enrolled students for a section
     * @param {number} sectionId - Section ID
     */
    async getEnrolledStudents(sectionId) {
        try {
            const response = await this.request(`${this.baseURL}/offerings/sections/${sectionId}/enrolled-students/`, { method: 'GET' });
            
            // Check if response is ok
            if (!response.ok) {
                // Try to get error message from JSON response
                let errorMessage = 'خطا در بارگذاری لیست دانشجویان';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorData.detail || errorData.message || errorMessage;
                } catch (e) {
                    // If not JSON, use status-based message
                    if (response.status === 403) {
                        errorMessage = 'شما دسترسی لازم برای این عملیات را ندارید.';
                    } else if (response.status === 404) {
                        errorMessage = 'بخش مورد نظر یافت نشد.';
                    } else if (response.status === 401) {
                        errorMessage = 'نشست شما منقضی شده است. لطفاً دوباره وارد شوید.';
                    }
                }
                throw new Error(errorMessage);
            }
            
            // Parse JSON response
            const data = await response.json();
            return data;
        } catch (err) {
            console.error('Error loading enrolled students:', err);
            // Re-throw with a more user-friendly message if needed
            if (err.message && err.message.includes('خطا در ارتباط با سرور')) {
                throw new Error('خطا در بارگذاری لیست دانشجویان. لطفاً دوباره تلاش کنید.');
            }
            throw err;
        }
    },

    /**
     * Remove a student from a section
     * @param {number} sectionId - Section ID
     * @param {number} studentId - Student ID to remove
     */
    async removeStudentFromSection(sectionId, studentId) {
        const response = await this.request(`${this.baseURL}/offerings/sections/${sectionId}/remove-student/`, {
            method: 'POST',
            body: JSON.stringify({ student_id: studentId })
        });
        return await this.handleResponse(response);
    }
};
