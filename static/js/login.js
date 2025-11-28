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
                await API.login(this.username, this.password);

                // Redirect to dashboard after successful login
                window.location.href = '/dashboard/';

            } catch (err) {
                this.error = err.message || 'نام کاربری یا رمز عبور اشتباه است';
            } finally {
                this.loading = false;
            }
        }
    }
}

