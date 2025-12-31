// Classrooms management component
function classroomsManager() {
    return {
        classrooms: [],
        departments: [],
        loading: false,
        error: '',
        success: '',
        showModal: false,
        editingId: null,
        searchText: '',
        orderBy: 'number', // Default ordering field
        orderDirection: 'asc', // 'asc' or 'desc'
        form: {
            number: '',
            capacity: '',
            department: ''
        },

        async init() {
            await Promise.all([
                this.loadClassrooms(),
                this.loadDepartments()
            ]);
        },

        async loadClassrooms() {
            this.loading = true;
            this.error = '';
            try {
                const params = {};
                
                // Add search parameter
                if (this.searchText && this.searchText.trim()) {
                    params.search = this.searchText.trim();
                }
                
                // Add ordering parameter
                if (this.orderBy) {
                    const prefix = this.orderDirection === 'desc' ? '-' : '';
                    params.ordering = `${prefix}${this.orderBy}`;
                }
                
                this.classrooms = await API.getClassrooms(params);
            } catch (err) {
                this.error = err.message || 'خطا در بارگذاری کلاس‌ها';
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

        // Apply search filter
        applySearch() {
            this.loadClassrooms();
        },

        // Clear search
        clearSearch() {
            this.searchText = '';
            this.loadClassrooms();
        },

        // Change ordering
        changeOrdering(field) {
            if (this.orderBy === field) {
                // Toggle direction if same field
                this.orderDirection = this.orderDirection === 'asc' ? 'desc' : 'asc';
            } else {
                // New field, default to ascending
                this.orderBy = field;
                this.orderDirection = 'asc';
            }
            this.loadClassrooms();
        },

        // Get capacity color class
        getCapacityColor(capacity) {
            if (!capacity) return 'capacity-low';
            if (capacity < 30) return 'capacity-low';
            if (capacity < 60) return 'capacity-medium';
            return 'capacity-high';
        },

        // Get capacity label
        getCapacityLabel(capacity) {
            if (!capacity) return 'نامشخص';
            if (capacity < 30) return 'کم';
            if (capacity < 60) return 'متوسط';
            return 'زیاد';
        },

        // Get department name by ID
        getDepartmentNameById(id) {
            if (!id) return '-';
            const dept = this.departments.find(d => d.id === id);
            return dept ? `${dept.name} (${dept.code})` : '-';
        },

        openAddModal() {
            this.editingId = null;
            this.form = { number: '', capacity: '', department: '' };
            this.error = '';
            this.success = '';
            this.showModal = true;
        },

        openEditModal(classroom) {
            this.editingId = classroom.id;
            this.form = {
                number: classroom.number || '',
                capacity: classroom.capacity || '',
                department: classroom.department || ''
            };
            this.error = '';
            this.success = '';
            this.showModal = true;
        },

        closeModal() {
            this.showModal = false;
            this.editingId = null;
            this.form = { number: '', capacity: '', department: '' };
            this.error = '';
        },

        async submitForm() {
            this.error = '';
            this.success = '';

            if (!this.form.number || !this.form.capacity) {
                this.error = 'لطفاً شماره کلاس و ظرفیت را پر کنید';
                return;
            }

            const capacity = parseInt(this.form.capacity);
            if (isNaN(capacity) || capacity <= 0) {
                this.error = 'ظرفیت باید یک عدد مثبت باشد';
                return;
            }

            try {
                const data = {
                    number: this.form.number,
                    capacity: capacity,
                    department: this.form.department ? parseInt(this.form.department) : null
                };

                if (this.editingId) {
                    await API.updateClassroom(this.editingId, data);
                    this.success = 'کلاس با موفقیت ویرایش شد';
                } else {
                    await API.createClassroom(data);
                    this.success = 'کلاس با موفقیت اضافه شد';
                }
                
                await this.loadClassrooms();
                setTimeout(() => {
                    this.closeModal();
                }, 1000);
            } catch (err) {
                this.error = err.message || 'خطا در ذخیره کلاس';
            }
        },

        async deleteClassroom(id, number) {
            if (!confirm(`آیا از حذف کلاس "${number}" اطمینان دارید؟`)) {
                return;
            }

            try {
                await API.deleteClassroom(id);
                this.success = 'کلاس با موفقیت حذف شد';
                await this.loadClassrooms();
            } catch (err) {
                this.error = err.message || 'خطا در حذف کلاس';
            }
        }
    }
}

