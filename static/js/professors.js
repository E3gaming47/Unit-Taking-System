// Professors management component
function professorsManager() {
    return {
        professors: [],
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
            professor_id: ''
        },

        async init() {
            await this.loadProfessors();
        },

        async loadProfessors() {
            this.loading = true;
            this.error = '';
            try {
                const params = { role: 'professor' };
                
                // Add search parameter
                if (this.searchText && this.searchText.trim()) {
                    params.search = this.searchText.trim();
                }
                
                this.professors = await API.getUsers(params);
            } catch (err) {
                this.error = err.message || 'خطا در بارگذاری اساتید';
            } finally {
                this.loading = false;
            }
        },

        // Apply search filter
        applySearch() {
            this.loadProfessors();
        },

        // Clear search
        clearSearch() {
            this.searchText = '';
            this.loadProfessors();
        },

        openAddModal() {
            this.editingId = null;
            this.form = {
                username: '',
                email: '',
                password: '',
                first_name: '',
                last_name: '',
                professor_id: ''
            };
            this.error = '';
            this.success = '';
            this.showModal = true;
        },

        openEditModal(professor) {
            this.editingId = professor.id;
            this.form = {
                username: professor.username,
                email: professor.email || '',
                password: '', // Don't pre-fill password
                first_name: professor.first_name || '',
                last_name: professor.last_name || '',
                professor_id: professor.professor_id || ''
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
                professor_id: ''
            };
            this.error = '';
        },

        async submitForm() {
            this.error = '';
            this.success = '';

            if (!this.form.username || !this.form.professor_id) {
                this.error = 'لطفاً نام کاربری و شماره استادی را پر کنید';
                return;
            }

            // For new professors, password is required
            if (!this.editingId && !this.form.password) {
                this.error = 'رمز عبور الزامی است';
                return;
            }

            try {
                const data = {
                    username: this.form.username,
                    email: this.form.email || '',
                    role: 'professor',
                    professor_id: this.form.professor_id,
                    first_name: this.form.first_name || '',
                    last_name: this.form.last_name || ''
                };

                // Only include password if provided (for new users or password updates)
                if (this.form.password) {
                    data.password = this.form.password;
                }

                if (this.editingId) {
                    await API.updateUser(this.editingId, data);
                    this.success = 'استاد با موفقیت ویرایش شد';
                } else {
                    await API.createUser(data);
                    this.success = 'استاد با موفقیت اضافه شد';
                }
                
                await this.loadProfessors();
                setTimeout(() => {
                    this.closeModal();
                }, 1000);
            } catch (err) {
                this.error = err.message || 'خطا در ذخیره استاد';
            }
        },

        async deleteProfessor(id, username) {
            if (!confirm(`آیا از حذف استاد "${username}" اطمینان دارید؟`)) {
                return;
            }

            try {
                await API.deleteUser(id);
                this.success = 'استاد با موفقیت حذف شد';
                await this.loadProfessors();
            } catch (err) {
                this.error = err.message || 'خطا در حذف استاد';
            }
        }
    }
}

