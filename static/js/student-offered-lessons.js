// Student Offered Lessons component
function offeredLessonsManager() {
    return {
        sections: [],
        terms: [],
        departments: [],
        courses: [],
        coursePrerequisites: {}, // Map of course_id -> prerequisites array
        myRegistrations: [], // List of enrolled sections
        enrolledSectionIds: new Set(), // Set of enrolled section IDs for quick lookup
        loading: false,
        error: '',
        success: '',
        enrolling: null, // Section ID being enrolled
        dropping: null, // Registration ID being dropped
        // Filter states
        searchText: '',
        selectedTerm: '',
        selectedDepartment: '',

        async init() {
            // Load sections first (most important)
            await this.loadSections();
            
            // Load other data in parallel, but don't fail if any of them fail
            await Promise.allSettled([
                this.loadMyRegistrations(),
                this.loadTerms(),
                this.loadDepartments(),
                this.loadCourses()
            ]);
        },

        async loadMyRegistrations() {
            try {
                const registrations = await API.getMyRegistrations();
                this.myRegistrations = Array.isArray(registrations) ? registrations : [];
                // Create a Set of enrolled section IDs for quick lookup
                this.enrolledSectionIds = new Set(
                    this.myRegistrations.map(reg => reg.section?.id).filter(id => id !== undefined)
                );
            } catch (err) {
                console.error('Error loading registrations:', err);
                // Don't show error or redirect - just continue without enrollment info
                this.myRegistrations = [];
                this.enrolledSectionIds = new Set();
            }
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
                
                // Load sections - API will return empty array on error, not throw
                this.sections = await API.getSections(params);
                
                if (this.sections.length === 0 && !this.searchText && !this.selectedTerm && !this.selectedDepartment) {
                    // Only show error if we have no filters and got empty result
                    // This might indicate an auth issue
                    const token = API.getAccessToken();
                    if (!token) {
                        this.error = 'نشست شما منقضی شده است. لطفاً صفحه را رفرش کنید یا دوباره وارد شوید.';
                    }
                }
                
                // Load prerequisites for all unique courses (don't fail if this fails)
                try {
                    await this.loadAllPrerequisites();
                } catch (prereqErr) {
                    console.warn('Could not load prerequisites:', prereqErr);
                    // Continue without prerequisites
                }
            } catch (err) {
                console.error('Unexpected error loading sections:', err);
                // Check if it's an auth error
                if (err.message && (err.message.includes('منقضی') || err.message.includes('دسترسی'))) {
                    this.error = 'نشست شما منقضی شده است. لطفاً صفحه را رفرش کنید یا دوباره وارد شوید.';
                } else {
                    this.error = err.message || 'خطا در بارگذاری دروس ارائه شده';
                }
                this.sections = [];
            } finally {
                this.loading = false;
            }
        },

        async loadTerms() {
            try {
                this.terms = await API.getTerms();
            } catch (err) {
                console.error('Error loading terms:', err);
                this.terms = []; // Set empty array on error
            }
        },

        async loadDepartments() {
            try {
                this.departments = await API.getDepartments();
            } catch (err) {
                console.error('Error loading departments:', err);
                this.departments = []; // Set empty array on error
            }
        },

        async loadCourses() {
            try {
                this.courses = await API.getCourses();
            } catch (err) {
                console.error('Error loading courses:', err);
                this.courses = []; // Set empty array on error
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
        },

        isEnrolled(sectionId) {
            return this.enrolledSectionIds.has(sectionId);
        },

        async enrollInSection(sectionId) {
            if (this.enrolling) return; // Prevent double-click
            
            this.enrolling = sectionId;
            this.error = '';
            this.success = '';
            
            try {
                const registration = await API.registerForSection(sectionId);
                // Add to enrolled sections
                this.enrolledSectionIds.add(sectionId);
                this.myRegistrations.push(registration);
                this.success = 'با موفقیت در این درس ثبت نام شدید.';
                
                // Clear success message after 3 seconds
                setTimeout(() => {
                    this.success = '';
                }, 3000);
            } catch (err) {
                this.error = err.message || 'خطا در ثبت نام';
                // Clear error message after 5 seconds
                setTimeout(() => {
                    this.error = '';
                }, 5000);
            } finally {
                this.enrolling = null;
            }
        },

        async dropCourse(sectionId) {
            if (this.dropping) return; // Prevent double-click
            
            // Find the registration for this section
            const registration = this.myRegistrations.find(reg => reg.section.id === sectionId);
            if (!registration) {
                this.error = 'ثبت نامی برای این درس یافت نشد.';
                return;
            }
            
            if (!confirm('آیا از حذف این واحد مطمئن هستید؟')) {
                return;
            }
            
            this.dropping = sectionId;
            this.error = '';
            this.success = '';
            
            try {
                await API.dropCourse(registration.id);
                // Remove from enrolled sections
                this.enrolledSectionIds.delete(sectionId);
                this.myRegistrations = this.myRegistrations.filter(reg => reg.id !== registration.id);
                this.success = 'واحد با موفقیت حذف شد.';
                
                // Clear success message after 3 seconds
                setTimeout(() => {
                    this.success = '';
                }, 3000);
            } catch (err) {
                this.error = err.message || 'خطا در حذف واحد';
                // Clear error message after 5 seconds
                setTimeout(() => {
                    this.error = '';
                }, 5000);
            } finally {
                this.dropping = null;
            }
        }
    }
}




