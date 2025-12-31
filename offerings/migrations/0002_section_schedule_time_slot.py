from datetime import time

from django.db import migrations, models


def forwards(apps, schema_editor):
    SectionSchedule = apps.get_model("offerings", "SectionSchedule")

    mapping = {
        (time(8, 0), time(10, 0)): "08_10",
        (time(10, 0), time(12, 0)): "10_12",
        (time(12, 0), time(14, 0)): "12_14",
        (time(14, 0), time(16, 0)): "14_16",
        (time(16, 0), time(18, 0)): "16_18",
        (time(18, 0), time(20, 0)): "18_20",
    }

    for row in SectionSchedule.objects.all().only("id", "start_time", "end_time"):
        slot = mapping.get((row.start_time, row.end_time))
        if slot:
            SectionSchedule.objects.filter(id=row.id).update(time_slot=slot)


class Migration(migrations.Migration):
    dependencies = [
        ("offerings", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="sectionschedule",
            name="time_slot",
            field=models.CharField(
                choices=[
                    ("08_10", "08:00-10:00"),
                    ("10_12", "10:00-12:00"),
                    ("12_14", "12:00-14:00"),
                    ("14_16", "14:00-16:00"),
                    ("16_18", "16:00-18:00"),
                    ("18_20", "18:00-20:00"),
                ],
                default="08_10",
                max_length=8,
            ),
            preserve_default=False,
        ),
        migrations.RunPython(forwards, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name="sectionschedule",
            name="end_time",
        ),
        migrations.RemoveField(
            model_name="sectionschedule",
            name="start_time",
        ),
        migrations.AlterModelOptions(
            name="sectionschedule",
            options={"ordering": ["section", "day_of_week", "time_slot"]},
        ),
    ]
