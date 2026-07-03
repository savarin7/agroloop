from django.db import migrations

import csv
import os


def _csv_path(*parts: str) -> str:
    # Migration files live in: irrigation_api/migrations/
    # CSV files live in: <repo_root>/backend/{crop_types.csv, soil_types.csv}
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", *parts))


def _to_float(v: str):
    return float(v) if v not in (None, "") else 0.0


def _to_int(v: str):
    return int(float(v)) if v not in (None, "") else 0


def seed_types(apps, schema_editor):
    CropType = apps.get_model("irrigation_api", "CropType")
    SoilType = apps.get_model("irrigation_api", "SoilType")

    crop_csv = _csv_path("crop_types.csv")
    soil_csv = _csv_path("soil_types.csv")

    if not os.path.exists(crop_csv):
        raise FileNotFoundError(f"Missing backend CSV: {crop_csv}")
    if not os.path.exists(soil_csv):
        raise FileNotFoundError(f"Missing backend CSV: {soil_csv}")

    with open(crop_csv, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            crop = {
                "name": row["name"],
                "scientific_name": row.get("scientific_name", ""),
                "kc_initial": _to_float(row.get("kc_initial", "0")),
                "kc_mid": _to_float(row.get("kc_mid", "0")),
                "kc_end": _to_float(row.get("kc_end", "0")),
                "initial_stage_days": _to_int(row.get("initial_stage_days", "0")),
                "development_stage_days": _to_int(row.get("development_stage_days", "0")),
                "mid_stage_days": _to_int(row.get("mid_stage_days", "0")),
                "late_stage_days": _to_int(row.get("late_stage_days", "0")),
                "max_root_depth_m": _to_float(row.get("max_root_depth_m", "0")),
                "max_crop_height_m": _to_float(row.get("max_crop_height_m", "0")),
                "depletion_fraction": _to_float(row.get("depletion_fraction", "0")),
            }
            CropType.objects.update_or_create(
                name=crop["name"],
                defaults=crop,
            )

    with open(soil_csv, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            soil = {
                "name": row["name"],
                "texture": row.get("texture", ""),
                "field_capacity": _to_float(row.get("field_capacity", "0")),
                "permanent_wilting_point": _to_float(row.get("permanent_wilting_point", "0")),
                "saturation": _to_float(row.get("saturation", "0")),
                "available_water_mm_per_m": _to_float(row.get("available_water_mm_per_m", "0")),
                "infiltration_rate_mm_hr": _to_float(row.get("infiltration_rate_mm_hr", "0")),
                "hydraulic_conductivity_mm_day": _to_float(row.get("hydraulic_conductivity_mm_day", "0")),
                "bulk_density": _to_float(row.get("bulk_density", "0")),
            }
            SoilType.objects.update_or_create(
                name=soil["name"],
                defaults=soil,
            )



class Migration(migrations.Migration):

    dependencies = [
        ("irrigation_api", "0009_irrigationrecommendation"),
    ]

    operations = [
        migrations.RunPython(seed_types, migrations.RunPython.noop),
    ]
