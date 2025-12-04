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
                    window.location.href = '/admin/departments/';
                } else {
                    window.location.href = '/dashboard/';
                }

            } catch (err) {
                this.error = err.message || 'نام کاربری یا رمز عبور اشتباه است';
            } finally {
                this.loading = false;
            }
        }
    }
}

