// Terms management component
function termsManager() {
    return {
        terms: [],
        loading: false,
        error: '',
        success: '',
        showModal: false,
        editingId: null,
        form: {
            name: '',
            start_date: '',
            end_date: '',
            registration_start: '',
            registration_end: '',
            min_units: 0,
            max_units: 20,
            status: 'planning'
        },

        async init() {
            await this.loadTerms();
        },

        async loadTerms() {
            this.loading = true;
            this.error = '';
            try {
                this.terms = await API.getTerms();
            } catch (err) {
                this.error = err.message || 'خطا در بارگذاری ترم‌ها';
            } finally {
                this.loading = false;
            }
        },

        openAddModal() {
            this.editingId = null;
            this.form = {
                name: '',
                start_date: '',
                end_date: '',
                registration_start: '',
                registration_end: '',
                min_units: 0,
                max_units: 20,
                status: 'planning'
            };
            this.error = '';
            this.success = '';
            this.showModal = true;
        },

        openEditModal(term) {
            this.editingId = term.id;
            this.form = {
                name: term.name,
                start_date: term.start_date,
                end_date: term.end_date,
                registration_start: term.registration_start,
                registration_end: term.registration_end,
                min_units: term.min_units || 0,
                max_units: term.max_units || 20,
                status: term.status || 'planning'
            };
            this.error = '';
            this.success = '';
            this.showModal = true;
        },

        closeModal() {
            this.showModal = false;
            this.editingId = null;
            this.form = {
                name: '',
                start_date: '',
                end_date: '',
                registration_start: '',
                registration_end: '',
                min_units: 0,
                max_units: 20,
                status: 'planning'
            };
            this.error = '';
        },

        async submitForm() {
            this.error = '';
            this.success = '';

            if (!this.form.name || !this.form.start_date || !this.form.end_date || 
                !this.form.registration_start || !this.form.registration_end ||
                this.form.min_units === '' || this.form.max_units === '') {
                this.error = 'لطفاً تمام فیلدهای الزامی را پر کنید';
                return;
            }

            if (parseInt(this.form.min_units) > parseInt(this.form.max_units)) {
                this.error = 'حداکثر واحد باید بیشتر یا مساوی حداقل واحد باشد';
                return;
            }

            try {
                const data = {
                    name: this.form.name,
                    start_date: this.form.start_date,
                    end_date: this.form.end_date,
                    registration_start: this.form.registration_start,
                    registration_end: this.form.registration_end,
                    min_units: parseInt(this.form.min_units) || 0,
                    max_units: parseInt(this.form.max_units) || 20
                };
                
                // Only include status when editing
                if (this.editingId && this.form.status) {
                    data.status = this.form.status;
                }

                if (this.editingId) {
                    await API.updateTerm(this.editingId, data);
                    this.success = 'ترم با موفقیت ویرایش شد';
                } else {
                    await API.createTerm(data);
                    this.success = 'ترم با موفقیت اضافه شد';
                }
                
                await this.loadTerms();
                setTimeout(() => {
                    this.closeModal();
                }, 1000);
            } catch (err) {
                this.error = err.message || 'خطا در ذخیره ترم';
            }
        },

        async deleteTerm(id, name) {
            if (!confirm(`آیا از حذف ترم "${name}" اطمینان دارید؟`)) {
                return;
            }

            try {
                await API.deleteTerm(id);
                this.success = 'ترم با موفقیت حذف شد';
                await this.loadTerms();
            } catch (err) {
                this.error = err.message || 'خطا در حذف ترم';
            }
        },

        async activateTerm(id) {
            this.error = '';
            this.success = '';
            try {
                await API.activateTerm(id);
                this.success = 'ترم با موفقیت فعال شد';
                this.error = '';
                await this.loadTerms();
                setTimeout(() => {
                    this.success = '';
                }, 3000);
            } catch (err) {
                this.error = err.message || 'خطا در فعال کردن ترم';
                this.success = '';
            }
        },

        async deactivateTerm(id) {
            this.error = '';
            this.success = '';
            try {
                await API.deactivateTerm(id);
                this.success = 'ترم با موفقیت غیرفعال شد';
                this.error = '';
                await this.loadTerms();
                setTimeout(() => {
                    this.success = '';
                }, 3000);
            } catch (err) {
                this.error = err.message || 'خطا در غیرفعال کردن ترم';
                this.success = '';
            }
        },

        formatDate(dateString) {
            if (!dateString) return '-';
            const date = new Date(dateString);
            return date.toLocaleDateString('fa-IR');
        },

        getStatusLabel(status) {
            const labels = {
                'planning': 'در حال برنامه‌ریزی',
                'ready': 'آماده',
                'active': 'فعال',
                'archived': 'بایگانی شده'
            };
            return labels[status] || status;
        },

        getStatusStyle(status) {
            const styles = {
                'planning': 'color: var(--gray-color);',
                'ready': 'color: var(--primary-color); font-weight: bold;',
                'active': 'color: var(--success); font-weight: bold;',
                'archived': 'color: var(--gray-color);'
            };
            return styles[status] || '';
        },

        async setStatusReady(id) {
            this.error = '';
            this.success = '';
            try {
                // Update term status to READY
                const term = this.terms.find(t => t.id === id);
                if (!term) {
                    this.error = 'ترم یافت نشد';
                    return;
                }
                
                const data = {
                    name: term.name,
                    start_date: term.start_date,
                    end_date: term.end_date,
                    registration_start: term.registration_start,
                    registration_end: term.registration_end,
                    min_units: term.min_units || 0,
                    max_units: term.max_units || 20,
                    status: 'ready'
                };
                
                await API.updateTerm(id, data);
                this.success = 'وضعیت ترم به "آماده" تغییر یافت. اکنون می‌توانید آن را فعال کنید.';
                await this.loadTerms();
                setTimeout(() => {
                    this.success = '';
                }, 3000);
            } catch (err) {
                this.error = err.message || 'خطا در تغییر وضعیت ترم';
                this.success = '';
            }
        }
    }
}

