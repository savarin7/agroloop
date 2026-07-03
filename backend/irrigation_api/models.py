from django.contrib.gis.db import models

class CropType(models.Model):

    crop_id = models.AutoField(primary_key=True)

    name = models.CharField(
        max_length=100,
        unique=True
    )

    scientific_name = models.CharField(
        max_length=150,
        blank=True
    )

    # FAO-56 Crop Coefficients
    kc_initial = models.FloatField()
    kc_mid = models.FloatField()
    kc_end = models.FloatField()

    # Growth stages (days)
    initial_stage_days = models.PositiveSmallIntegerField()
    development_stage_days = models.PositiveSmallIntegerField()
    mid_stage_days = models.PositiveSmallIntegerField()
    late_stage_days = models.PositiveSmallIntegerField()

    # Root characteristics
    max_root_depth_m = models.FloatField()

    # Crop height (used in FAO adjustments)
    max_crop_height_m = models.FloatField()

    depletion_fraction = models.FloatField(
        help_text="Fraction of Total Available Water (p)"
    )

    description = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "crop_type"
        ordering = ["name"]

    def __str__(self):
        return self.name
    
class SoilType(models.Model):

    soil_id = models.AutoField(primary_key=True)

    name = models.CharField(
        max_length=100,
        unique=True
    )

    texture = models.CharField(
        max_length=50
    )

    field_capacity = models.FloatField(
        help_text="Volumetric water content at field capacity (m³/m³)"
    )

    permanent_wilting_point = models.FloatField(
        help_text="Volumetric water content at permanent wilting point (m³/m³)"
    )

    saturation = models.FloatField(
        help_text="Volumetric water content at saturation (m³/m³)"
    )

    available_water_mm_per_m = models.FloatField(
        help_text="Available water capacity (mm/m)"
    )

    infiltration_rate_mm_hr = models.FloatField()

    hydraulic_conductivity_mm_day = models.FloatField()

    bulk_density = models.FloatField(
        help_text="g/cm³"
    )

    description = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "soil_type"
        ordering = ["name"]

    def __str__(self):
        return self.name

class Field(models.Model):
    name = models.CharField(max_length=255)
    planting_date = models.DateField(null=True, blank=True)

    area_ha = models.DecimalField(max_digits=12, decimal_places=4)

    geometry = models.PolygonField(srid=4326)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    crop_type = models.ForeignKey(
        CropType,
        on_delete=models.PROTECT,
        related_name="fields"
    )

    soil_type = models.ForeignKey(
        SoilType,
        on_delete=models.PROTECT,
        related_name="fields"
    )

class Zone(models.Model):

    zone_id = models.AutoField(primary_key=True)

    field = models.ForeignKey(
        "Field",
        on_delete=models.CASCADE,
        related_name="zones"
    )

    geometry = models.MultiPolygonField(
        srid=4326
    )

    cluster = models.PositiveSmallIntegerField()

    area_m2 = models.FloatField()

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "zone"

        constraints = [
            models.UniqueConstraint(
                fields=["field", "cluster"],
                name="unique_field_cluster"
            )
        ]


class SatelliteData(models.Model):

    sat_id = models.AutoField(primary_key=True)

    zone = models.ForeignKey(
        Zone,
        on_delete=models.CASCADE,
        related_name="satellite_data"
    )

    acquisition_date = models.DateTimeField()

    ndvi = models.FloatField()

    rvi = models.FloatField()

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "satellite_data"

        ordering = ["-acquisition_date"]

        indexes = [
            models.Index(fields=["zone", "acquisition_date"])
        ]

        constraints = [
            models.UniqueConstraint(
                fields=["zone", "acquisition_date"],
                name="unique_zone_date"
            )
        ]

