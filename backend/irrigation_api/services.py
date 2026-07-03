"""Business logic for the irrigation pipeline (used by views and Kafka consumers)."""

import json
import random
import os
from functools import lru_cache

from collections import defaultdict
from datetime import timedelta

import numpy as np
import openmeteo_requests
import pandas as pd
import rasterio.features
import requests_cache
from django.contrib.gis.geos import GEOSGeometry, MultiPolygon
from django.db import transaction
from django.utils.dateparse import parse_datetime
from rasterio.io import MemoryFile
from retry_requests import retry
from shapely.geometry import shape
from shapely.ops import unary_union

from .copernicus import NDVI, RVI
from .models import (
    Evapotranspiration,
    Field,
    IrrigationRecommendation,
    SatelliteData,
    SoilWaterBalance,
    Weather,
    Zone,
)
from .serializers import WeatherSerializer
from .zones import create_zone_raster


@lru_cache(maxsize=1)
def _get_residual_model():
    """Load a residual correction model trained on merged_data.csv.

    The repo currently ships only CSVs; if a trained pickle isn't available,
    we train an in-memory RandomForestRegressor the first time we need it.
    """
    model_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "rf_irrigation.pkl"))

    try:
        import joblib  # optional runtime dependency

        if os.path.exists(model_path):
            return joblib.load(model_path)
    except Exception:
        # fall back to training from CSV
        pass

    from sklearn.ensemble import RandomForestRegressor
    from sklearn.compose import ColumnTransformer
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import OneHotEncoder

    merged_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "merged_data.csv"))
    df = pd.read_csv(merged_path)
    df = df.dropna()

    # Expecting merged_data.csv to contain a numeric deficit target; if the dataset
    # uses a different column name, fall back gracefully.
    possible_targets = ["deficit", "actual_deficit", "residual_deficit"]
    target_col = next((c for c in possible_targets if c in df.columns), None)
    if target_col is None:
        # The merged_data.csv shipped in this project is expected to have `deficit`.
        target_col = "deficit"

    # Residual correction predicts the deficit (or residual) that should correct
    # the physically computed water balance.
    y = df[target_col]

    # Use all other numeric weather features + crop/soil identifiers.
    feature_drop = {target_col}
    X = df.drop(columns=list(feature_drop & set(df.columns)))

    categorical = [c for c in ["crop_type", "soil_type"] if c in X.columns]
    numeric = [c for c in X.columns if c not in categorical]

    preprocessor = ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore"), categorical),
            ("num", "passthrough", numeric),
        ]
    )

    model = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("model", RandomForestRegressor(n_estimators=300, random_state=42, n_jobs=-1)),
        ]
    )

    model.fit(X, y)

    # Best-effort persist for next run (optional)
    try:
        import joblib

        joblib.dump(model, model_path)
    except Exception:
        pass

    return model


def apply_residual_correction(
    crop_name: str,
    soil_name: str,
    ndvi: float,
    rvi: float,
    temperature: float,
    humidity: float,
    rainfall: float,
    wind_speed: float,
    soil_moisture: float,
    eto: float,
    etc: float,
    taw: float,
    depletion: float,
    soil_water_balance: float,
) -> float:
    """Correct physicial soil water balance using residual deficit model."""
    model = _get_residual_model()

    payload = pd.DataFrame(
        [
            {
                "crop_type": crop_name,
                "soil_type": soil_name,
                "ndvi": ndvi,
                "rvi": rvi,
                "temperature": temperature,
                "humidity": humidity,
                "rainfall": rainfall,
                "wind_speed": wind_speed,
                "soil_moisture": soil_moisture,
                "eto": eto,
                "etc": etc,
                "taw": taw,
                "depletion": depletion,
                "soil_water_balance": soil_water_balance,
            }
        ]
    )

    predicted_deficit = float(model.predict(payload)[0])
    # Convert predicted deficit into a corrected water balance.
    # If deficit is positive, it reduces the available balance.
    return max(0.0, float(soil_water_balance - predicted_deficit))



def estimate_kc(crop, ndvi, rvi):
    if ndvi < 0.20:
        return crop.kc_initial
    if ndvi < 0.60:
        alpha = (ndvi - 0.20) / 0.40
        return crop.kc_initial + alpha * (crop.kc_mid - crop.kc_initial)
    if ndvi < 0.80:
        return crop.kc_mid
    beta = min((ndvi - 0.80) / 0.20, 1.0)
    return crop.kc_mid - beta * (crop.kc_mid - crop.kc_end)


