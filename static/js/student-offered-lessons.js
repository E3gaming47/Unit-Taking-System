// Student Offered Lessons component
function offeredLessonsManager() {
    return {
        sections: [],
        terms: [],
        departments: [],
        courses: [],
        coursePrerequisites: {}, // Map of course_id -> prerequisites array
        loading: false,
        error: '',
        success: '',
        // Filter states
        searchText: '',
        selectedTerm: '',
        selectedDepartment: '',

        async init() {
            await Promise.all([
                this.loadSections(),
                this.loadTerms(),
                this.loadDepartments(),
                this.loadCourses()
            ]);
        },

        async loadSections() {
            this.loading = true;
            this.error = '';
            try {
                const params = {};
                
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
                
                // Load prerequisites for all unique courses
                await this.loadAllPrerequisites();
            } catch (err) {
                this.error = err.message || 'خطا در بارگذاری دروس ارائه شده';
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

        async loadCourses() {
            try {
                this.courses = await API.getCourses();
            } catch (err) {
                console.error('Error loading courses:', err);
            }
        },

        async loadAllPrerequisites() {
            // Get unique course IDs from sections
            const courseIds = [...new Set(this.sections
                .filter(s => s.course_id)
                .map(s => s.course_id)
            )];

            // Load prerequisites for each course
            // Use Promise.allSettled to continue even if some fail
            const promises = courseIds.map(async (courseId) => {
                try {
                    const prerequisites = await API.getPrerequisites({ course: courseId });
                    this.coursePrerequisites[courseId] = prerequisites || [];
                } catch (err) {
                    // Silently fail for prerequisites - don't break the page
                    console.warn(`Could not load prerequisites for course ${courseId}:`, err.message);
                    this.coursePrerequisites[courseId] = [];
                }
            });
            
            await Promise.allSettled(promises);
        },

        getPrerequisitesForCourse(courseId) {
            return this.coursePrerequisites[courseId] || [];
        },

        getPrerequisiteCourseName(prerequisite) {
            const prereqId = typeof prerequisite.prerequisite_course === 'object' 
                ? prerequisite.prerequisite_course.id 
                : parseInt(prerequisite.prerequisite_course);
            
            const course = this.courses.find(c => c.id === prereqId);
            return course ? `${course.code} - ${course.title}` : 'نامشخص';
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




