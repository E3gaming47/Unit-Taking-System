// Professors management component
function professorsManager() {
    return {
        professors: [],
        departments: [],
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
            professor_id: '',
            department: ''
        },

        async init() {
            await Promise.all([
                this.loadProfessors(),
                this.loadDepartments()
            ]);
        },

        async loadDepartments() {
            try {
                const data = await API.getDepartments();
                // Handle paginated response
                this.departments = data.results || data;
                console.log('Loaded departments:', this.departments);
            } catch (err) {
                console.error('Error loading departments:', err);
                this.departments = [];
            }
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
                professor_id: '',
                department: ''
            };
            this.error = '';
            this.success = '';
            this.showModal = true;
        },

        openEditModal(professor) {
            this.editingId = professor.id;
            // Handle department - can be ID or object
            const departmentId = typeof professor.department === 'object' 
                ? professor.department.id 
                : professor.department;
            this.form = {
                username: professor.username,
                email: professor.email || '',
                password: '', // Don't pre-fill password
                first_name: professor.first_name || '',
                last_name: professor.last_name || '',
                professor_id: professor.professor_id || '',
                department: departmentId || ''
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
                professor_id: '',
                department: ''
            };
            this.error = '';
        },

        async submitForm() {
            this.error = '';
            this.success = '';

            if (!this.form.username || !this.form.professor_id || !this.form.department) {
                this.error = 'لطفاً نام کاربری، شماره استادی و دپارتمان را پر کنید';
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
                    last_name: this.form.last_name || '',
                    department: parseInt(this.form.department)
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
        },

        getDepartmentName(professor) {
            if (!professor.department) return '-';
            const deptId = typeof professor.department === 'object' 
                ? professor.department.id 
                : professor.department;
            const dept = this.departments.find(d => d.id === deptId);
            return dept ? `${dept.name} (${dept.code})` : '-';
        }
    }
}

