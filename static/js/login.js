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

                // Redirect based on user role
                if (result.user.role === 'admin') {
                    // Admin panel dashboard (departments page as start)
                    window.location.href = '/admin/departments/';
                } else if (result.user.role === 'student') {
                    // Student dashboard (HTML template)
                    window.location.href = '/api/accounts/student/dashboard/';
                } else if (result.user.role === 'professor') {
                    // Professor dashboard (HTML template)
                    window.location.href = '/api/accounts/professor/dashboard/';
                } else {
                    // Fallback: go back to login
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

