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
            // Clear prerequisites when adding new section
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
                // SectionDetailSerializer returns term, course, professor as strings
                // But also includes course_id field
                const termId = this.terms.find(t => t.name === section.term)?.id || '';
                // Use course_id if available, otherwise try to match by string
                const courseId = section.course_id || this.courses.find(c => `${c.code} - ${c.title}` === section.course)?.id || '';
                const professorId = this.professors.find(p => {
                    const profName = p.username + (p.first_name ? ` (${p.first_name} ${p.last_name || ''})` : '');
                    return profName === section.professor || p.username === section.professor;
                })?.id || '';
                
                // Load schedules and exam from section data
                const schedules = section.schedules || [];
                const exam = section.exam || null;
                
                // Convert exam datetime to datetime-local format
                let examDatetime = null;
                if (exam && exam.exam_datetime) {
                    try {
                        // Convert ISO datetime to datetime-local format (YYYY-MM-DDTHH:mm)
                        const date = new Date(exam.exam_datetime);
                        if (!isNaN(date.getTime())) {
                            const year = date.getFullYear();
                            const month = String(date.getMonth() + 1).padStart(2, '0');
                            const day = String(date.getDate()).padStart(2, '0');
                            const hours = String(date.getHours()).padStart(2, '0');
                            const minutes = String(date.getMinutes()).padStart(2, '0');
                            examDatetime = `${year}-${month}-${day}T${hours}:${minutes}`;
                        }
                    } catch (err) {
                        console.error('Error converting exam datetime:', err);
                    }
                }
                
                this.form = {
                    term: termId,
                    course: courseId,
                    professor: professorId,
                    section_number: section.section_number || 1,
                    capacity: section.capacity || 1,
                    schedules: (schedules || []).map(s => ({
                        day_of_week: s.day_of_week || 0,
                        start_time: s.start_time || '',
                        end_time: s.end_time || '',
                        location: s.location || ''
                    })),
                    exam: exam ? {
                        exam_datetime: examDatetime,
                        location: exam.location || ''
                    } : null
                };
                
                // Load prerequisites for this section (prerequisites are now section-specific)
                if (this.editingId) {
                    this.showPrerequisitesSection = true;
                    this.newPrerequisiteCourse = '';
                    await this.loadSectionPrerequisites(this.editingId);
                } else {
                    this.coursePrerequisites = [];
                    this.showPrerequisitesSection = false;
                }
            } catch (err) {
                console.error('Error opening edit modal:', err);
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

        // Prerequisites management - now section-specific
        async loadSectionPrerequisites(sectionId) {
            if (!sectionId) {
                // Force reactivity by creating new array
                this.coursePrerequisites = [];
                return;
            }
            
            this.loadingPrerequisites = true;
            this.error = '';
            try {
                const prerequisites = await API.getPrerequisites({ section: sectionId });
                // Force reactivity by creating new array reference
                this.coursePrerequisites = Array.isArray(prerequisites) ? [...prerequisites] : [];
            } catch (err) {
                console.error('Error loading prerequisites:', err);
                // Force reactivity by creating new array
                this.coursePrerequisites = [];
                // Don't show error for loading prerequisites, just log it
            } finally {
                this.loadingPrerequisites = false;
            }
        },

        async onCourseChange() {
            // Prerequisites are now section-specific, so we only show them when editing an existing section
            if (this.editingId) {
                // Reload prerequisites for this section
                this.showPrerequisitesSection = true;
                this.newPrerequisiteCourse = '';
                this.coursePrerequisites = [];
                await this.loadSectionPrerequisites(this.editingId);
            } else {
                // When adding new section, prerequisites can only be managed after section is created
                this.coursePrerequisites = [];
                this.showPrerequisitesSection = false;
                this.newPrerequisiteCourse = '';
            }
        },

        async addPrerequisite() {
            if (!this.editingId) {
                this.error = 'لطفاً ابتدا بخش را ذخیره کنید، سپس پیش‌نیازها را اضافه کنید';
                return;
            }

            if (!this.newPrerequisiteCourse) {
                this.error = 'لطفاً پیش‌نیاز را انتخاب کنید';
                return;
            }

            const sectionId = parseInt(this.editingId);
            const prereqId = parseInt(this.newPrerequisiteCourse);

            // Check if prerequisite already exists
            const exists = this.coursePrerequisites.some(p => {
                const existingPrereqId = parseInt(p.prerequisite_course);
                return existingPrereqId === prereqId;
            });
            
            if (exists) {
                this.error = 'این پیش‌نیاز قبلاً اضافه شده است';
                return;
            }

            try {
                const data = {
                    section: sectionId,
                    prerequisite_course: prereqId
                };
                
                await API.addPrerequisite(data);
                this.success = 'پیش‌نیاز با موفقیت اضافه شد';
                this.error = '';
                this.newPrerequisiteCourse = '';
                await this.loadSectionPrerequisites(sectionId);
                // Clear success message after 3 seconds
                setTimeout(() => {
                    this.success = '';
                }, 3000);
            } catch (err) {
                this.error = err.message || 'خطا در اضافه کردن پیش‌نیاز';
                this.success = '';
            }
        },

        async removePrerequisite(prerequisiteId, prerequisiteCourseId) {
            if (!confirm('آیا از حذف این پیش‌نیاز اطمینان دارید؟')) {
                return;
            }

            if (!this.editingId) {
                this.error = 'خطا: بخش انتخاب نشده است';
                return;
            }

            // Validate inputs
            if (prerequisiteCourseId === null || prerequisiteCourseId === undefined || prerequisiteCourseId === '') {
                this.error = 'خطا: اطلاعات پیش‌نیاز نامعتبر است';
                console.error('Invalid prerequisiteCourseId:', prerequisiteCourseId);
                return;
            }

            try {
                const sectionId = parseInt(this.editingId);
                const prereqCourseId = parseInt(prerequisiteCourseId);
                
                // Validate parsed values
                if (isNaN(sectionId) || isNaN(prereqCourseId) || sectionId <= 0 || prereqCourseId <= 0) {
                    this.error = 'خطا: شناسه‌های نامعتبر';
                    console.error('Invalid IDs - sectionId:', sectionId, 'prereqCourseId:', prereqCourseId);
                    return;
                }
                
                const data = {
                    section: sectionId,
                    prerequisite_course: prereqCourseId
                };
                
                console.log('Removing prerequisite with data:', data);
                
                const result = await API.removePrerequisite(data);
                console.log('Remove prerequisite result:', result);
                
                this.success = 'پیش‌نیاز با موفقیت حذف شد';
                this.error = '';
                
                // Force clear the array first to ensure reactivity
                this.coursePrerequisites = [];
                
                // Reload prerequisites to update the list
                await this.loadSectionPrerequisites(sectionId);
                
                // Clear success message after 3 seconds
                setTimeout(() => {
                    this.success = '';
                }, 3000);
            } catch (err) {
                console.error('Error removing prerequisite:', err);
                console.error('Error details:', {
                    message: err.message,
                    stack: err.stack,
                    editingId: this.editingId,
                    prerequisiteCourseId: prerequisiteCourseId
                });
                this.error = err.message || 'خطا در حذف پیش‌نیاز. لطفاً دوباره تلاش کنید.';
                this.success = '';
            }
        },

        getPrerequisiteCourseName(prerequisite) {
            const prereqId = parseInt(prerequisite.prerequisite_course);
            const course = this.courses.find(c => c.id === prereqId);
            return course ? `${course.code} - ${course.title}` : `درس #${prereqId}`;
        },

        getAvailablePrerequisiteCourses() {
            if (!this.form.course) return this.courses;
            
            const currentCourseId = parseInt(this.form.course);
            const existingPrereqIds = this.coursePrerequisites.map(p => 
                parseInt(p.prerequisite_course)
            );
            
            return this.courses.filter(c => 
                c.id !== currentCourseId && !existingPrereqIds.includes(c.id)
            );
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

        getDayName(dayOfWeek) {
            const days = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
            return days[dayOfWeek] || 'نامشخص';
        },

        formatTime(time) {
            if (!time) return '';
            try {
                // Handle both "HH:MM:SS" and "HH:MM" formats
                const parts = String(time).split(':');
                if (parts.length < 2) return String(time);
                return `${parts[0]}:${parts[1]}`;
            } catch (err) {
                console.error('Error formatting time:', err);
                return String(time);
            }
        },

        getScheduleText(schedule) {
            if (!schedule) return 'نامشخص';
            try {
                const day = this.getDayName(schedule.day_of_week);
                const start = this.formatTime(schedule.start_time);
                const end = this.formatTime(schedule.end_time);
                const location = schedule.location ? ` - ${schedule.location}` : '';
                return `${day} ${start}-${end}${location}`;
            } catch (err) {
                console.error('Error formatting schedule:', err);
                return 'خطا در نمایش';
            }
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

        formatDateTime(datetime) {
            if (!datetime) return '';
            try {
                // Handle ISO datetime string
                const date = new Date(datetime);
                if (isNaN(date.getTime())) {
                    // Invalid date
                    return String(datetime);
                }
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                return `${year}-${month}-${day} ${hours}:${minutes}`;
            } catch (err) {
                console.error('Error formatting datetime:', err);
                return String(datetime);
            }
        },

        getExamText(exam) {
            if (!exam) return 'تعریف نشده';
            try {
                const datetime = this.formatDateTime(exam.exam_datetime);
                const location = exam.location ? ` - ${exam.location}` : '';
                return `${datetime}${location}`;
            } catch (err) {
                console.error('Error formatting exam:', err);
                return 'خطا در نمایش';
            }
        },

        async submitForm() {
            this.error = '';
            this.success = '';

            if (!this.form.term || !this.form.course || !this.form.professor || 
                !this.form.section_number || !this.form.capacity) {
                this.error = 'لطفاً تمام فیلدهای الزامی را پر کنید';
                return;
            }

            try {
                // Prepare schedules - ensure array exists
                const schedules = (this.form.schedules || []).map(s => ({
                    day_of_week: parseInt(s.day_of_week) || 0,
                    start_time: s.start_time || '',
                    end_time: s.end_time || '',
                    location: s.location || ''
                }));

                // Prepare exam - convert datetime-local to ISO format
                let exam = null;
                if (this.form.exam && this.form.exam.exam_datetime) {
                    try {
                        // Convert datetime-local format to ISO string
                        const datetimeStr = String(this.form.exam.exam_datetime);
                        // datetime-local format is "YYYY-MM-DDTHH:mm", need to add seconds
                        const isoDatetime = datetimeStr.includes('T') 
                            ? `${datetimeStr}:00` 
                            : datetimeStr;
                        exam = {
                            exam_datetime: isoDatetime,
                            location: this.form.exam.location || ''
                        };
                    } catch (err) {
                        console.error('Error preparing exam data:', err);
                        exam = null;
                    }
                }

                const data = {
                    term: parseInt(this.form.term),
                    course: parseInt(this.form.course),
                    professor: parseInt(this.form.professor),
                    section_number: parseInt(this.form.section_number),
                    capacity: parseInt(this.form.capacity),
                    schedules: schedules,
                    exam: exam
                };

                let sectionId = this.editingId;
                let isNewSection = false;
                
                if (this.editingId) {
                    await API.updateSection(this.editingId, data);
                    this.success = 'ارائه با موفقیت ویرایش شد';
                    // Reload prerequisites after update
                    await this.loadSectionPrerequisites(this.editingId);
                } else {
                    const newSection = await API.createSection(data);
                    sectionId = newSection.id;
                    this.editingId = sectionId; // Set editingId so prerequisites can be managed
                    isNewSection = true;
                    this.success = 'ارائه با موفقیت اضافه شد. اکنون می‌توانید پیش‌نیازها را مدیریت کنید.';
                    // Load prerequisites for the newly created section
                    this.showPrerequisitesSection = true;
                    await this.loadSectionPrerequisites(sectionId);
                }
                
                await this.loadSections();
                
                // Only close modal if editing existing section (not when adding new, so user can manage prerequisites)
                if (!isNewSection) {
                    setTimeout(() => {
                        this.closeModal();
                    }, 1000);
                }
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

