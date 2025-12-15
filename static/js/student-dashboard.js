// Student Dashboard component
function studentDashboardManager() {
    return {
        studentInfo: null,
        loading: false,
        error: '',
        success: '',

        async init() {
            await this.loadStudentInfo();
        },

        async loadStudentInfo() {
            this.loading = true;
            this.error = '';
            try {
                // Get current user from stored data (set during login)
                const storedUser = API.getStoredUser();
                if (storedUser) {
                    this.studentInfo = storedUser;
                } else {
                    // If not in storage, try to get from API
                    this.error = 'اطلاعات کاربر یافت نشد. لطفاً دوباره وارد شوید.';
                }
            } catch (err) {
                this.error = err.message || 'خطا در بارگذاری اطلاعات';
            } finally {
                this.loading = false;
            }
        }
    }
}

