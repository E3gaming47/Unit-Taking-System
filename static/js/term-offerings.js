// Term Offerings (Sections) management component
function termOfferingsManager() {
    return {
        sections: [],
        terms: [],
        courses: [],
        departments: [],
        professors: [],
        classrooms: [],
        timeSlots: [],
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
            capacity: 1,
            schedules: [],
            exam: null
        },

        async init() {
            await Promise.all([
                this.loadSections(),
                this.loadTerms(),
                this.loadCourses(),
                this.loadDepartments(),
                this.loadProfessors(),
                this.loadClassrooms(),
                this.loadTimeSlots()
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

        async loadClassrooms() {
            try {
                const rooms = await API.getClassrooms();
                this.classrooms = Array.isArray(rooms) ? rooms : [];
                console.log('Loaded classrooms:', this.classrooms);
            } catch (err) {
                console.error('Error loading classrooms:', err);
                this.classrooms = [];
            }
        },

        async loadTimeSlots() {
            try {
                const slots = await API.getTimeSlots();
                // Backend returns array of objects: [{code: "08_10", label: "08:00-10:00", ...}, ...]
                // Map to format expected by template
                if (Array.isArray(slots)) {
                    this.timeSlots = slots.map(slot => ({
                        code: slot.code || slot,
                        display: slot.label || slot.display || this.getTimeSlotLabel(slot.code || slot)
                    }));
                } else {
                    this.timeSlots = [];
                }
                console.log('Loaded time slots:', this.timeSlots);
            } catch (err) {
                console.error('Error loading time slots:', err);
                this.timeSlots = [];
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
                capacity: 1,
                schedules: [],
                exam: null
            };
            this.error = '';
            this.success = '';
            // Ensure classrooms and time slots are loaded
            if (!this.classrooms || this.classrooms.length === 0) {
                this.loadClassrooms();
            }
            if (!this.timeSlots || this.timeSlots.length === 0) {
                this.loadTimeSlots();
            }
            this.showModal = true;
        },

        onCourseChange() {
            // When course changes, filter professors by course's departments
            // This is optional - can be implemented later if needed
            // For now, just ensure form is valid
            if (this.form.course) {
                // Could filter professors here based on course departments
            }
        },

        async openEditModal(section) {
            this.editingId = section.id;
            try {
                // SectionDetailSerializer returns term, course, professor as strings
                // But also includes course_id field
                const termId = this.terms.find(t => t.name === section.term)?.id || '';
                // Use course_id if available, otherwise try to match by string
                const courseId = section.course_id || this.courses.find(c => `${c.code} - ${c.title}` === section.course)?.id || '';
                const professorId = this.professors.find(p => {
                    const profName = p.username + (p.first_name ? ` (${p.first_name} ${p.last_name || ''})` : '');
                    return profName === section.professor || p.username === section.professor;
                })?.id || '';
                
                // Load schedules and exam from section data
                const schedules = section.schedules || [];
                const exam = section.exam || null;
                
                // Convert exam datetime to datetime-local format
                let examDatetime = null;
                if (exam && exam.exam_datetime) {
                    try {
                        // Convert ISO datetime to datetime-local format (YYYY-MM-DDTHH:mm)
                        const date = new Date(exam.exam_datetime);
                        if (!isNaN(date.getTime())) {
                            const year = date.getFullYear();
                            const month = String(date.getMonth() + 1).padStart(2, '0');
                            const day = String(date.getDate()).padStart(2, '0');
                            const hours = String(date.getHours()).padStart(2, '0');
                            const minutes = String(date.getMinutes()).padStart(2, '0');
                            examDatetime = `${year}-${month}-${day}T${hours}:${minutes}`;
                        }
                    } catch (err) {
                        console.error('Error converting exam datetime:', err);
                    }
                }
                
                this.form = {
                    term: termId,
                    course: courseId,
                    professor: professorId,
                    section_number: section.section_number || 1,
                    capacity: section.capacity || 1,
                    schedules: (schedules || []).map(s => {
                        const scheduleData = {
                            day_of_week: s.day_of_week || 0,
                            time_slot: s.time_slot || '',
                            location: s.location || ''
                        };
                        // Handle classroom - backend returns ID as integer
                        if (s.classroom) {
                            scheduleData.classroom = typeof s.classroom === 'object' ? s.classroom.id : parseInt(s.classroom);
                        }
                        return scheduleData;
                    }),
                    exam: exam ? {
                        exam_datetime: examDatetime,
                        location: exam.location || '',
                        ...(exam.classroom && { classroom: typeof exam.classroom === 'object' ? exam.classroom.id : parseInt(exam.classroom) })
                    } : null
                };
                
                // Ensure classrooms and time slots are loaded for editing
                if (!this.classrooms || this.classrooms.length === 0) {
                    await this.loadClassrooms();
                }
                if (!this.timeSlots || this.timeSlots.length === 0) {
                    await this.loadTimeSlots();
                }
            } catch (err) {
                console.error('Error opening edit modal:', err);
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
                capacity: 1,
                schedules: [],
                exam: null
            };
            this.error = '';
        },

        // Schedule management
        addSchedule() {
            this.form.schedules.push({
                day_of_week: 0,
                time_slot: '',
                classroom: '',
                location: ''
            });
        },

        // Auto-fill location from classroom
        onScheduleClassroomChange(index) {
            const schedule = this.form.schedules[index];
            if (schedule.classroom) {
                const classroom = this.classrooms.find(c => c.id === parseInt(schedule.classroom));
                if (classroom) {
                    // Always auto-fill location from classroom
                    schedule.location = classroom.number;
                }
            } else {
                // Clear location if classroom is removed
                schedule.location = '';
            }
        },

        removeSchedule(index) {
            this.form.schedules.splice(index, 1);
        },

        getDayName(dayOfWeek) {
            const days = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
            return days[dayOfWeek] || 'نامشخص';
        },

        formatTime(time) {
            if (!time) return '';
            try {
                // Handle both "HH:MM:SS" and "HH:MM" formats
                const parts = String(time).split(':');
                if (parts.length < 2) return String(time);
                return `${parts[0]}:${parts[1]}`;
            } catch (err) {
                console.error('Error formatting time:', err);
                return String(time);
            }
        },

        getScheduleText(schedule) {
            if (!schedule) return 'نامشخص';
            try {
                const day = this.getDayName(schedule.day_of_week);
                // Use time_slot if available, otherwise fallback to start_time/end_time
                let timeText = '';
                if (schedule.time_slot) {
                    // Format time_slot like "08_10" to "08:00-10:00"
                    const parts = schedule.time_slot.split('_');
                    if (parts.length === 2) {
                        timeText = `${parts[0]}:00-${parts[1]}:00`;
                    } else {
                        timeText = schedule.time_slot;
                    }
                } else if (schedule.start_time && schedule.end_time) {
                    const start = this.formatTime(schedule.start_time);
                    const end = this.formatTime(schedule.end_time);
                    timeText = `${start}-${end}`;
                } else {
                    timeText = 'نامشخص';
                }
                const location = schedule.location ? ` - ${schedule.location}` : '';
                return `${day} ${timeText}${location}`;
            } catch (err) {
                console.error('Error formatting schedule:', err);
                return 'خطا در نمایش اطلاعات';
            }
        },

        getTimeSlotLabel(timeSlot) {
            if (!timeSlot) return '';
            // Format "08_10" to "08:00-10:00"
            const parts = timeSlot.split('_');
            if (parts.length === 2) {
                return `${parts[0]}:00-${parts[1]}:00`;
            }
            return timeSlot;
        },

        getClassroomName(classroomId) {
            if (!classroomId) return '';
            const classroom = this.classrooms.find(c => c.id === parseInt(classroomId));
            return classroom ? classroom.number : '';
        },

        // Exam management
        setExam() {
            if (!this.form.exam) {
                this.form.exam = {
                    exam_datetime: '',
                    classroom: '',
                    location: ''
                };
            }
        },

        // Auto-fill location from exam classroom
        onExamClassroomChange() {
            if (this.form.exam && this.form.exam.classroom) {
                const classroom = this.classrooms.find(c => c.id === parseInt(this.form.exam.classroom));
                if (classroom) {
                    // Always auto-fill location from classroom
                    this.form.exam.location = classroom.number;
                }
            } else if (this.form.exam) {
                // Clear location if classroom is removed
                this.form.exam.location = '';
            }
        },

        removeExam() {
            this.form.exam = null;
        },

        formatDateTime(datetime) {
            if (!datetime) return '';
            try {
                // Handle ISO datetime string
                const date = new Date(datetime);
                if (isNaN(date.getTime())) {
                    // Invalid date
                    return String(datetime);
                }
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                return `${year}-${month}-${day} ${hours}:${minutes}`;
            } catch (err) {
                console.error('Error formatting datetime:', err);
                return String(datetime);
            }
        },

        getExamText(exam) {
            if (!exam) return 'تعریف نشده';
            try {
                const datetime = this.formatDateTime(exam.exam_datetime);
                const location = exam.location ? ` - ${exam.location}` : '';
                return `${datetime}${location}`;
            } catch (err) {
                console.error('Error formatting exam:', err);
                return 'خطا در نمایش اطلاعات';
            }
        },

        async submitForm() {
            this.error = '';
            this.success = '';

            if (!this.form.term || !this.form.course || !this.form.professor || 
                !this.form.section_number || !this.form.capacity) {
                this.error = 'لطفاً تمام فیلدهای الزامی را پر کنید';
                return;
            }

            // Validate schedules
            if (this.form.schedules && this.form.schedules.length > 0) {
                for (let i = 0; i < this.form.schedules.length; i++) {
                    const s = this.form.schedules[i];
                    if (!s.time_slot || !s.time_slot.trim()) {
                        this.error = `برنامه شماره ${i + 1}: لطفاً بازه زمانی را انتخاب کنید`;
                        return;
                    }
                }
            }

            try {
                // Prepare schedules - ensure array exists
                const schedules = (this.form.schedules || []).map(s => {
                    if (!s.time_slot || !s.time_slot.trim()) {
                        throw new Error('بازه زمانی برای همه برنامه‌ها الزامی است');
                    }
                    
                    const scheduleData = {
                        day_of_week: parseInt(s.day_of_week) || 0,
                        time_slot: s.time_slot.trim()
                    };
                    
                    // Handle classroom - only include if selected
                    if (s.classroom && s.classroom !== '' && s.classroom !== null) {
                        const classroomId = parseInt(s.classroom);
                        if (!isNaN(classroomId) && classroomId > 0) {
                            scheduleData.classroom = classroomId;
                            // Auto-fill location from classroom if location is empty
                            if (!s.location || !s.location.trim()) {
                                const classroom = this.classrooms.find(c => c.id === classroomId);
                                if (classroom) {
                                    scheduleData.location = classroom.number;
                                }
                            } else {
                                scheduleData.location = s.location.trim();
                            }
                        } else if (s.location && s.location.trim()) {
                            scheduleData.location = s.location.trim();
                        }
                    } else if (s.location && s.location.trim()) {
                        scheduleData.location = s.location.trim();
                    }
                    
                    return scheduleData;
                });

                // Prepare exam - convert datetime-local to ISO format
                let exam = null;
                if (this.form.exam && this.form.exam.exam_datetime) {
                    try {
                        // Convert datetime-local format to ISO string
                        const datetimeStr = String(this.form.exam.exam_datetime);
                        if (!datetimeStr || !datetimeStr.trim()) {
                            this.error = 'لطفاً تاریخ و زمان امتحان را وارد کنید';
                            return;
                        }
                        // datetime-local format is "YYYY-MM-DDTHH:mm", need to add seconds and timezone
                        let isoDatetime = datetimeStr.trim();
                        if (isoDatetime.includes('T')) {
                            // Add seconds if not present
                            if (isoDatetime.split(':').length === 2) {
                                isoDatetime = `${isoDatetime}:00`;
                            }
                        }
                        exam = {
                            exam_datetime: isoDatetime
                        };
                        
                        // Handle classroom - only include if selected
                        if (this.form.exam.classroom && this.form.exam.classroom !== '' && this.form.exam.classroom !== null) {
                            const classroomId = parseInt(this.form.exam.classroom);
                            if (!isNaN(classroomId) && classroomId > 0) {
                                exam.classroom = classroomId;
                                // Auto-fill location from classroom if location is empty
                                if (!this.form.exam.location || !this.form.exam.location.trim()) {
                                    const classroom = this.classrooms.find(c => c.id === classroomId);
                                    if (classroom) {
                                        exam.location = classroom.number;
                                    }
                                } else {
                                    exam.location = this.form.exam.location.trim();
                                }
                            } else if (this.form.exam.location && this.form.exam.location.trim()) {
                                exam.location = this.form.exam.location.trim();
                            }
                        } else if (this.form.exam.location && this.form.exam.location.trim()) {
                            exam.location = this.form.exam.location.trim();
                        }
                    } catch (err) {
                        console.error('Error preparing exam data:', err);
                        this.error = 'خطا در فرمت تاریخ و زمان امتحان';
                        return;
                    }
                }

                const data = {
                    term: parseInt(this.form.term),
                    course: parseInt(this.form.course),
                    professor: parseInt(this.form.professor),
                    section_number: parseInt(this.form.section_number),
                    capacity: parseInt(this.form.capacity),
                    schedules: schedules,
                    exam: exam
                };

                let sectionId = this.editingId;
                let isNewSection = false;
                
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

