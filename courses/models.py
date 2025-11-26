from django.db import models

from django.conf import settings
from django.db import models, transaction
from django.db.models import Q, F
from django.core.exceptions import ValidationError
from django.utils import timezone
from typing import Set


DAY_CHOICES = [
    (0, "Monday"),
    (1, "Tuesday"),
    (2, "Wednesday"),
    (3, "Thursday"),
    (4, "Friday"),
    (5, "Saturday"),
    (6, "Sunday"),
]


class Term(models.Model):
    name = models.CharField(max_length=64, unique=True)  # e.g. "Fall 2025"
    start_date = models.DateField()
    end_date = models.DateField()

    class Meta:
        ordering = ["-start_date"]

    def __str__(self):
        return self.name

    def clean(self):
        if self.start_date >= self.end_date:
            raise ValidationError("start_date must be before end_date.")


class Course(models.Model):
    code = models.CharField(max_length=16)  # e.g. "CS101"
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    units = models.PositiveSmallIntegerField(default=3)
    capacity = models.PositiveIntegerField(default=30)
    professor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="courses_taught",
    )
    term = models.ForeignKey(Term, on_delete=models.PROTECT, related_name="courses")
    prerequisites = models.ManyToManyField(
        "self", through="CoursePrerequisite", symmetrical=False, related_name="required_for"
    )

    class Meta:
        unique_together = ("code", "term")
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} — {self.title} ({self.term})"

    @property
    def enrolled_count(self):
        return Enrollment.objects.filter(course=self, status=Enrollment.STATUS_ENROLLED).count()

    @property
    def seats_available(self):
        return max(self.capacity - self.enrolled_count, 0)

    def get_all_prerequisite_ids(self) -> Set[int]:
        """
        بازگشتی: همه‌ی پیش‌نیازهای مستقیم و غیرمستقیم را برمی‌گرداند (شناسه‌ها).
        """
        seen = set()
        stack = [p.prerequisite_id for p in CoursePrerequisite.objects.filter(course=self)]
        while stack:
            cid = stack.pop()
            if cid in seen:
                continue
            seen.add(cid)
            # بردارید پیش نیازهای آن درس را هم
            more = list(
                CoursePrerequisite.objects.filter(course_id=cid).values_list("prerequisite_id", flat=True)
            )
            stack.extend(more)
        return seen


class CoursePrerequisite(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="prereq_links")
    prerequisite = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="is_prereq_of")

    class Meta:
        unique_together = ("course", "prerequisite")

    def __str__(self):
        return f"{self.prerequisite} → {self.course}"


class CourseMeeting(models.Model):
    """
    یک جلسه از کلاس: روز هفته + زمان شروع/پایان + محل
    برای بررسی تداخل زمانی از این مدل استفاده می‌کنیم.
    """
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="meetings")
    day = models.IntegerField(choices=DAY_CHOICES)
    start_time = models.TimeField()
    end_time = models.TimeField()
    location = models.CharField(max_length=120, blank=True)

    class Meta:
        ordering = ["day", "start_time"]
        # یک درس نباید جلسه‌ای با start>=end داشته باشد؛ این را در clean می‌گیرم.

    def clean(self):
        if self.start_time >= self.end_time:
            raise ValidationError("start_time must be before end_time.")

    def __str__(self):
        return f"{self.course.code} - {self.get_day_display()} {self.start_time}-{self.end_time}"


