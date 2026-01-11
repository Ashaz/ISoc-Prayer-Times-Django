import json
from pathlib import Path
from datetime import datetime

from django.core.management.base import BaseCommand
from django.conf import settings
from prayers.models import SiteConfig, DailyPrayerTimes

class Command(BaseCommand):
    help = "Import config.json and prayer_times.json into the database"

    def handle(self, *args, **options):
        base_dir = Path(settings.BASE_DIR)
        data_dir = base_dir / "data"

        config_path = data_dir / "config.json"
        times_path = data_dir / "prayer_times.json"

        self.stdout.write(f"Looking for config at: {config_path}")
        self.stdout.write(f"Looking for times at:  {times_path}")

        if not config_path.exists():
            self.stderr.write("❌ config.json not found")
            return

        if not times_path.exists():
            self.stderr.write("❌ prayer_times.json not found")
            return

        self.import_config(config_path)
        self.import_prayer_times(times_path)

        self.stdout.write(self.style.SUCCESS("✅ Import complete"))

    # ----------------------------
    # CONFIG
    # ----------------------------
    def import_config(self, path):
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        SiteConfig.objects.all().delete()
        SiteConfig.objects.create(data=data)

        self.stdout.write("✔ SiteConfig imported")

    # ----------------------------
    # PRAYER TIMES
    # ----------------------------
    def import_prayer_times(self, path):
        with open(path, "r", encoding="utf-8") as f:
            rows = json.load(f)

        created = 0
        updated = 0

        for row in rows:
            date_str = row.get("Date", "").strip()

            # Skip rows with no date
            if not date_str:
                self.stderr.write("⚠ Skipping row with empty Date field")
                continue

            try:
                date_obj = datetime.strptime(date_str, "%d-%b-%y").date()
            except ValueError:
                self.stderr.write(f"⚠ Skipping row with invalid Date: {date_str}")
                continue

            obj, was_created = DailyPrayerTimes.objects.update_or_create(
                date=date_obj,
                defaults={
                    "day": row.get("Day", ""),
                    "hijri": row.get("Hijri", ""),
                    "fajr": row.get("Fajr", ""),
                    "sunrise": row.get("Sunrise", ""),
                    "dhuhr": row.get("Dhuhr", ""),
                    "asr": row.get("Asr", ""),
                    "maghrib": row.get("Maghrib", ""),
                    "isha": row.get("Isha", ""),
                    "comments": row.get("Comments", ""),
                },
            )

            if was_created:
                created += 1
            else:
                updated += 1

        self.stdout.write(
            f"✔ Prayer times imported ({created} created, {updated} updated)"
        )
