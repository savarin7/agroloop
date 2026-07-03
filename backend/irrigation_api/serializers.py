from rest_framework import serializers
import json

from .models import (
    CropType,
    Field,
    IrrigationRecommendation,
    SatelliteData,
    SoilType,
    Weather,
    Zone,
)


class CropTypeSerializer(serializers.ModelSerializer):

    class Meta:
        model = CropType
        # Used by frontend for dropdowns; keep payload minimal.
        fields = [
            "crop_id",
            "name",
        ]



class SoilTypeSerializer(serializers.ModelSerializer):

    class Meta:
        model = SoilType
        # Used by frontend for dropdowns; keep payload minimal.
        fields = [
            "soil_id",
            "name",
        ]



class SatelliteDataSerializer(serializers.ModelSerializer):

    class Meta:
        model = SatelliteData
        fields = [
            "sat_id",
            "acquisition_date",
            "ndvi",
            "rvi",
        ]


class WeatherSerializer(serializers.ModelSerializer):

    class Meta:
        model = Weather
        fields = [
            "weather_id",
            "observation_time",
            "temperature_2m",
            "relative_humidity_2m",
            "rain",
            "surface_pressure",
            "et0_fao_evapotranspiration",
            "wind_speed_10m",
            "soil_moisture_1_to_3cm",
            "soil_temperature_6cm",
        ]


class IrrigationRecommendationSerializer(serializers.ModelSerializer):

    class Meta:
        model = IrrigationRecommendation
        fields = [
            "recommendation_id",
            "recommendation_time",
            "mad",
            "corrected_water_balance",
            "irrigation_required",
            "recommended_amount",
            "actual_amount",
            "zone_color",
        ]


class ZoneSerializer(serializers.ModelSerializer):
    geometry = serializers.SerializerMethodField()
    satellite_data = serializers.SerializerMethodField()
    latest_satellite = serializers.SerializerMethodField()
    latest_weather = serializers.SerializerMethodField()
    latest_recommendation = serializers.SerializerMethodField()

    class Meta:
        model = Zone
        fields = [
            "zone_id",
            "cluster",
            "area_m2",
            "geometry",
            "satellite_data",
            "latest_satellite",
            "latest_weather",
            "latest_recommendation",
            "created_at",
        ]

    def get_geometry(self, obj):
        return json.loads(obj.geometry.geojson) if obj.geometry else None

    def get_satellite_data(self, obj):
        queryset = obj.satellite_data.all().order_by("-acquisition_date")[:12]
        return SatelliteDataSerializer(queryset, many=True).data

    def get_latest_satellite(self, obj):
        satellite = obj.satellite_data.order_by("-acquisition_date").first()
        return SatelliteDataSerializer(satellite).data if satellite else None

    def get_latest_weather(self, obj):
        weather = obj.weather_data.order_by("-observation_time").first()
        return WeatherSerializer(weather).data if weather else None

    def get_latest_recommendation(self, obj):
        recommendation = obj.recommendations.order_by("-recommendation_time").first()
        return IrrigationRecommendationSerializer(recommendation).data if recommendation else None


class FieldSerializer(serializers.ModelSerializer):
    geometry = serializers.SerializerMethodField()
    crop_type = CropTypeSerializer(read_only=True)
    soil_type = SoilTypeSerializer(read_only=True)
    zones = ZoneSerializer(many=True, read_only=True)

    class Meta:
        model = Field
        fields = [
            "id",
            "name",
            "planting_date",
            "area_ha",
            "geometry",
            "crop_type",
            "crop_type_id",
            "soil_type",
            "soil_type_id",
            "zones",
            "created_at",
            "updated_at",
        ]

    def get_geometry(self, obj):
        return json.loads(obj.geometry.geojson) if obj.geometry else None
