// Student Weekly Schedule component
function weeklyScheduleManager() {
    return {
        scheduleData: null,
        loading: false,
        error: '',
        success: '',

        async init() {
            await this.loadSchedule();
        },

        async loadSchedule() {
            this.loading = true;
            this.error = '';
            try {
                this.scheduleData = await API.getWeeklySchedule();
                if (!this.scheduleData) {
                    const token = API.getAccessToken();
                    if (!token) {
                        this.error = 'نشست شما منقضی شده است. لطفاً صفحه را رفرش کنید یا دوباره وارد شوید.';
                    } else {
                        this.error = 'برنامه هفتگی در دسترس نیست.';
                    }
                }
            } catch (err) {
                // Check if it's an auth error
                if (err.message && (err.message.includes('منقضی') || err.message.includes('دسترسی'))) {
                    this.error = 'نشست شما منقضی شده است. لطفاً صفحه را رفرش کنید یا دوباره وارد شوید.';
                } else {
                    this.error = err.message || 'خطا در بارگذاری برنامه هفتگی';
                }
            } finally {
                this.loading = false;
            }
        },

        getDayName(dayName) {
            const dayNames = {
                'Saturday': 'شنبه',
                'Sunday': 'یکشنبه',
                'Monday': 'دوشنبه',
                'Tuesday': 'سه‌شنبه',
                'Wednesday': 'چهارشنبه',
                'Thursday': 'پنج‌شنبه',
                'Friday': 'جمعه'
            };
            return dayNames[dayName] || dayName;
        },

        formatTimeRange(startTime, endTime) {
            if (!startTime || !endTime) return '-';
            const start = this.formatTime(startTime);
            const end = this.formatTime(endTime);
            return `${start} - ${end}`;
        },

        formatTime(timeString) {
            if (!timeString) return '-';
            // timeString is in format "HH:MM:SS" or "HH:MM"
            const parts = timeString.split(':');
            const hours = parseInt(parts[0]);
            const minutes = parseInt(parts[1]);
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        },

        formatDate(dateString) {
            if (!dateString) return '-';
            const date = new Date(dateString);
            return date.toLocaleDateString('fa-IR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
    }
}

