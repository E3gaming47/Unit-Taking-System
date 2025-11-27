from django.db import models


class Department(models.Model):
    name = models.CharField(
        max_length=100,
        unique=True,              
    )
    
    code = models.CharField(
        max_length=10,
        unique=True,              
    )
    
    description = models.TextField(
        blank=True,               
    )

    class Meta:
        ordering = ["code"]       

    def __str__(self):
        return f"{self.code} - {self.name}"   # نمایش خوانا در پنل ادمین