def calculate_soil_water_balance(
    soil,
    crop,
    weather,
    etc,
    previous_storage,
    irrigation=0,
    runoff=0,
    deep_percolation=0,
):
    taw = (
        (soil.field_capacity - soil.permanent_wilting_point)
        * crop.max_root_depth_m
        * 1000
    )
    rainfall = weather.rain
    swb = previous_storage + rainfall + irrigation - etc - runoff - deep_percolation
    swb = max(0, min(swb, taw))
    depletion = taw - swb
    return taw, depletion, swb


def process_satellite_for_field(field):
    """Download satellite imagery, create zones, and persist SatelliteData."""
    polygon = json.loads(field.geometry.geojson)
    date_to = field.created_at
    date_from = date_to - timedelta(days=90)
    date_from_str = date_from.strftime("%Y-%m-%dT00:00:00Z")
    date_to_str = date_to.strftime("%Y-%m-%dT23:59:59Z")

    response = RVI(polygon, date_from_str, date_to_str)
    response.raise_for_status()

    with MemoryFile(response.content) as mem:
        with mem.open() as src:
            vv = src.read(1)
            vh = src.read(2)
            transform = src.transform

    epsilon = 1e-10
    rvi = (4 * vh) / (vv + vh + epsilon)
    rvi = np.nan_to_num(rvi, nan=0.0, posinf=4.0, neginf=0.0)
    rvi = np.clip(rvi, 0, 4)

    ndvi_response = NDVI(polygon, date_from_str, date_to_str)
    ndvi_response.raise_for_status()

    with MemoryFile(ndvi_response.content) as mem:
        with mem.open() as src:
            ndvi = src.read(1)

    ndvi = np.nan_to_num(
        ndvi, nan=-9999.0, posinf=-9999.0, neginf=-9999.0
    ).astype("float32")

    zone_raster = create_zone_raster(ndvi, rvi)
    polygons = []
    for geom, value in rasterio.features.shapes(
        zone_raster.astype("int16"),
        mask=zone_raster > 0,
        transform=transform,
    ):
        polygons.append({"zone_id": int(value), "geometry": shape(geom)})

    grouped = defaultdict(list)
    for item in polygons:
        grouped[item["zone_id"]].append(item["geometry"])

    zones = []
    for zone_id, geoms in grouped.items():
        zones.append({"zone_id": zone_id, "geometry": unary_union(geoms)})

    zone_ids = []
    with transaction.atomic():
        for zone in zones:
            geom = GEOSGeometry(zone["geometry"].wkt, srid=4326)
            if geom.geom_type == "Polygon":
                geom = MultiPolygon(geom)

            area = geom.transform(3857, clone=True).area
            zone_obj, _ = Zone.objects.update_or_create(
                field=field,
                cluster=zone["zone_id"],
                defaults={"geometry": geom, "area_m2": area},
            )
            zone_ids.append(zone_obj.pk)

            cluster = zone["zone_id"]
            mask = zone_raster == cluster
            zone_ndvi = ndvi[mask]
            zone_rvi = rvi[mask]
            zone_ndvi = zone_ndvi[zone_ndvi != -9999]

            mean_ndvi = float(zone_ndvi.mean()) if len(zone_ndvi) else 0.0
            mean_rvi = float(zone_rvi.mean()) if len(zone_rvi) else 0.0
            acquisition_date = parse_datetime(date_to_str)

            SatelliteData.objects.update_or_create(
                zone=zone_obj,
                acquisition_date=acquisition_date,
                defaults={"ndvi": mean_ndvi, "rvi": mean_rvi},
            )

    return {"zone_ids": zone_ids}


