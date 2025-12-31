// Courses management component
function coursesManager() {
    return {
        courses: [],
        allCourses: [], // All courses for prerequisite dropdown (unfiltered)
        departments: [],
        loading: false,
        error: '',
        success: '',
        showModal: false,
        editingId: null,
        // Filter states
        searchText: '',
        selectedDepartment: '',
        selectedUnits: '',
        // Prerequisites management
        coursePrerequisites: [],
        newPrerequisiteCourse: '',
        loadingPrerequisites: false,
        availablePrerequisiteCourses: [],
        form: {
            code: '',
            title: '',
            units: 3,
            departments: []
        },

        async init() {
            // Load filtered courses for display
            await this.loadCourses();
            // Load departments
            await this.loadDepartments();
        },

        async loadCourses() {
            this.loading = true;
            this.error = '';
            try {
                const params = {};
                
                // Add search parameter
                if (this.searchText && this.searchText.trim()) {
                    params.search = this.searchText.trim();
                }
                
                // Add department filter
                if (this.selectedDepartment) {
                    params.department = this.selectedDepartment;
                }
                
                // Add units filter
                if (this.selectedUnits) {
                    params.units = this.selectedUnits;
                }
                
                const coursesData = await API.getCourses(params);
                // Ensure courses is always an array
                this.courses = Array.isArray(coursesData) ? coursesData : [];
                console.log('Loaded courses:', this.courses.length);
            } catch (err) {
                console.error('Error loading courses:', err);
                this.error = err.message || 'خطا در بارگذاری دروس';
                this.courses = [];
            } finally {
                this.loading = false;
            }
        },

        // Apply filters (called when filters change)
        applyFilters() {
            this.loadCourses();
        },

        // Clear all filters
        clearFilters() {
            this.searchText = '';
            this.selectedDepartment = '';
            this.selectedUnits = '';
            this.loadCourses();
        },

        async loadDepartments() {
            try {
                this.departments = await API.getDepartments();
            } catch (err) {
                console.error('Error loading departments:', err);
            }
        },

        async loadAllCoursesForPrerequisites() {
            try {
                // Load ALL courses without any filters for prerequisite dropdown
                let allCoursesList = [];
                let page = 1;
                let hasMore = true;
                
                while (hasMore) {
                    const queryParams = new URLSearchParams();
                    queryParams.append('page', page);
                    queryParams.append('page_size', '100'); // Max page size
                    
                    const url = `/api/courses/?${queryParams.toString()}`;
                    const response = await fetch(url, {
                        method: 'GET',
                        headers: API.getAuthHeaders()
                    });
                    
                    const data = await API.handleResponse(response);
                    
                    if (data.results && Array.isArray(data.results)) {
                        allCoursesList = allCoursesList.concat(data.results);
                        hasMore = !!data.next;
                        page++;
                    } else if (Array.isArray(data)) {
                        allCoursesList = allCoursesList.concat(data);
                        hasMore = false;
                    } else {
                        hasMore = false;
                    }
                    
                    if (page > 100) break; // Safety limit
                }
                
                this.allCourses = allCoursesList;
                console.log('Loaded courses for prerequisites:', this.allCourses.length);
                
                // Update available courses if we're currently editing a course
                if (this.editingId) {
                    this.updateAvailablePrerequisiteCourses();
                }
            } catch (err) {
                console.error('Error loading all courses:', err);
                this.allCourses = [];
                if (this.editingId) {
                    this.updateAvailablePrerequisiteCourses();
                }
            }
        },

        openAddModal() {
            this.editingId = null;
            this.form = { code: '', title: '', units: 3, departments: [] };
            this.coursePrerequisites = [];
            this.newPrerequisiteCourse = '';
            this.availablePrerequisiteCourses = [];
            this.error = '';
            this.success = '';
            this.showModal = true;
        },

        async openEditModal(course) {
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
            this.coursePrerequisites = [];
            this.newPrerequisiteCourse = '';
            this.availablePrerequisiteCourses = [];
            
            // Ensure all courses are loaded first
            if (!this.allCourses || this.allCourses.length === 0) {
                await this.loadAllCoursesForPrerequisites();
            }
            
            // Load prerequisites for this course
            await this.loadCoursePrerequisites(course.id);
            
            // Update available courses list
            this.updateAvailablePrerequisiteCourses();
            
            this.showModal = true;
        },

        closeModal() {
            this.showModal = false;
            this.editingId = null;
            this.form = { code: '', title: '', units: 3, departments: [] };
            this.coursePrerequisites = [];
            this.newPrerequisiteCourse = '';
            this.availablePrerequisiteCourses = [];
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
                    await this.loadCourses(); // This will maintain current filters
                    setTimeout(() => {
                        this.closeModal();
                    }, 1000);
                } else {
                    const newCourse = await API.createCourse(data);
                    this.editingId = newCourse.id;
                    this.success = 'درس با موفقیت اضافه شد. اکنون می‌توانید پیش‌نیازها را مدیریت کنید.';
                    this.coursePrerequisites = [];
                    // Reload courses list
                    await this.loadCourses();
                    // Reload all courses for prerequisites dropdown
                    await this.loadAllCoursesForPrerequisites();
                    await this.loadCoursePrerequisites(newCourse.id);
                    // Update available courses list
                    this.updateAvailablePrerequisiteCourses();
                    // Don't close modal for new courses, so user can manage prerequisites
                }
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
            // Use department_details if available (new backend feature)
            if (course.department_details && course.department_details.length > 0) {
                return course.department_details
                    .map(dept => `${dept.name} (${dept.code})`)
                    .join(', ');
            }
            
            // Fallback to old method if department_details not available
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
            return dept ? `${dept.name} (${dept.code})` : '';
        },

        // Prerequisites management
        async loadCoursePrerequisites(courseId) {
            if (!courseId) {
                this.coursePrerequisites = [];
                this.updateAvailablePrerequisiteCourses();
                return;
            }
            
            this.loadingPrerequisites = true;
            this.error = '';
            try {
                const prerequisites = await API.getPrerequisites({ course: courseId });
                this.coursePrerequisites = Array.isArray(prerequisites) ? [...prerequisites] : [];
            } catch (err) {
                console.error('Error loading prerequisites:', err);
                this.coursePrerequisites = [];
            } finally {
                this.loadingPrerequisites = false;
                // Update available courses after loading prerequisites
                this.updateAvailablePrerequisiteCourses();
            }
        },

        async addPrerequisite() {
            if (!this.editingId) {
                this.error = 'لطفاً ابتدا درس را ذخیره کنید، سپس پیش‌نیازها را اضافه کنید';
                return;
            }

            if (!this.newPrerequisiteCourse) {
                this.error = 'لطفاً پیش‌نیاز را انتخاب کنید';
                return;
            }

            const courseId = parseInt(this.editingId);
            const prereqId = parseInt(this.newPrerequisiteCourse);

            if (isNaN(courseId) || isNaN(prereqId) || courseId <= 0 || prereqId <= 0) {
                this.error = 'خطا: شناسه‌های وارد شده نامعتبر است.';
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
                // Reload prerequisites (this will also update available courses)
                await this.loadCoursePrerequisites(courseId);
                setTimeout(() => {
                    this.success = '';
                }, 3000);
            } catch (err) {
                console.error('Error adding prerequisite:', err);
                this.error = err.message || 'خطا در اضافه کردن پیش‌نیاز';
                this.success = '';
            }
        },

        async removePrerequisite(prerequisiteId, prerequisiteCourseId) {
            if (!confirm('آیا از حذف این پیش‌نیاز اطمینان دارید؟')) {
                return;
            }

            if (!this.editingId) {
                this.error = 'خطا: درس انتخاب نشده است.';
                return;
            }

            if (prerequisiteCourseId === null || prerequisiteCourseId === undefined || prerequisiteCourseId === '') {
                this.error = 'خطا: اطلاعات پیش‌نیاز نامعتبر است.';
                return;
            }

            try {
                const courseId = parseInt(this.editingId);
                const prereqCourseId = parseInt(prerequisiteCourseId);
                
                if (isNaN(courseId) || isNaN(prereqCourseId) || courseId <= 0 || prereqCourseId <= 0) {
                    this.error = 'خطا: شناسه‌های وارد شده نامعتبر است.';
                    return;
                }
                
                const data = {
                    course: courseId,
                    prerequisite_course: prereqCourseId
                };
                
                await API.removePrerequisite(data);
                this.success = 'پیش‌نیاز با موفقیت حذف شد';
                this.error = '';
                // Reload prerequisites (this will also update available courses)
                await this.loadCoursePrerequisites(courseId);
                setTimeout(() => {
                    this.success = '';
                }, 3000);
            } catch (err) {
                console.error('Error removing prerequisite:', err);
                this.error = err.message || 'خطا در حذف پیش‌نیاز';
                this.success = '';
            }
        },

        getPrerequisiteCourseName(prerequisite) {
            const prereqId = parseInt(prerequisite.prerequisite_course);
            const allCourses = this.allCourses || this.courses || [];
            const course = allCourses.find(c => c.id === prereqId);
            return course ? `${course.code} - ${course.title}` : `درس #${prereqId}`;
        },

        updateAvailablePrerequisiteCourses() {
            // Use allCourses if available, otherwise fallback to courses
            const sourceCourses = (this.allCourses && this.allCourses.length > 0) 
                ? this.allCourses 
                : (this.courses || []);
            
            // If no courses available, set empty array
            if (sourceCourses.length === 0) {
                this.availablePrerequisiteCourses = [];
                return;
            }
            
            // If no editingId (adding new course), show all courses
            if (!this.editingId) {
                this.availablePrerequisiteCourses = sourceCourses;
                return;
            }
            
            const currentCourseId = parseInt(this.editingId);
            if (isNaN(currentCourseId)) {
                this.availablePrerequisiteCourses = sourceCourses;
                return;
            }
            
            // Get IDs of already-added prerequisites
            const existingPrereqIds = (this.coursePrerequisites || [])
                .map(p => {
                    // Handle both object and ID format
                    const prereqId = p.prerequisite_course || p.id;
                    return parseInt(prereqId);
                })
                .filter(id => !isNaN(id) && id > 0);
            
            // Filter: exclude current course and already-added prerequisites
            this.availablePrerequisiteCourses = sourceCourses.filter(c => {
                const courseId = parseInt(c.id);
                return !isNaN(courseId) 
                    && courseId > 0
                    && courseId !== currentCourseId 
                    && !existingPrereqIds.includes(courseId);
            });
        }
    }
}

