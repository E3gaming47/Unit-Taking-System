// Term Offerings (Sections) management component
function termOfferingsManager() {
    return {
        sections: [],
        terms: [],
        courses: [],
        departments: [],
        professors: [],
        loading: false,
        error: '',
        success: '',
        showModal: false,
        editingId: null,
        // Filter states
        searchText: '',
        selectedTerm: '',
        selectedDepartment: '',
        // Prerequisites management
        coursePrerequisites: [],
        showPrerequisitesSection: false,
        newPrerequisiteCourse: '',
        loadingPrerequisites: false,
        form: {
            term: '',
            course: '',
            professor: '',
            section_number: 1,
            capacity: 1,
            schedules: [],
            exam: null
        },

        async init() {
            await Promise.all([
                this.loadSections(),
                this.loadTerms(),
                this.loadCourses(),
                this.loadDepartments(),
                this.loadProfessors()
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
            } catch (err) {
                this.error = err.message || 'خطا در بارگذاری ارائه‌ها';
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

        async loadCourses() {
            try {
                this.courses = await API.getCourses();
            } catch (err) {
                console.error('Error loading courses:', err);
            }
        },

        async loadDepartments() {
            try {
                this.departments = await API.getDepartments();
            } catch (err) {
                console.error('Error loading departments:', err);
            }
        },

        async loadProfessors() {
            try {
                this.professors = await API.getUsers({ role: 'professor' });
            } catch (err) {
                console.error('Error loading professors:', err);
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

        openAddModal() {
            this.editingId = null;
            this.form = {
                term: '',
                course: '',
                professor: '',
                section_number: 1,
                capacity: 1,
                schedules: [],
                exam: null
            };
            this.coursePrerequisites = [];
            this.showPrerequisitesSection = false;
            this.newPrerequisiteCourse = '';
            this.error = '';
            this.success = '';
            this.showModal = true;
        },

        async openEditModal(section) {
            this.editingId = section.id;
            try {
                // Get full section details including schedules and exam
                const sectionDetails = await API.getSection(section.id);
                
                // SectionDetailSerializer returns term, course, professor as strings
                // We need to find the IDs by matching with our dropdowns
                const termId = this.terms.find(t => t.name === section.term)?.id || '';
                const courseId = this.courses.find(c => `${c.code} - ${c.title}` === section.course)?.id || '';
                const professorId = this.professors.find(p => {
                    const profName = p.username + (p.first_name ? ` (${p.first_name} ${p.last_name || ''})` : '');
                    return profName === section.professor || p.username === section.professor;
                })?.id || '';
                
                // Format schedules for editing (ensure time format is HH:MM)
                const formattedSchedules = (sectionDetails.schedules || []).map(s => ({
                    day_of_week: s.day_of_week,
                    start_time: s.start_time ? s.start_time.substring(0, 5) : '',
                    end_time: s.end_time ? s.end_time.substring(0, 5) : '',
                    location: s.location || ''
                }));

                // Format exam datetime for datetime-local input (YYYY-MM-DDTHH:MM)
                let formattedExam = null;
                if (sectionDetails.exam && sectionDetails.exam.exam_datetime) {
                    const examDate = new Date(sectionDetails.exam.exam_datetime);
                    const year = examDate.getFullYear();
                    const month = String(examDate.getMonth() + 1).padStart(2, '0');
                    const day = String(examDate.getDate()).padStart(2, '0');
                    const hours = String(examDate.getHours()).padStart(2, '0');
                    const minutes = String(examDate.getMinutes()).padStart(2, '0');
                    formattedExam = {
                        exam_datetime: `${year}-${month}-${day}T${hours}:${minutes}`,
                        location: sectionDetails.exam.location || ''
                    };
                }

                this.form = {
                    term: termId,
                    course: courseId,
                    professor: professorId,
                    section_number: section.section_number || 1,
                    capacity: section.capacity || 1,
                    schedules: formattedSchedules,
                    exam: formattedExam
                };
                
                // Load prerequisites for this course
                if (courseId) {
                    await this.loadCoursePrerequisites(courseId);
                    this.showPrerequisitesSection = true;
                }
            } catch (err) {
                this.error = 'خطا در بارگذاری اطلاعات ارائه';
                return;
            }
            this.error = '';
            this.success = '';
            this.showModal = true;
        },

        closeModal() {
            this.showModal = false;
            this.editingId = null;
            this.form = {
                term: '',
                course: '',
                professor: '',
                section_number: 1,
                capacity: 1,
                schedules: [],
                exam: null
            };
            this.coursePrerequisites = [];
            this.showPrerequisitesSection = false;
            this.newPrerequisiteCourse = '';
            this.error = '';
        },

        // Prerequisites management
        async loadCoursePrerequisites(courseId) {
            if (!courseId) return;
            
            this.loadingPrerequisites = true;
            try {
                const prerequisites = await API.getPrerequisites({ course: courseId });
                this.coursePrerequisites = prerequisites || [];
            } catch (err) {
                console.error('Error loading prerequisites:', err);
                this.coursePrerequisites = [];
            } finally {
                this.loadingPrerequisites = false;
            }
        },

        async onCourseChange() {
            if (this.form.course) {
                await this.loadCoursePrerequisites(this.form.course);
                this.showPrerequisitesSection = true;
            } else {
                this.coursePrerequisites = [];
                this.showPrerequisitesSection = false;
            }
        },

        async addPrerequisite() {
            if (!this.form.course || !this.newPrerequisiteCourse) {
                this.error = 'لطفاً درس و پیش‌نیاز را انتخاب کنید';
                return;
            }

            if (this.form.course === this.newPrerequisiteCourse) {
                this.error = 'یک درس نمی‌تواند پیش‌نیاز خودش باشد';
                return;
            }

            // Check if prerequisite already exists
            const exists = this.coursePrerequisites.some(
                p => p.prerequisite_course === parseInt(this.newPrerequisiteCourse) || 
                     (typeof p.prerequisite_course === 'object' && p.prerequisite_course.id === parseInt(this.newPrerequisiteCourse))
            );
            
            if (exists) {
                this.error = 'این پیش‌نیاز قبلاً اضافه شده است';
                return;
            }

            try {
                const data = {
                    course: parseInt(this.form.course),
                    prerequisite_course: parseInt(this.newPrerequisiteCourse)
                };
                
                await API.addPrerequisite(data);
                this.success = 'پیش‌نیاز با موفقیت اضافه شد';
                await this.loadCoursePrerequisites(this.form.course);
                this.newPrerequisiteCourse = '';
            } catch (err) {
                this.error = err.message || 'خطا در اضافه کردن پیش‌نیاز';
            }
        },

        async removePrerequisite(prerequisiteId, prerequisiteCourseId) {
            if (!confirm('آیا از حذف این پیش‌نیاز اطمینان دارید؟')) {
                return;
            }

            try {
                const prereqId = typeof prerequisiteCourseId === 'object' 
                    ? prerequisiteCourseId.id 
                    : prerequisiteCourseId;
                
                const data = {
                    course: parseInt(this.form.course),
                    prerequisite_course: parseInt(prereqId)
                };
                
                await API.removePrerequisite(data);
                this.success = 'پیش‌نیاز با موفقیت حذف شد';
                await this.loadCoursePrerequisites(this.form.course);
            } catch (err) {
                this.error = err.message || 'خطا در حذف پیش‌نیاز';
            }
        },

        getPrerequisiteCourseName(prerequisite) {
            const prereqId = typeof prerequisite.prerequisite_course === 'object' 
                ? prerequisite.prerequisite_course.id 
                : parseInt(prerequisite.prerequisite_course);
            
            const course = this.courses.find(c => c.id === prereqId);
            return course ? `${course.code} - ${course.title}` : 'نامشخص';
        },

        getAvailablePrerequisiteCourses() {
            if (!this.form.course) return this.courses;
            
            const currentCourseId = parseInt(this.form.course);
            const existingPrereqIds = this.coursePrerequisites.map(p => {
                const prereqId = typeof p.prerequisite_course === 'object' 
                    ? p.prerequisite_course.id 
                    : parseInt(p.prerequisite_course);
                return prereqId;
            });
            
            return this.courses.filter(c => 
                c.id !== currentCourseId && !existingPrereqIds.includes(c.id)
            );
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
            // Handle both HH:MM:SS and HH:MM formats
            const time = timeString.length > 5 ? timeString.substring(0, 5) : timeString;
            return time;
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

        // Schedule management
        addSchedule() {
            this.form.schedules.push({
                day_of_week: 0,
                start_time: '',
                end_time: '',
                location: ''
            });
        },

        removeSchedule(index) {
            this.form.schedules.splice(index, 1);
        },

        // Exam management
        setExam() {
            if (!this.form.exam) {
                this.form.exam = {
                    exam_datetime: '',
                    location: ''
                };
            }
        },

        removeExam() {
            this.form.exam = null;
        },

        async submitForm() {
            this.error = '';
            this.success = '';

            if (!this.form.term || !this.form.course || !this.form.professor || 
                !this.form.section_number || !this.form.capacity) {
                this.error = 'لطفاً تمام فیلدهای الزامی را پر کنید';
                return;
            }

            // Validate schedules
            for (let i = 0; i < this.form.schedules.length; i++) {
                const schedule = this.form.schedules[i];
                if (!schedule.day_of_week || !schedule.start_time || !schedule.end_time) {
                    this.error = `لطفاً تمام فیلدهای برنامه کلاسی شماره ${i + 1} را پر کنید`;
                    return;
                }
                if (schedule.start_time >= schedule.end_time) {
                    this.error = `زمان شروع باید قبل از زمان پایان باشد (برنامه کلاسی شماره ${i + 1})`;
                    return;
                }
            }

            // Validate exam if provided
            if (this.form.exam && !this.form.exam.exam_datetime) {
                this.error = 'لطفاً تاریخ و زمان امتحان را وارد کنید';
                return;
            }

            try {
                const data = {
                    term: parseInt(this.form.term),
                    course: parseInt(this.form.course),
                    professor: parseInt(this.form.professor),
                    section_number: parseInt(this.form.section_number),
                    capacity: parseInt(this.form.capacity),
                    schedules: this.form.schedules.map(s => ({
                        day_of_week: parseInt(s.day_of_week),
                        start_time: s.start_time + (s.start_time.length === 5 ? ':00' : ''),
                        end_time: s.end_time + (s.end_time.length === 5 ? ':00' : ''),
                        location: s.location || ''
                    })),
                    exam: this.form.exam ? {
                        exam_datetime: new Date(this.form.exam.exam_datetime).toISOString(),
                        location: this.form.exam.location || ''
                    } : undefined
                };

                if (this.editingId) {
                    await API.updateSection(this.editingId, data);
                    this.success = 'ارائه با موفقیت ویرایش شد';
                } else {
                    await API.createSection(data);
                    this.success = 'ارائه با موفقیت اضافه شد';
                }
                
                await this.loadSections();
                setTimeout(() => {
                    this.closeModal();
                }, 1000);
            } catch (err) {
                this.error = err.message || 'خطا در ذخیره ارائه';
            }
        },

        async deleteSection(id, courseName) {
            if (!confirm(`آیا از حذف ارائه "${courseName}" اطمینان دارید؟`)) {
                return;
            }

            try {
                await API.deleteSection(id);
                this.success = 'ارائه با موفقیت حذف شد';
                await this.loadSections();
            } catch (err) {
                this.error = err.message || 'خطا در حذف ارائه';
            }
        }
    }
}

