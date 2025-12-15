// Login form component using Alpine.js
function loginForm() {
    return {
        username: '',
        password: '',
        loading: false,
        error: '',

        async handleLogin() {
            this.error = '';
            this.loading = true;

            try {
                const result = await API.login(this.username, this.password);

                // Redirect based on user role (prioritize role-based redirect)
                if (result.user.role === 'admin') {
                    // Admin panel dashboard
                    window.location.href = '/admin/dashboard/';
                } else if (result.user.role === 'student') {
                    // Student dashboard
                    window.location.href = '/api/accounts/student/dashboard/';
                } else if (result.user.role === 'professor') {
                    // Professor dashboard
                    window.location.href = '/api/accounts/professor/dashboard/';
                } else if (result.redirect_url) {
                    // Fallback to API redirect_url if role doesn't match
                    window.location.href = result.redirect_url;
                } else {
                    // Final fallback: go back to login
                    window.location.href = '/';
                }

            } catch (err) {
                this.error = err.message || 'نام کاربری یا رمز عبور اشتباه است';
            } finally {
                this.loading = false;
            }
        }
    }
}

