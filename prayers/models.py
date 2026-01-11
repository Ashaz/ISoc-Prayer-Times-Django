from django.db import models


class SiteConfig(models.Model):
    """
    Stores config.json (translations, announcements, jamaah times, etc.)
    """
    data = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Config updated {self.updated_at:%Y-%m-%d %H:%M}"


class DailyPrayerTimes(models.Model):
    date = models.DateField(unique=True)
    day = models.CharField(max_length=16)
    hijri = models.CharField(max_length=64, blank=True)

    fajr = models.CharField(max_length=8, blank=True)
    sunrise = models.CharField(max_length=8, blank=True)
    dhuhr = models.CharField(max_length=8, blank=True)
    asr = models.CharField(max_length=8, blank=True)
    maghrib = models.CharField(max_length=8, blank=True)
    isha = models.CharField(max_length=8, blank=True)

    comments = models.TextField(blank=True)

    def __str__(self):
        return f"{self.date} – {self.day}"
