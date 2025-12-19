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
            capacity: 1
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
                capacity: 1
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
                
                this.form = {
                    term: termId,
                    course: courseId,
                    professor: professorId,
                    section_number: section.section_number || 1,
                    capacity: section.capacity || 1
                };
                
                // Load prerequisites for this course
                if (courseId) {
                    this.showPrerequisitesSection = true;
                    this.newPrerequisiteCourse = '';
                    await this.loadCoursePrerequisites(parseInt(courseId));
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
                capacity: 1
            };
            this.coursePrerequisites = [];
            this.showPrerequisitesSection = false;
            this.newPrerequisiteCourse = '';
            this.error = '';
        },

        // Prerequisites management
        async loadCoursePrerequisites(courseId) {
            if (!courseId) {
                // Force reactivity by creating new array
                this.coursePrerequisites = [];
                return;
            }
            
            this.loadingPrerequisites = true;
            this.error = '';
            try {
                const prerequisites = await API.getPrerequisites({ course: courseId });
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
            if (this.form.course) {
                // Always show prerequisites section when course is selected
                // Prerequisites are course-level, so they apply to all sections of that course
                this.showPrerequisitesSection = true;
                this.newPrerequisiteCourse = '';
                // Clear first to ensure reactivity
                this.coursePrerequisites = [];
                await this.loadCoursePrerequisites(parseInt(this.form.course));
            } else {
                // Force reactivity by creating new array
                this.coursePrerequisites = [];
                this.showPrerequisitesSection = false;
                this.newPrerequisiteCourse = '';
            }
        },

        async addPrerequisite() {
            if (!this.form.course || !this.newPrerequisiteCourse) {
                this.error = 'لطفاً درس و پیش‌نیاز را انتخاب کنید';
                return;
            }

            const courseId = parseInt(this.form.course);
            const prereqId = parseInt(this.newPrerequisiteCourse);

            if (courseId === prereqId) {
                this.error = 'یک درس نمی‌تواند پیش‌نیاز خودش باشد';
                return;
            }

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
                    course: courseId,
                    prerequisite_course: prereqId
                };
                
                await API.addPrerequisite(data);
                this.success = 'پیش‌نیاز با موفقیت اضافه شد';
                this.error = '';
                this.newPrerequisiteCourse = '';
                await this.loadCoursePrerequisites(courseId);
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

            if (!this.form.course) {
                this.error = 'خطا: درس انتخاب نشده است';
                return;
            }

            // Validate inputs
            if (prerequisiteCourseId === null || prerequisiteCourseId === undefined || prerequisiteCourseId === '') {
                this.error = 'خطا: اطلاعات پیش‌نیاز نامعتبر است';
                console.error('Invalid prerequisiteCourseId:', prerequisiteCourseId);
                return;
            }

            try {
                const courseId = parseInt(this.form.course);
                const prereqCourseId = parseInt(prerequisiteCourseId);
                
                // Validate parsed values
                if (isNaN(courseId) || isNaN(prereqCourseId) || courseId <= 0 || prereqCourseId <= 0) {
                    this.error = 'خطا: شناسه‌های نامعتبر';
                    console.error('Invalid IDs - courseId:', courseId, 'prereqCourseId:', prereqCourseId);
                    return;
                }
                
                const data = {
                    course: courseId,
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
                await this.loadCoursePrerequisites(courseId);
                
                // Clear success message after 3 seconds
                setTimeout(() => {
                    this.success = '';
                }, 3000);
            } catch (err) {
                console.error('Error removing prerequisite:', err);
                console.error('Error details:', {
                    message: err.message,
                    stack: err.stack,
                    formCourse: this.form.course,
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

        async submitForm() {
            this.error = '';
            this.success = '';

            if (!this.form.term || !this.form.course || !this.form.professor || 
                !this.form.section_number || !this.form.capacity) {
                this.error = 'لطفاً تمام فیلدهای الزامی را پر کنید';
                return;
            }

            try {
                const data = {
                    term: parseInt(this.form.term),
                    course: parseInt(this.form.course),
                    professor: parseInt(this.form.professor),
                    section_number: parseInt(this.form.section_number),
                    capacity: parseInt(this.form.capacity)
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

