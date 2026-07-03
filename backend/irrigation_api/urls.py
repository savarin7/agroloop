from django.urls import path

from .auth_views import SigninView, SignupView
from .views import (
    calculate_et,
    create_field,
    download_satellite,
    download_weather,
    soil_water_balance,
    field_detail,
    generate_irrigation_recommendation,
    list_crop_types,
    list_fields,
    list_soil_types,
)


urlpatterns = [
    path("fields/", list_fields, name="list_fields"),
    path("fields/<int:pk>/", field_detail, name="field_detail"),
    path("field/create/", create_field, name="create_field"),
    path("crop-types/", list_crop_types, name="list_crop_types"),
    path("soil-types/", list_soil_types, name="list_soil_types"),
    path("download-satellite/<int:pk>/", download_satellite, name="download-satellite"),
    path("download-weather/<int:pk>/", download_weather, name="download-weather"),
    path("calculate-et/<int:pk>/", calculate_et, name="calculate-et"),
    path("soil_water_balance/<int:pk>/", soil_water_balance, name="soil_water_balance"),
    path("recommendation/<int:pk>/", generate_irrigation_recommendation, name="recommendation"),
]