class EnrollmentManager(models.Manager):
    def enroll(self, student, course: Course, *, check_prereqs=True, check_capacity=True, check_conflict=True):
        """
        متد کمکی برای ثبت‌نام امن:
         - همهٔ بررسی‌های کسب‌وکار را انجام می‌دهد و در یک تراکنش اجرا می‌شود.
         - اگر ناموفق بود ValidationError بر می‌گرداند.
        """
        # فرض: ترم را از course.term می‌گیریم
        term = course.term

        # قفل روی سطر course تا race condition برای ظرفیت کم شود
        with transaction.atomic():
            course_locked = Course.objects.select_for_update().get(pk=course.pk)

            # تکراری بودن ثبت‌نام را بررسی کن
            exists = Enrollment.objects.filter(
                student=student, course=course_locked, term=term, status=Enrollment.STATUS_ENROLLED
            ).exists()
            if exists:
                raise ValidationError("Student is already enrolled in this course for the same term.")

            # بررسی پیش‌نیازها
            if check_prereqs:
                prereq_ids = course_locked.get_all_prerequisite_ids()
                if prereq_ids:
                    # اینجا فرض می‌کنیم که پیش‌نیاز باید با وضعیت COMPLETED در سیستم ثبت شده باشد.
                    completed = set(
                        Enrollment.objects.filter(
                            student=student, course_id__in=prereq_ids, status=Enrollment.STATUS_COMPLETED
                        ).values_list("course_id", flat=True)
                    )
                    missing = prereq_ids - completed
                    if missing:
                        raise ValidationError({"prerequisite": "Missing prerequisite courses.", "missing_ids": list(missing)})

            # بررسی ظرفیت
            if check_capacity:
                current = Enrollment.objects.filter(course=course_locked, status=Enrollment.STATUS_ENROLLED).count()
                if current >= course_locked.capacity:
                    raise ValidationError("Course is full.")

            # بررسی تداخل زمانی با دیگر دروسِ دانشجو در همان ترم
            if check_conflict:
                # جلسات درس جدید
                new_meetings = list(course_locked.meetings.all())
                # جلسات دروس دیگری که دانشجو در همان ترم ثبت‌نام کرده
                other_enrollments = Enrollment.objects.filter(
                    student=student, term=term, status=Enrollment.STATUS_ENROLLED
                ).select_related("course")
                # برای هر درسِ دیگر، تمام جلسات را بررسی می‌کنیم
                for enrol in other_enrollments:
                    other_meetings = enrol.course.meetings.all()
                    for nm in new_meetings:
                        for om in other_meetings:
                            if self._meetings_conflict(nm, om):
                                raise ValidationError(
                                    {
                                        "conflict": f"Time conflict with {enrol.course.code} ({om.get_day_display()} {om.start_time}-{om.end_time})",
                                        "conflict_with_course": enrol.course.pk,
                                    }
                                )

            # اگر همه چیز اوکی بود، ثبت‌نام را بساز
            enrollment = Enrollment.objects.create(
                student=student,
                course=course_locked,
                term=term,
                status=Enrollment.STATUS_ENROLLED,
                enrolled_at=timezone.now(),
            )
            return enrollment

    @staticmethod
    def _meetings_conflict(m1: CourseMeeting, m2: CourseMeeting) -> bool:
        """
        تداخل زمانی دو جلسه را بررسی می‌کند (اگر یک روز برابر باشد و بازه‌ها همپوشانی داشته باشند)
        """
        if m1.day != m2.day:
            return False
        # همپوشانی بازه‌های زمانی: start1 < end2 and start2 < end1
        return (m1.start_time < m2.end_time) and (m2.start_time < m1.end_time)


class Enrollment(models.Model):
    """
    ثبت‌نام دانشجو در یک درس برای یک ترم.
    وضعیت‌ها: ENROLLED, DROPPED, COMPLETED (برای بررسی پیش‌نیازها)
    """
    STATUS_ENROLLED = "enrolled"
    STATUS_DROPPED = "dropped"
    STATUS_COMPLETED = "completed"

    STATUS_CHOICES = [
        (STATUS_ENROLLED, "Enrolled"),
        (STATUS_DROPPED, "Dropped"),
        (STATUS_COMPLETED, "Completed"),
    ]

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="enrollments"
    )
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="enrollments")
    term = models.ForeignKey(Term, on_delete=models.PROTECT, related_name="enrollments")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_ENROLLED)
    enrolled_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = EnrollmentManager()

    class Meta:
        unique_together = ("student", "course", "term")
        ordering = ["-enrolled_at"]

    def __str__(self):
        return f"{self.student} - {self.course} ({self.status})"

    def clean(self):
        # اطمینان از اینکه term با term دوره یکسان است (برای جلوگیری از ناسازگاری)
        if self.course.term_id != self.term_id:
            raise ValidationError("Enrollment.term must match the course.term.")

