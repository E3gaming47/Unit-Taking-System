// Students management component
function studentsManager() {
    return {
        students: [],
        loading: false,
        error: '',
        success: '',
        showModal: false,
        editingId: null,
        searchText: '',
        form: {
            username: '',
            email: '',
            password: '',
            first_name: '',
            last_name: '',
            student_id: ''
        },

        async init() {
            await this.loadStudents();
        },

        async loadStudents() {
            this.loading = true;
            this.error = '';
            try {
                const params = { role: 'student' };
                
                // Add search parameter
                if (this.searchText && this.searchText.trim()) {
                    params.search = this.searchText.trim();
                }
                
                this.students = await API.getUsers(params);
            } catch (err) {
                this.error = err.message || 'خطا در بارگذاری دانشجویان';
            } finally {
                this.loading = false;
            }
        },

        // Apply search filter
        applySearch() {
            this.loadStudents();
        },

        // Clear search
        clearSearch() {
            this.searchText = '';
            this.loadStudents();
        },

        openAddModal() {
            this.editingId = null;
            this.form = {
                username: '',
                email: '',
                password: '',
                first_name: '',
                last_name: '',
                student_id: ''
            };
            this.error = '';
            this.success = '';
            this.showModal = true;
        },

        openEditModal(student) {
            this.editingId = student.id;
            this.form = {
                username: student.username,
                email: student.email || '',
                password: '', // Don't pre-fill password
                first_name: student.first_name || '',
                last_name: student.last_name || '',
                student_id: student.student_id || ''
            };
            this.error = '';
            this.success = '';
            this.showModal = true;
        },

        closeModal() {
            this.showModal = false;
            this.editingId = null;
            this.form = {
                username: '',
                email: '',
                password: '',
                first_name: '',
                last_name: '',
                student_id: ''
            };
            this.error = '';
        },

        async submitForm() {
            this.error = '';
            this.success = '';

            if (!this.form.username || !this.form.student_id) {
                this.error = 'لطفاً نام کاربری و شماره دانشجویی را پر کنید';
                return;
            }

            // For new students, password is required
            if (!this.editingId && !this.form.password) {
                this.error = 'رمز عبور الزامی است';
                return;
            }

            try {
                const data = {
                    username: this.form.username,
                    email: this.form.email || '',
                    role: 'student',
                    student_id: this.form.student_id,
                    first_name: this.form.first_name || '',
                    last_name: this.form.last_name || ''
                };

                // Only include password if provided (for new users or password updates)
                if (this.form.password) {
                    data.password = this.form.password;
                }

                if (this.editingId) {
                    await API.updateUser(this.editingId, data);
                    this.success = 'دانشجو با موفقیت ویرایش شد';
                } else {
                    await API.createUser(data);
                    this.success = 'دانشجو با موفقیت اضافه شد';
                }
                
                await this.loadStudents();
                setTimeout(() => {
                    this.closeModal();
                }, 1000);
            } catch (err) {
                this.error = err.message || 'خطا در ذخیره دانشجو';
            }
        },

        async deleteStudent(id, username) {
            if (!confirm(`آیا از حذف دانشجو "${username}" اطمینان دارید؟`)) {
                return;
            }

            try {
                await API.deleteUser(id);
                this.success = 'دانشجو با موفقیت حذف شد';
                await this.loadStudents();
            } catch (err) {
                this.error = err.message || 'خطا در حذف دانشجو';
            }
        }
    }
}

