// Professor Dashboard component
function professorDashboardManager() {
    return {
        professorInfo: null,
        loading: false,
        error: '',
        success: '',

        async init() {
            await this.loadProfessorInfo();
        },

        async loadProfessorInfo() {
            this.loading = true;
            this.error = '';
            try {
                // Get current user from stored data (set during login)
                const storedUser = API.getStoredUser();
                if (storedUser) {
                    this.professorInfo = storedUser;
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