def _download_zone_weather(zone, openmeteo, url):
    centroid = zone.geometry.centroid
    params = {
        "latitude": centroid.y,
        "longitude": centroid.x,
        "hourly": [
            "temperature_2m",
            "relative_humidity_2m",
            "rain",
            "surface_pressure",
            "et0_fao_evapotranspiration",
            "vapour_pressure_deficit",
            "wind_speed_10m",
            "temperature_80m",
            "soil_moisture_1_to_3cm",
            "soil_temperature_6cm",
            "direct_radiation",
        ],
    }

    response = openmeteo.weather_api(url, params=params)[0]
    hourly = response.Hourly()

    dataframe = pd.DataFrame({
        "date": pd.date_range(
            start=pd.to_datetime(hourly.Time(), unit="s", utc=True),
            end=pd.to_datetime(hourly.TimeEnd(), unit="s", utc=True),
            freq=pd.Timedelta(seconds=hourly.Interval()),
            inclusive="left",
        ),
        "temperature_2m": hourly.Variables(0).ValuesAsNumpy(),
        "relative_humidity_2m": hourly.Variables(1).ValuesAsNumpy(),
        "rain": hourly.Variables(2).ValuesAsNumpy(),
        "surface_pressure": hourly.Variables(3).ValuesAsNumpy(),
        "et0_fao_evapotranspiration": hourly.Variables(4).ValuesAsNumpy(),
        "vapour_pressure_deficit": hourly.Variables(5).ValuesAsNumpy(),
        "wind_speed_10m": hourly.Variables(6).ValuesAsNumpy(),
        "temperature_80m": hourly.Variables(7).ValuesAsNumpy(),
        "soil_moisture_1_to_3cm": hourly.Variables(8).ValuesAsNumpy(),
        "soil_temperature_6cm": hourly.Variables(9).ValuesAsNumpy(),
        "direct_radiation": hourly.Variables(10).ValuesAsNumpy(),
    })

    for _, row in dataframe.iterrows():
        Weather.objects.update_or_create(
            zone=zone,
            observation_time=row["date"].to_pydatetime(),
            defaults={
                "temperature_2m": float(row["temperature_2m"]),
                "relative_humidity_2m": float(row["relative_humidity_2m"]),
                "rain": float(row["rain"]),
                "surface_pressure": float(row["surface_pressure"]),
                "et0_fao_evapotranspiration": float(row["et0_fao_evapotranspiration"]),
                "vapour_pressure_deficit": float(row["vapour_pressure_deficit"]),
                "wind_speed_10m": float(row["wind_speed_10m"]),
                "temperature_80m": float(row["temperature_80m"]),
                "soil_moisture_1_to_3cm": float(row["soil_moisture_1_to_3cm"]),
                "soil_temperature_6cm": float(row["soil_temperature_6cm"]),
                "direct_radiation": float(row["direct_radiation"]),
            },
        )


def process_weather_for_field(field, zone_id=None):
    """Download weather forecast data for all zones in a field."""
    if zone_id is not None:
        zones = field.zones.filter(zone_id=zone_id)
        if not zones.exists():
            raise ValueError(f"Zone {zone_id} not found for field {field.pk}.")
    else:
        zones = field.zones.all()

    if not zones.exists():
        raise ValueError(
            f"No zones found for field {field.pk}. Run satellite processing first."
        )

    cache_session = requests_cache.CachedSession(".cache", expire_after=3600)
    retry_session = retry(cache_session, retries=5, backoff_factor=0.2)
    openmeteo = openmeteo_requests.Client(session=retry_session)
    url = "https://api.open-meteo.com/v1/forecast"

    zone_ids = []
    with transaction.atomic():
        for zone in zones:
            _download_zone_weather(zone, openmeteo, url)
            zone_ids.append(zone.pk)

    return {"zone_ids": zone_ids}


def serialize_zone_weather(zone):
    weather_records = zone.weather_data.order_by("observation_time")
    return {
        "zone_id": zone.zone_id,
        "cluster": zone.cluster,
        "weather": WeatherSerializer(weather_records, many=True).data,
    }


def process_et_for_field(field):
    """Calculate evapotranspiration for all zones in a field."""
    with transaction.atomic():
        for zone in field.zones.all():
            crop = field.crop_type
            weather_records = Weather.objects.filter(zone=zone).order_by(
                "observation_time"
            )

            for weather in weather_records:
                satellite = SatelliteData.objects.filter(
                    zone=zone,
                    acquisition_date__date=weather.observation_time.date(),
                ).first()

                if satellite is None:
                    continue

                eto = weather.et0_fao_evapotranspiration
                kc = estimate_kc(crop, satellite.ndvi, satellite.rvi)
                etc = eto * kc

                Evapotranspiration.objects.update_or_create(
                    zone=zone,
                    calculation_time=weather.observation_time,
                    defaults={
                        "weather": weather,
                        "satellite": satellite,
                        "eto": eto,
                        "kc": kc,
                        "etc": etc,
                    },
                )

    zone_ids = list(field.zones.values_list("pk", flat=True))
    return {"zone_ids": zone_ids}


