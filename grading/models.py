from django.db import models
from django.core.exceptions import ValidationError

class Grade(models.Model):
    student = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="grades",
    )
    
    course = models.ForeignKey(
        "courses.Course",
        on_delete=models.CASCADE,
        related_name="grades",
    )
    
    term = models.ForeignKey(
        "terms.Term",
        on_delete=models.CASCADE,
        related_name="grades",
    )
    
    score = models.FloatField()
    passed = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ["-term", "course"]
        unique_together = ("student", "course", "term")
        
    def __str__(self):
        return f"{self.student} - {self.course}: {self.score}"
        
    def clean(self):
        if self.score < 0 or self.score > 20:
            raise ValidationError("Score must be between 0 and 20.")
            
    def save(self, *args, **kwargs):
        if self.score >= 10:
            self.passed = True
        else:
            self.passed = False
        super().save(*args, **kwargs)
