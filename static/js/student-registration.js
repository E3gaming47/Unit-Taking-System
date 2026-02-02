function studentRegistrationManager() {
    return {
        loading: false,
        error: '',
        success: '',

        terms: [],
        departments: [],
        sections: [],
        courses: [],
        myRegistrations: [],
        termInfo: null,
        totalUnits: 0,

        searchText: '',
        selectedTerm: '',
        selectedDepartment: '',

        selectedSectionId: null,
        selectedSection: null,
        selectedPrerequisites: [],
        adding: null,

        showChangeGroup: false,
        changeGroupTitle: '',
        changeRegistrationId: null,
        availableGroupSections: [],
        newSectionId: '',
        changing: false,

        async init() {
            const params = new URLSearchParams(window.location.search);
            const sectionFromUrl = parseInt(params.get('section'));
            this.selectedSectionId = !isNaN(sectionFromUrl) && sectionFromUrl > 0 ? sectionFromUrl : null;

            this.loading = true;
            this.error = '';
            try {
                await Promise.allSettled([
                    this.loadTerms(),
                    this.loadDepartments(),
                    this.loadCourses(),
                ]);
                await this.refreshAll();
                if (this.selectedSectionId) {
                    const found = this.sections.find(s => s.id === this.selectedSectionId);
                    if (found) this.selectSection(found);
                }
            } finally {
                this.loading = false;
            }
        },

        async refreshAll() {
            await Promise.all([
                this.loadMyRegistrations(),
                this.loadTotalUnits(),
                this.loadSections(),
            ]);
            if (this.selectedSectionId) {
                const found = this.sections.find(s => s.id === this.selectedSectionId);
                if (found) {
                    this.selectedSection = found;
                    await this.loadSelectedPrerequisites(found.course_id);
                }
            }
        },

        async loadCourses() {
            try {
                this.courses = await API.getCourses();
            } catch (e) {
                this.courses = [];
            }
        },

        async loadTerms() {
            try {
                this.terms = await API.getTerms();
            } catch (e) {
                this.terms = [];
            }
        },

        async loadDepartments() {
            try {
                this.departments = await API.getDepartments();
            } catch (e) {
                this.departments = [];
            }
        },

        async loadSections() {
            const params = {};
            if (this.searchText && this.searchText.trim()) params.search = this.searchText.trim();
            if (this.selectedTerm) params.term = this.selectedTerm;
            if (this.selectedDepartment) params.department = this.selectedDepartment;
            this.sections = await API.getSections(params);
        },

        async loadMyRegistrations() {
            const regs = await API.getMyRegistrations();
            this.myRegistrations = Array.isArray(regs) ? regs : [];
        },

        async loadTotalUnits() {
            try {
                const data = await API.getTotalUnits();
                this.totalUnits = data?.total_units ?? 0;
                this.termInfo = data?.term ?? null;
            } catch (e) {
                this.totalUnits = 0;
                this.termInfo = null;
            }
        },

        clearFilters() {
            this.searchText = '';
            this.selectedTerm = '';
            this.selectedDepartment = '';
            this.loadSections();
        },

        selectSection(section) {
            if (!section || !section.id) return;
            this.selectedSectionId = section.id;
            this.selectedSection = section;
            this.loadSelectedPrerequisites(section.course_id);
        },

        async loadSelectedPrerequisites(courseId) {
            const cid = parseInt(courseId);
            if (!cid || isNaN(cid)) {
                this.selectedPrerequisites = [];
                return;
            }
            try {
                const prereqs = await API.getPrerequisites({ course: cid });
                this.selectedPrerequisites = Array.isArray(prereqs) ? prereqs : [];
            } catch (e) {
                this.selectedPrerequisites = [];
            }
        },

        getPrerequisiteName(prereq) {
            const prereqId = typeof prereq.prerequisite_course === 'object'
                ? prereq.prerequisite_course.id
                : parseInt(prereq.prerequisite_course);
            const c = this.courses.find(x => x.id === prereqId);
            return c ? `${c.code} - ${c.title}` : `درس #${prereqId}`;
        },

        getRegistrationForCourse(courseId) {
            const cid = parseInt(courseId);
            if (!cid || isNaN(cid)) return null;
            return this.myRegistrations.find(r => parseInt(r.section?.course_id) === cid) || null;
        },

        isEnrolledInCourse(courseId) {
            const cid = parseInt(courseId);
            if (!cid || isNaN(cid)) return false;
            return this.myRegistrations.some(r => parseInt(r.section?.course_id) === cid);
        },

        getScheduleText(schedule) {
            if (!schedule) return '-';
            const days = {
                0: 'شنبه',
                1: 'یکشنبه',
                2: 'دوشنبه',
                3: 'سه‌شنبه',
                4: 'چهارشنبه',
                5: 'پنجشنبه',
                6: 'جمعه'
            };
            const day = days[schedule.day_of_week] ?? '';
            let time = '';
            if (schedule.start_time && schedule.end_time) {
                const start = this.formatTime(schedule.start_time);
                const end = this.formatTime(schedule.end_time);
                time = `${start}-${end}`;
            } else if (schedule.time_slot) {
                time = schedule.time_slot;
            }
            const location = schedule.location ? ` | ${schedule.location}` : '';
            return `${day} ${time}${location}`.trim();
        },

        formatTime(timeString) {
            if (!timeString) return '';
            const parts = timeString.split(':');
            if (parts.length < 2) return timeString;
            return `${parts[0]}:${parts[1]}`;
        },

        async addSection(section) {
            if (!section || !section.id) return;
            if (this.adding) return;
            if (this.isEnrolledInCourse(section.course_id)) {
                this.error = 'این درس را قبلاً انتخاب کرده‌اید.';
                return;
            }
            this.adding = section.id;
            this.error = '';
            this.success = '';
            try {
                await API.registerForSection(section.id);
                await this.refreshAll();
                this.success = 'درس با موفقیت اضافه شد.';
                setTimeout(() => { this.success = ''; }, 2500);
            } catch (e) {
                this.error = e.message || 'خطا در افزودن درس';
            } finally {
                this.adding = null;
            }
        },

        async dropRegistration(reg) {
            if (!reg || !reg.id) return;
            if (!confirm('آیا از حذف این واحد مطمئن هستید؟')) return;
            this.error = '';
            this.success = '';
            try {
                await API.dropCourse(reg.id);
                await this.refreshAll();
                this.success = 'واحد با موفقیت حذف شد.';
                setTimeout(() => { this.success = ''; }, 2500);
            } catch (e) {
                this.error = e.message || 'خطا در حذف واحد';
            }
        },

        openChangeGroup(reg) {
            if (!reg || !reg.id) return;
            const currentSection = reg.section;
            const courseId = parseInt(currentSection?.course_id);
            if (!courseId || isNaN(courseId)) return;
            const termId = currentSection?.term_id;
            this.availableGroupSections = this.sections.filter(s => s.course_id === courseId && (!termId || s.term_id === termId));
            this.changeRegistrationId = reg.id;
            this.newSectionId = '';
            this.changeGroupTitle = currentSection?.course ? `درس: ${currentSection.course}` : 'تغییر گروه';
            this.showChangeGroup = true;
        },

        closeChangeGroup() {
            this.showChangeGroup = false;
            this.changeRegistrationId = null;
            this.availableGroupSections = [];
            this.newSectionId = '';
            this.changing = false;
        },

        async confirmChangeGroup() {
            const regId = parseInt(this.changeRegistrationId);
            const newSectionId = parseInt(this.newSectionId);
            if (!regId || isNaN(regId) || !newSectionId || isNaN(newSectionId)) {
                this.error = 'لطفاً گروه جدید را انتخاب کنید.';
                return;
            }
            this.changing = true;
            this.error = '';
            this.success = '';
            try {
                await API.changeRegistrationSection(regId, newSectionId);
                await this.refreshAll();
                this.success = 'گروه با موفقیت تغییر کرد.';
                setTimeout(() => { this.success = ''; }, 2500);
                this.closeChangeGroup();
            } catch (e) {
                this.error = e.message || 'خطا در تغییر گروه';
            } finally {
                this.changing = false;
            }
        }
    };
}