class Weather(models.Model):

    weather_id = models.AutoField(primary_key=True)

    zone = models.ForeignKey(
        Zone,
        on_delete=models.CASCADE,
        related_name="weather_data"
    )

    observation_time = models.DateTimeField()

    # Air weather
    temperature_2m = models.FloatField()
    relative_humidity_2m = models.FloatField()
    rain = models.FloatField()
    surface_pressure = models.FloatField()
    et0_fao_evapotranspiration = models.FloatField()
    vapour_pressure_deficit = models.FloatField()
    wind_speed_10m = models.FloatField()
    temperature_80m = models.FloatField()

    # Soil
    soil_moisture_1_to_3cm = models.FloatField()
    soil_temperature_6cm = models.FloatField()

    # Solar
    direct_radiation = models.FloatField()

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "weather"

        ordering = ["-observation_time"]

        indexes = [
            models.Index(
                fields=["zone", "observation_time"]
            )
        ]

        constraints = [
            models.UniqueConstraint(
                fields=["zone", "observation_time"],
                name="unique_zone_weather_datetime"
            )
        ]

    def __str__(self):
        return f"{self.zone} - {self.observation_time}"
    
class Evapotranspiration(models.Model):

    et_id = models.AutoField(primary_key=True)

    zone = models.ForeignKey(
        Zone,
        on_delete=models.CASCADE,
        related_name="evapotranspiration"
    )

    weather = models.ForeignKey(
        Weather,
        on_delete=models.CASCADE,
        related_name="evapotranspiration"
    )

    satellite = models.ForeignKey(
        SatelliteData,
        on_delete=models.CASCADE,
        related_name="evapotranspiration"
    )

    calculation_time = models.DateTimeField()

    eto = models.FloatField(
        help_text="Reference evapotranspiration (mm)"
    )

    kc = models.FloatField(
        help_text="Crop coefficient"
    )

    etc = models.FloatField(
        help_text="Crop evapotranspiration (mm)"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:

        db_table = "evapotranspiration"

        ordering = ["-calculation_time"]

        constraints = [
            models.UniqueConstraint(
                fields=["zone", "calculation_time"],
                name="unique_zone_et"
            )
        ]

    def __str__(self):
        return f"{self.zone} - {self.calculation_time}"
    
class SoilWaterBalance(models.Model):

    swb_id = models.AutoField(primary_key=True)

    zone = models.ForeignKey(
        Zone,
        on_delete=models.CASCADE,
        related_name="soil_water_balance"
    )

    weather = models.ForeignKey(
        Weather,
        on_delete=models.CASCADE,
        related_name="soil_water_balance"
    )

    evapotranspiration = models.ForeignKey(
        Evapotranspiration,
        on_delete=models.CASCADE,
        related_name="soil_water_balance"
    )

    calculation_time = models.DateTimeField()

    taw = models.FloatField(
        help_text="Total Available Water (mm)"
    )

    depletion = models.FloatField(
        help_text="Root zone depletion (mm)"
    )

    soil_water_balance = models.FloatField(
        help_text="Available soil water after the balance update (mm)"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:

        db_table = "soil_water_balance"

        ordering = ["-calculation_time"]

        constraints = [
            models.UniqueConstraint(
                fields=["zone", "calculation_time"],
                name="unique_zone_soil_water_balance"
            )
        ]

    def __str__(self):
        return f"{self.zone} {self.calculation_time}"

class IrrigationRecommendation(models.Model):

    recommendation_id = models.AutoField(primary_key=True)

    zone = models.ForeignKey(
        Zone,
        on_delete=models.CASCADE,
        related_name="recommendations"
    )

    soil_water_balance = models.ForeignKey(
        SoilWaterBalance,
        on_delete=models.CASCADE,
        related_name="recommendations"
    )

    recommendation_time = models.DateTimeField()

    mad = models.FloatField()

    corrected_water_balance = models.FloatField()

    irrigation_required = models.BooleanField()

    recommended_amount = models.FloatField()

    actual_amount = models.FloatField(
        null=True,
        blank=True,
        help_text="Actual irrigation applied (training label)"
    )

    zone_color = models.CharField(max_length=7, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)