from django.contrib import admin
from .models import SiteConfig, DailyPrayerTimes


@admin.register(SiteConfig)
class SiteConfigAdmin(admin.ModelAdmin):
    list_display = ("id", "updated_at")


@admin.register(DailyPrayerTimes)
class DailyPrayerTimesAdmin(admin.ModelAdmin):
    list_display = ("date", "day", "hijri")
    ordering = ("-date",)