def process_soil_water_balance_for_field(field):
    """Calculate soil water balance for all zones in a field."""
    crop = field.crop_type
    soil = field.soil_type

    with transaction.atomic():
        for zone in field.zones.all():
            et_records = (
                Evapotranspiration.objects.filter(zone=zone)
                .select_related("weather")
                .order_by("calculation_time")
            )

            previous_storage = (
                (soil.field_capacity - soil.permanent_wilting_point)
                * crop.max_root_depth_m
                * 1000
            )

            for et in et_records:
                weather = et.weather
                taw, depletion, swb = calculate_soil_water_balance(
                    soil=soil,
                    crop=crop,
                    weather=weather,
                    etc=et.etc,
                    previous_storage=previous_storage,
                    irrigation=0,
                    runoff=0,
                    deep_percolation=0,
                )

                SoilWaterBalance.objects.update_or_create(
                    zone=zone,
                    calculation_time=et.calculation_time,
                    defaults={
                        "weather": weather,
                        "evapotranspiration": et,
                        "taw": taw,
                        "depletion": depletion,
                        "soil_water_balance": swb,
                    },
                )
                previous_storage = swb

    zone_ids = list(field.zones.values_list("pk", flat=True))
    return {"zone_ids": zone_ids}


def process_recommendation_for_field(field):
    """Generate irrigation recommendations for all zones in a field."""
    crop = field.crop_type
    soil = field.soil_type
    recommendations = []

    with transaction.atomic():
        for zone in field.zones.all():
            swb = (
                SoilWaterBalance.objects.filter(zone=zone)
                .select_related("weather", "evapotranspiration")
                .order_by("-calculation_time")
                .first()
            )

            if swb is None:
                continue

            weather = swb.weather
            et = swb.evapotranspiration

            satellite = (
                SatelliteData.objects.filter(zone=zone)
                .order_by("-acquisition_date")
                .first()
            )

            if satellite is None:
                continue

            mad = swb.taw * crop.depletion_fraction
            irrigation_required = swb.depletion >= mad
            irrigation_amount = 0
            zone_colour = "#4CAF50"

            if irrigation_required:
                pd.DataFrame([{
                    "ndvi": satellite.ndvi,
                    "rvi": satellite.rvi,
                    "temperature": weather.temperature_2m,
                    "humidity": weather.relative_humidity_2m,
                    "rainfall": weather.rain,
                    "wind_speed": weather.wind_speed_10m,
                    "soil_moisture": weather.soil_moisture_1_to_3cm,
                    "eto": et.eto,
                    "etc": et.etc,
                    "taw": swb.taw,
                    "depletion": swb.depletion,
                    "soil_water_balance": swb.soil_water_balance,
                    "crop_type": crop.name,
                    "soil_type": soil.name,
                }])

            # Residual correction using RandomForest trained on merged_data.csv
            corrected_water_balance = swb.soil_water_balance
            if irrigation_required:
                corrected_water_balance = apply_residual_correction(
                    crop_name=crop.name,
                    soil_name=soil.name,
                    ndvi=float(satellite.ndvi),
                    rvi=float(satellite.rvi),
                    temperature=float(weather.temperature_2m),
                    humidity=float(weather.relative_humidity_2m),
                    rainfall=float(weather.rain),
                    wind_speed=float(weather.wind_speed_10m),
                    soil_moisture=float(weather.soil_moisture_1_to_3cm),
                    eto=float(et.eto),
                    etc=float(et.etc),
                    taw=float(swb.taw),
                    depletion=float(swb.depletion),
                    soil_water_balance=float(swb.soil_water_balance),
                )

            IrrigationRecommendation.objects.update_or_create(
                zone=zone,
                recommendation_time=swb.calculation_time,
                defaults={
                    "soil_water_balance": swb,
                    "mad": mad,
                    "corrected_water_balance": corrected_water_balance,
                    "irrigation_required": irrigation_required,
                    "recommended_amount": irrigation_amount,
                    "zone_color": zone_colour,
                },
            )

            recommendations.append({
                "zone": zone.cluster,
                "mad": mad,
                "depletion": swb.depletion,
                "triggered": irrigation_required,
                "recommended_amount": irrigation_amount,
                "colour": zone_colour,
            })

    return { "recommendations": recommendations }
