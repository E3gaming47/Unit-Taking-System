// Terms management component
function termsManager() {
    return {
        terms: [],
        loading: false,
        error: '',
        success: '',
        showModal: false,
        editingId: null,
        orderBy: 'start_date', // Default ordering field
        orderDirection: 'desc', // Default direction
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
                const params = {};
                
                // Add ordering parameter
                if (this.orderBy) {
                    const prefix = this.orderDirection === 'desc' ? '-' : '';
                    params.ordering = `${prefix}${this.orderBy}`;
                }
                
                const termsData = await API.getTerms(params);
                console.log('Raw terms data from API:', termsData);
                
                // Create completely new array with normalized data
                const mappedTerms = termsData.map(term => {
                    const status = (term.status || 'planning').toLowerCase();
                    const isActive = term.is_active === true || term.is_active === 'true' || term.is_active === 1 || term.is_active === '1';
                    
                    return {
                        id: term.id,
                        name: term.name,
                        start_date: term.start_date,
                        end_date: term.end_date,
                        registration_start: term.registration_start,
                        registration_end: term.registration_end,
                        min_units: term.min_units,
                        max_units: term.max_units,
                        status: status,
                        is_active: isActive,
                        statusLabel: this.getStatusLabel(status),
                        statusStyle: this.getStatusStyle(status)
                    };
                });
                
                // Force complete replacement
                this.terms = mappedTerms;
                
                console.log('Terms loaded:', this.terms.length);
                console.log('Sample term:', this.terms[0]);
            } catch (err) {
                console.error('Error loading terms:', err);
                this.error = err.message || 'خطا در بارگذاری ترم‌ها';
            } finally {
                this.loading = false;
            }
        },

        // Change ordering
        changeOrdering(field) {
            if (this.orderBy === field) {
                // Toggle direction if same field
                this.orderDirection = this.orderDirection === 'asc' ? 'desc' : 'asc';
            } else {
                // New field, default to descending for dates, ascending for status
                this.orderBy = field;
                this.orderDirection = field === 'start_date' ? 'desc' : 'asc';
            }
            this.loadTerms();
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
                console.log('Activating term:', id);
                await API.activateTerm(id);
                console.log('Activate successful, reloading terms...');
                
                // Force reload with a small delay to ensure backend has updated
                await new Promise(resolve => setTimeout(resolve, 100));
                await this.loadTerms();
                
                this.success = 'ترم با موفقیت فعال شد';
                this.error = '';
                setTimeout(() => {
                    this.success = '';
                }, 3000);
            } catch (err) {
                console.error('Activate error:', err);
                this.error = err.message || 'خطا در فعال کردن ترم';
                this.success = '';
            }
        },

        async deactivateTerm(id) {
            this.error = '';
            this.success = '';
            try {
                console.log('Deactivating term:', id);
                await API.deactivateTerm(id);
                console.log('Deactivate successful, reloading terms...');
                
                // Force reload with a small delay to ensure backend has updated
                await new Promise(resolve => setTimeout(resolve, 100));
                await this.loadTerms();
                
                this.success = 'ترم با موفقیت غیرفعال شد';
                this.error = '';
                setTimeout(() => {
                    this.success = '';
                }, 3000);
            } catch (err) {
                console.error('Deactivate error:', err);
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
            // Handle null/undefined status - default to planning
            if (!status) {
                return 'در حال برنامه‌ریزی';
            }
            
            const statusLower = String(status).toLowerCase();
            const statusMap = {
                'planning': 'در حال برنامه‌ریزی',
                'ready': 'آماده',
                'active': 'فعال',
                'archived': 'بایگانی شده'
            };
            
            return statusMap[statusLower] || 'در حال برنامه‌ریزی';
        },

        getStatusStyle(status) {
            if (!status) {
                return 'color: var(--gray-color);';
            }
            
            const statusLower = String(status).toLowerCase();
            const styleMap = {
                'planning': 'color: var(--gray-color);',
                'ready': 'color: var(--info);',
                'active': 'color: var(--success); font-weight: bold;',
                'archived': 'color: var(--gray-color);'
            };
            
            return styleMap[statusLower] || 'color: var(--gray-color);';
        },

        async setStatusReady(id) {
            this.error = '';
            this.success = '';
            try {
                // Update term status to ready
                const term = this.terms.find(t => t.id === id);
                if (term) {
                    await API.updateTerm(id, {
                        ...term,
                        status: 'ready'
                    });
                    this.success = 'وضعیت ترم به READY تغییر یافت';
                    await this.loadTerms();
                    setTimeout(() => {
                        this.success = '';
                    }, 3000);
                }
            } catch (err) {
                this.error = err.message || 'خطا در تغییر وضعیت ترم';
                this.success = '';
            }
        }
    };
}
