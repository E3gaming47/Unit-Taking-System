from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
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


#این برای برای ذخیره اطلاعات یک درس:
class Course(models.Model):
    code = models.CharField(max_length=16)  #کد درس
    title = models.CharField(max_length=200) #نام درس
    description = models.TextField(blank=True) #توضیحات
    units = models.PositiveSmallIntegerField(default=3) #تعداد واحدهای درس
    capacity = models.PositiveIntegerField(default=30) #ظرفیت کلاس
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="courses")
    professor = models.ForeignKey( #استاد درس
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="courses_taught",
    )
    term = models.ForeignKey(Term, on_delete=models.PROTECT, related_name="courses")#این درس مربوط به کدام ترم است 
    prerequisites = models.ManyToManyField( #پیش‌نیازهای درس
        "self", through="CoursePrerequisite", symmetrical=False, related_name="required_for"
    )

    class Meta:#در یک ترم، دو درس نمی‌تونن کد یکسان داشته باشن.
        unique_together = ("code", "term")
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} — {self.title} ({self.term})"

    @property
    def enrolled_count(self):#داره میگه الآن چند دانشجو این درس را گرفته‌اند.
        return Enrollment.objects.filter(course=self, status=Enrollment.STATUS_ENROLLED).count()

    @property
    def seats_available(self):#داره میگه چقدر ظرفیت داره
        return max(self.capacity - self.enrolled_count, 0)

    def get_all_prerequisite_ids(self) -> Set[int]:#همه‌ی پیش‌نیازهای مستقیم و غیرمستقیم یک درس را به‌صورت بازگشتی پیدا می‌کند.
       
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


class CoursePrerequisite(models.Model):#رابط بین درس و پیش‌نیاز.
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="prereq_links")
    prerequisite = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="is_prereq_of")

    class Meta:
        unique_together = ("course", "prerequisite")

    def __str__(self):
        return f"{self.prerequisite} → {self.course}"


class CourseMeeting(models.Model):#برای ثبت جلسات کلاس (روز + شروع + پایان + مکان).
 
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="meetings")
    day = models.IntegerField(choices=DAY_CHOICES)
    start_time = models.TimeField()
    end_time = models.TimeField()
    location = models.CharField(max_length=120, blank=True)

    class Meta:
        ordering = ["day", "start_time"]

    def clean(self):
        if self.start_time >= self.end_time:
            raise ValidationError("start_time must be before end_time.")

    def __str__(self):
        return f"{self.course.code} - {self.get_day_display()} {self.start_time}-{self.end_time}"




