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
        // Students modal
        showStudentsModal: false,
        currentSectionId: null,
        currentSectionData: null,
        studentsData: {}, // Cache for student data
        loadingStudents: false, // Boolean flag for loading state
        removingStudent: null, // Format: "sectionId-studentId"
        // Filter states
        searchText: '',
        selectedTerm: '',
        selectedDepartment: '',

        async init() {
            // Get current professor ID from stored user data
            const storedUser = API.getStoredUser();
            if (storedUser && storedUser.id) {
                this.professorId = storedUser.id;
            }
            
            // Load initial data
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
                const params = {};
                if (this.selectedTerm) {
                    params.term = this.selectedTerm;
                }
                if (this.selectedDepartment) {
                    params.department = this.selectedDepartment;
                }
                if (this.searchText) {
                    params.search = this.searchText;
                }
                
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

        async applyFilters() {
            await this.loadSections();
        },

        getScheduleText(schedule) {
            const dayNames = {
                1: 'شنبه',
                2: 'یکشنبه',
                3: 'دوشنبه',
                4: 'سه‌شنبه',
                5: 'چهارشنبه',
                6: 'پنج‌شنبه',
                0: 'جمعه'
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

        getEnrollmentCount(sectionId) {
            const data = this.studentsData?.[sectionId] || this.studentsData?.[String(sectionId)];
            return data?.total_count || 0;
        },

        async openStudentsModal(sectionId) {
            this.currentSectionId = parseInt(sectionId);
            this.showStudentsModal = true;
            this.error = '';
            this.success = '';
            
            // Check if we already have data for this section
            const cachedData = this.studentsData?.[this.currentSectionId] || this.studentsData?.[String(this.currentSectionId)];
            if (cachedData) {
                this.currentSectionData = cachedData;
                return;
            }
            
            // Load students
            await this.loadEnrolledStudents(this.currentSectionId);
        },

        closeStudentsModal() {
            this.showStudentsModal = false;
            this.currentSectionId = null;
            this.currentSectionData = null;
            this.error = '';
            this.success = '';
        },

        async loadEnrolledStudents(sectionId) {
            this.loadingStudents = true;
            this.error = '';
            
            try {
                const data = await API.getEnrolledStudents(sectionId);
                
                if (data && typeof data === 'object' && 'students' in data) {
                    const newData = {
                        section: data.section || { id: sectionId },
                        students: Array.isArray(data.students) ? data.students : [],
                        total_count: data.total_count || (Array.isArray(data.students) ? data.students.length : 0),
                        capacity: data.capacity || 0,
                        available_spots: data.available_spots || 0
                    };
                    
                    // Store in cache
                    if (!this.studentsData) {
                        this.studentsData = {};
                    }
                    this.studentsData[sectionId] = newData;
                    this.studentsData[String(sectionId)] = newData;
                    
                    // Set current data for modal
                    this.currentSectionData = newData;
                } else {
                    // Empty structure
                    const emptyData = {
                        section: { id: sectionId },
                        students: [],
                        total_count: 0,
                        capacity: 0,
                        available_spots: 0
                    };
                    if (!this.studentsData) {
                        this.studentsData = {};
                    }
                    this.studentsData[sectionId] = emptyData;
                    this.studentsData[String(sectionId)] = emptyData;
                    this.currentSectionData = emptyData;
                }
            } catch (err) {
                console.error('Error loading enrolled students:', err);
                this.error = err.message || 'خطا در بارگذاری لیست دانشجویان';
                this.currentSectionData = null;
                setTimeout(() => {
                    this.error = '';
                }, 5000);
            } finally {
                this.loadingStudents = false;
            }
        },

        async removeStudent(sectionId, studentId) {
            const key = `${sectionId}-${studentId}`;
            if (this.removingStudent === key) {
                return;
            }
            
            if (!confirm('آیا از حذف این دانشجو از درس مطمئن هستید؟')) {
                return;
            }
            
            this.removingStudent = key;
            this.error = '';
            this.success = '';
            
            try {
                await API.removeStudentFromSection(sectionId, studentId);
                this.success = 'دانشجو با موفقیت حذف شد.';
                
                // Reload students list
                await this.loadEnrolledStudents(sectionId);
                
                setTimeout(() => {
                    this.success = '';
                }, 3000);
            } catch (err) {
                this.error = err.message || 'خطا در حذف دانشجو';
                setTimeout(() => {
                    this.error = '';
                }, 5000);
            } finally {
                this.removingStudent = null;
            }
        },
    };
}
