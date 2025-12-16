// Professor Lessons component
function professorLessonsManager() {
    return {
        sections: [],
        terms: [],
        departments: [],
        professorId: null,
        loading: false,
        error: '',
        success: '',
        // Filter states
        searchText: '',
        selectedTerm: '',
        selectedDepartment: '',

        async init() {
            // Get current professor ID from stored user data
            const storedUser = API.getStoredUser();
            if (storedUser && storedUser.id) {
                this.professorId = storedUser.id;
            } else {
                this.error = 'اطلاعات کاربر یافت نشد. لطفاً دوباره وارد شوید.';
                return;
            }

            await Promise.all([
                this.loadSections(),
                this.loadTerms(),
                this.loadDepartments()
            ]);
        },

        async loadSections() {
            if (!this.professorId) {
                return;
            }

            this.loading = true;
            this.error = '';
            try {
                const params = {
                    professor: this.professorId  // Filter by current professor
                };
                
                if (this.searchText && this.searchText.trim()) {
                    params.search = this.searchText.trim();
                }
                
                if (this.selectedTerm) {
                    params.term = this.selectedTerm;
                }
                
                if (this.selectedDepartment) {
                    params.department = this.selectedDepartment;
                }
                
                this.sections = await API.getSections(params);
            } catch (err) {
                this.error = err.message || 'خطا در بارگذاری دروس';
            } finally {
                this.loading = false;
            }
        },

        async loadTerms() {
            try {
                this.terms = await API.getTerms();
            } catch (err) {
                console.error('Error loading terms:', err);
            }
        },

        async loadDepartments() {
            try {
                this.departments = await API.getDepartments();
            } catch (err) {
                console.error('Error loading departments:', err);
            }
        },

        applyFilters() {
            this.loadSections();
        },

        clearFilters() {
            this.searchText = '';
            this.selectedTerm = '';
            this.selectedDepartment = '';
            this.loadSections();
        },

        getScheduleText(schedule) {
            const days = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
            const dayName = days[schedule.day_of_week] || schedule.day_of_week;
            const startTime = this.formatTime(schedule.start_time);
            const endTime = this.formatTime(schedule.end_time);
            let text = `${dayName}: ${startTime} - ${endTime}`;
            if (schedule.location) {
                text += ` (${schedule.location})`;
            }
            return text;
        },

        formatTime(timeString) {
            if (!timeString) return '-';
            const time = new Date('2000-01-01T' + timeString);
            return time.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
        },

        formatDateTime(dateTimeString) {
            if (!dateTimeString) return '-';
            const date = new Date(dateTimeString);
            return date.toLocaleString('fa-IR', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }
}

