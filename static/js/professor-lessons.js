// Professor Lessons Management Component
function professorLessonsManager() {
    return {
        sections: [],
        terms: [],
        departments: [],
        loading: false,
        error: '',
        success: '',
        searchText: '',
        selectedTerm: '',
        selectedDepartment: '',
        
        // Students Modal
        showStudentsModal: false,
        currentSectionId: null,
        enrolledStudents: [],
        loadingStudents: false,
        currentSectionInfo: {
            course: '-',
            section_number: '-',
            total_count: 0,
            capacity: 0,
            available_spots: 0
        },
        removingStudent: null,

        async init() {
            const storedUser = API.getStoredUser();
            if (!storedUser || !storedUser.id) {
                this.error = 'خطا در دریافت اطلاعات کاربر';
                return;
            }
            
            await Promise.all([
                this.loadSections(),
                this.loadTerms(),
                this.loadDepartments()
            ]);
        },

        async loadSections() {
            this.loading = true;
            this.error = '';
            try {
                const params = {};
                if (this.selectedTerm) params.term = this.selectedTerm;
                if (this.selectedDepartment) params.department = this.selectedDepartment;
                if (this.searchText) params.search = this.searchText;
                
                this.sections = await API.getMySections(params);
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

        getEnrollmentCount(sectionId) {
            const section = this.sections.find(s => s.id === sectionId);
            return section?.enrollment_count ?? 0;
        },

        getScheduleText(schedule) {
            const dayNames = {
                1: 'شنبه', 2: 'یکشنبه', 3: 'دوشنبه', 4: 'سه‌شنبه',
                5: 'چهارشنبه', 6: 'پنج‌شنبه', 0: 'جمعه'
            };
            const day = dayNames[schedule.day_of_week] || schedule.day_of_week;
            const timeSlot = schedule.time_slot || '';
            const location = schedule.location || (schedule.classroom ? String(schedule.classroom) : 'نامشخص');
            return `${day} ${timeSlot} - ${location}`;
        },

        formatDateTime(datetimeStr) {
            if (!datetimeStr) return '-';
            try {
                const dt = new Date(datetimeStr);
                return dt.toLocaleString('fa-IR');
            } catch (e) {
                return datetimeStr;
            }
        },

        openStudentsModal(sectionId) {
            this.currentSectionId = parseInt(sectionId);
            this.enrolledStudents = [];
            this.currentSectionInfo = {
                course: '-',
                section_number: '-',
                total_count: 0,
                capacity: 0,
                available_spots: 0
            };
            this.error = '';
            this.success = '';
            this.showStudentsModal = true;
            this.loadStudents();
        },

        closeStudentsModal() {
            this.showStudentsModal = false;
            this.currentSectionId = null;
            this.enrolledStudents = [];
            this.currentSectionInfo = {
                course: '-',
                section_number: '-',
                total_count: 0,
                capacity: 0,
                available_spots: 0
            };
            this.error = '';
            this.success = '';
        },

        async loadStudents() {
            if (!this.currentSectionId) return;
            
            this.loadingStudents = true;
            this.error = '';
            
            try {
                const data = await API.getEnrolledStudents(this.currentSectionId);
                
                this.enrolledStudents = Array.isArray(data.students) ? data.students : [];
                this.currentSectionInfo = {
                    course: data.section?.course || '-',
                    section_number: data.section?.section_number || '-',
                    total_count: data.total_count || 0,
                    capacity: data.capacity || 0,
                    available_spots: data.available_spots || 0
                };
                
                // Update enrollment count in sections array
                const sectionIndex = this.sections.findIndex(s => s.id === this.currentSectionId);
                if (sectionIndex !== -1) {
                    this.sections[sectionIndex].enrollment_count = data.total_count || 0;
                }
            } catch (err) {
                console.error('Error loading enrolled students:', err);
                this.error = err.message || 'خطا در بارگذاری لیست دانشجویان';
                this.enrolledStudents = [];
            } finally {
                this.loadingStudents = false;
            }
        },

        async removeStudent(sectionId, studentId) {
            const key = `${sectionId}-${studentId}`;
            if (this.removingStudent === key) return;
            
            if (!confirm('آیا از حذف این دانشجو از درس مطمئن هستید؟')) {
                return;
            }
            
            this.removingStudent = key;
            this.error = '';
            this.success = '';
            
            try {
                await API.removeStudentFromSection(sectionId, studentId);
                this.success = 'دانشجو با موفقیت حذف شد.';
                await this.loadStudents();
                setTimeout(() => { this.success = ''; }, 3000);
            } catch (err) {
                this.error = err.message || 'خطا در حذف دانشجو';
                setTimeout(() => { this.error = ''; }, 5000);
            } finally {
                this.removingStudent = null;
            }
        }
    };
}

// Make sure the function is available globally for Alpine.js
if (typeof window !== 'undefined') {
    window.professorLessonsManager = professorLessonsManager;
}
