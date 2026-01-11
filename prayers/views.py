from datetime import date
from django.http import JsonResponse
from django.shortcuts import render
from .models import SiteConfig, DailyPrayerTimes


def screen(request):
    return render(request, "prayers/index.html")


def api_config(request):
    cfg = SiteConfig.objects.order_by("-updated_at").first()
    return JsonResponse(cfg.data if cfg else {}, safe=True)


def api_today(request):
    today = DailyPrayerTimes.objects.filter(date=date.today()).first()
    if not today:
        today = DailyPrayerTimes.objects.order_by("-date").first()

    if not today:
        return JsonResponse({}, safe=True)

    return JsonResponse({
        "Date": today.date.strftime("%Y-%m-%d"),
        "Day": today.day,
        "Hijri": today.hijri,
        "Fajr": today.fajr,
        "Sunrise": today.sunrise,
        "Dhuhr": today.dhuhr,
        "Asr": today.asr,
        "Maghrib": today.maghrib,
        "Isha": today.isha,
        "Comments": today.comments,
    })
