// Departments management component
function departmentsManager() {
    return {
        departments: [],
        loading: false,
        error: '',
        success: '',
        showModal: false,
        editingId: null,
        form: {
            name: '',
            code: ''
        },

        async init() {
            await this.loadDepartments();
        },

        async loadDepartments() {
            this.loading = true;
            this.error = '';
            try {
                this.departments = await API.getDepartments();
            } catch (err) {
                this.error = err.message || 'خطا در بارگذاری دپارتمان‌ها';
            } finally {
                this.loading = false;
            }
        },

        openAddModal() {
            this.editingId = null;
            this.form = { name: '', code: '' };
            this.error = '';
            this.success = '';
            this.showModal = true;
        },

        openEditModal(department) {
            this.editingId = department.id;
            this.form = {
                name: department.name,
                code: department.code
            };
            this.error = '';
            this.success = '';
            this.showModal = true;
        },

        closeModal() {
            this.showModal = false;
            this.editingId = null;
            this.form = { name: '', code: '' };
            this.error = '';
        },

        async submitForm() {
            this.error = '';
            this.success = '';

            if (!this.form.name || !this.form.code) {
                this.error = 'لطفاً تمام فیلدها را پر کنید';
                return;
            }

            try {
                if (this.editingId) {
                    await API.updateDepartment(this.editingId, this.form);
                    this.success = 'دپارتمان با موفقیت ویرایش شد';
                } else {
                    await API.createDepartment(this.form);
                    this.success = 'دپارتمان با موفقیت اضافه شد';
                }
                
                await this.loadDepartments();
                setTimeout(() => {
                    this.closeModal();
                }, 1000);
            } catch (err) {
                this.error = err.message || 'خطا در ذخیره دپارتمان';
            }
        },

        async deleteDepartment(id, name) {
            if (!confirm(`آیا از حذف دپارتمان "${name}" اطمینان دارید؟`)) {
                return;
            }

            try {
                await API.deleteDepartment(id);
                this.success = 'دپارتمان با موفقیت حذف شد';
                await this.loadDepartments();
            } catch (err) {
                this.error = err.message || 'خطا در حذف دپارتمان';
            }
        }
    }
}

