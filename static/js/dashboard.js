// Dashboard component
function dashboardManager() {
    return {
        adminInfo: null,
        loading: false,
        error: '',
        success: '',

        async init() {
            await this.loadAdminInfo();
        },

        async loadAdminInfo() {
            this.loading = true;
            this.error = '';
            try {
                // Get current user from stored data or fetch from API
                const storedUser = API.getStoredUser();
                if (storedUser) {
                    this.adminInfo = storedUser;
                } else {
                    // If not in storage, try to get from API
                    // We'll use the stored user for now since login sets it
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

