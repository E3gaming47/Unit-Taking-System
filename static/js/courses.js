// Courses management component
function coursesManager() {
    return {
        courses: [],
        departments: [],
        loading: false,
        error: '',
        success: '',
        showModal: false,
        editingId: null,
        form: {
            code: '',
            title: '',
            units: 3,
            departments: []
        },

        async init() {
            await Promise.all([
                this.loadCourses(),
                this.loadDepartments()
            ]);
        },

        async loadCourses() {
            this.loading = true;
            this.error = '';
            try {
                this.courses = await API.getCourses();
            } catch (err) {
                this.error = err.message || 'خطا در بارگذاری دروس';
            } finally {
                this.loading = false;
            }
        },

        async loadDepartments() {
            try {
                this.departments = await API.getDepartments();
            } catch (err) {
                console.error('Error loading departments:', err);
            }
        },

        openAddModal() {
            this.editingId = null;
            this.form = { code: '', title: '', units: 3, departments: [] };
            this.error = '';
            this.success = '';
            this.showModal = true;
        },

        openEditModal(course) {
            this.editingId = course.id;
            // Handle departments - API returns array of IDs
            const deptIds = course.departments || [];
            this.form = {
                code: course.code,
                title: course.title,
                units: course.units,
                departments: deptIds.map(d => typeof d === 'object' ? d.id : d)
            };
            this.error = '';
            this.success = '';
            this.showModal = true;
        },

        closeModal() {
            this.showModal = false;
            this.editingId = null;
            this.form = { code: '', title: '', units: 3, departments: [] };
            this.error = '';
        },

        async submitForm() {
            this.error = '';
            this.success = '';

            if (!this.form.code || !this.form.title || !this.form.units) {
                this.error = 'لطفاً تمام فیلدهای الزامی را پر کنید';
                return;
            }

            if (this.form.units < 1 || this.form.units > 4) {
                this.error = 'تعداد واحد باید بین ۱ تا ۴ باشد';
                return;
            }

            try {
                const data = {
                    code: this.form.code,
                    title: this.form.title,
                    units: parseInt(this.form.units),
                    departments: this.form.departments.map(d => parseInt(d))
                };

                if (this.editingId) {
                    await API.updateCourse(this.editingId, data);
                    this.success = 'درس با موفقیت ویرایش شد';
                } else {
                    await API.createCourse(data);
                    this.success = 'درس با موفقیت اضافه شد';
                }
                
                await this.loadCourses();
                setTimeout(() => {
                    this.closeModal();
                }, 1000);
            } catch (err) {
                this.error = err.message || 'خطا در ذخیره درس';
            }
        },

        async deleteCourse(id, title) {
            if (!confirm(`آیا از حذف درس "${title}" اطمینان دارید؟`)) {
                return;
            }

            try {
                await API.deleteCourse(id);
                this.success = 'درس با موفقیت حذف شد';
                await this.loadCourses();
            } catch (err) {
                this.error = err.message || 'خطا در حذف درس';
            }
        },

        getDepartmentNames(course) {
            if (!course.departments || course.departments.length === 0) {
                return '-';
            }
            // Handle both ID arrays and object arrays
            return course.departments
                .map(d => {
                    const id = typeof d === 'object' ? d.id : d;
                    return this.getDepartmentNameById(id);
                })
                .filter(name => name) // Remove empty names
                .join(', ');
        },

        getDepartmentNameById(id) {
            const dept = this.departments.find(d => d.id === id);
            return dept ? dept.name : '';
        }
    }
}

