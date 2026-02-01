from django.db import models
from django.core.exceptions import ValidationError


class Registration(models.Model):
    """Student registration for a course section"""
    
    student = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="registrations",
    )
    
    section = models.ForeignKey(
        "offerings.Section",
        on_delete=models.CASCADE,
        related_name="registrations",
    )
    
    registered_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ["-registered_at"]
        unique_together = ("student", "section")
        indexes = [
            models.Index(fields=["student", "section"]),
        ]
    
    def __str__(self):
        return f"{self.student.username} - {self.section}"
    
    def clean(self):
        errors = {}
        
        # Validate student role
        if self.student_id and self.student.role != "student":
            errors["student"] = "Only students can register for courses."
        
        # Validate section capacity
        if self.section_id:
            current_registrations = Registration.objects.filter(section=self.section).count()
            if self.pk:
                # Exclude current registration when checking capacity
                current_registrations -= 1
            if current_registrations >= self.section.capacity:
                errors["section"] = "Section is at full capacity."
        
        # Validate term registration period
        if self.section_id and self.student_id:
            term = self.section.term
            from django.utils import timezone
            today = timezone.now().date()
            
            if today < term.registration_start:
                errors["section"] = f"Registration period has not started yet. Registration starts on {term.registration_start}."
            elif today > term.registration_end:
                errors["section"] = f"Registration period has ended. Registration ended on {term.registration_end}."
            
            # Check if term is active or ready
            if term.status not in [term.TermStatus.READY, term.TermStatus.ACTIVE]:
                errors["section"] = "Registration is only allowed for Ready or Active terms."
        
        # Validate prerequisites
        if self.section_id and self.student_id:
            course = self.section.course
            from courses.models import Prerequisite
            from grading.models import Grade
            
            prerequisites = Prerequisite.objects.filter(course=course)
            for prereq in prerequisites:
                prereq_course = prereq.prerequisite_course
                
                # Check if student has PASSED the prerequisite course
                has_passed = Grade.objects.filter(
                    student=self.student,
                    course=prereq_course,
                    passed=True
                ).exists()
                
                if not has_passed:
                    errors["section"] = f"Prerequisite not met: {prereq_course.code} - {prereq_course.title}. You must have passed this course."
        
        # Validate time conflicts
        if self.section_id and self.student_id:
            # Get all schedules for this section
            section_schedules = self.section.schedules.all()
            
            # Get all other registrations for this student in the same term
            other_registrations = Registration.objects.filter(
                student=self.student,
                section__term=self.section.term
            ).exclude(pk=self.pk if self.pk else None)
            
            for other_reg in other_registrations:
                other_schedules = other_reg.section.schedules.all()
                
                # Check for time conflicts
                for schedule in section_schedules:
                    for other_schedule in other_schedules:
                        if (schedule.day_of_week == other_schedule.day_of_week and
                            schedule.time_slot == other_schedule.time_slot):
                            errors["section"] = f"Time conflict with {other_reg.section.course.code} - {other_reg.section.course.title}"
        
        # Validate unit limits
        if self.section_id and self.student_id:
            term = self.section.term
            # Calculate total units for this term
            total_units = sum(
                reg.section.course.units
                for reg in Registration.objects.filter(
                    student=self.student,
                    section__term=term
                ).exclude(pk=self.pk if self.pk else None)
            )
            total_units += self.section.course.units
            
            if total_units > term.max_units:
                errors["section"] = f"Maximum units allowed: {term.max_units}. Current: {total_units}"
        
        if errors:
            raise ValidationError(errors)
