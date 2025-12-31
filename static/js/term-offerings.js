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
            this.error = '';
            this.success = '';
            this.showModal = true;
        },

        async openEditModal(section) {
            this.editingId = section.id;
            try {
                // SectionDetailSerializer returns term, course, professor as strings
                // We need to find the IDs by matching with our dropdowns
                const termId = this.terms.find(t => t.name === section.term)?.id || '';
                const courseId = this.courses.find(c => `${c.code} - ${c.title}` === section.course)?.id || '';
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
                capacity: 1
            };
            this.error = '';
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

