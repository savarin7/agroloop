from rest_framework.decorators import api_view

from rest_framework.response import Response

from rest_framework import status



from django.contrib.gis.geos import GEOSGeometry

from django.shortcuts import get_object_or_404



from .models import CropType, Field, SoilType

from .serializers import CropTypeSerializer, FieldSerializer, SoilTypeSerializer

from .services import (

    process_et_for_field,

    process_recommendation_for_field,

    process_satellite_for_field,

    process_soil_water_balance_for_field,

    process_weather_for_field,

    serialize_zone_weather,

)

from .kafka.events import TOPIC_FIELD_CREATED, build_event

from .kafka.producer import publish_event



import json





@api_view(["POST"])

def create_field(request):



    try:

        geojson = request.data.get("geometry")

        if geojson is None:

            return Response(

                {"error": "Field geometry is required."},

                status=status.HTTP_400_BAD_REQUEST

            )



        geometry_input = geojson if isinstance(geojson, str) else json.dumps(geojson)



        polygon = GEOSGeometry(

            geometry_input,

            srid=4326

        )



        area_ha = (

            polygon.transform(3857, clone=True).area

            / 10000

        )



        field = Field.objects.create(

            name=request.data.get("name", "Field #1"),

            crop_type_id=request.data.get("crop_type_id", "4"),

            soil_type_id=request.data.get("soil_type_id", "8"),

            planting_date=request.data.get("planting_date") or None,

            geometry=polygon,

            area_ha=round(area_ha, 4)

        )



        publish_event(

            TOPIC_FIELD_CREATED,

            build_event(TOPIC_FIELD_CREATED, field.pk),

        )



        serializer = FieldSerializer(field)



        return Response(

            {

                **serializer.data,

                "pipeline_status": "processing",

                "message": (

                    "Field created. Satellite, weather, ET, soil water balance, "

                    "and recommendation processing has been queued via Kafka."

                ),

            },

            status=status.HTTP_201_CREATED

        )



    except Exception as e:

        return Response(

            {"error": str(e)},

            status=status.HTTP_400_BAD_REQUEST

        )





@api_view(["GET"])

def list_fields(request):

    fields = (

        Field.objects

        .select_related("crop_type", "soil_type")

        .prefetch_related(

            "zones",

            "zones__satellite_data",

            "zones__weather_data",

            "zones__recommendations",

        )

        .order_by("-created_at")

    )



    serializer = FieldSerializer(fields, many=True)

    return Response(serializer.data)





@api_view(["GET"])

def field_detail(request, pk):

    field = get_object_or_404(

        Field.objects

        .select_related("crop_type", "soil_type")

        .prefetch_related(

            "zones",

            "zones__satellite_data",

            "zones__weather_data",

            "zones__recommendations",

        ),

        pk=pk,

    )



    serializer = FieldSerializer(field)

    return Response(serializer.data)





@api_view(["GET"])

def list_crop_types(request):

    serializer = CropTypeSerializer(CropType.objects.all(), many=True)

    return Response(serializer.data)





@api_view(["GET"])

def list_soil_types(request):

    serializer = SoilTypeSerializer(SoilType.objects.all(), many=True)

    return Response(serializer.data)

    



@api_view(["GET"])

def download_satellite(request, pk):

    field = get_object_or_404(Field, pk=pk)



    try:

        result = process_satellite_for_field(field)

    except Exception as e:

        return Response({"error": str(e)}, status=400)



    return Response({

        "status": "success",

        "field_id": result["field_id"],

        "zone_ids": result["zone_ids"],

    })





@api_view(["GET"])

def download_weather(request, pk):

    field = get_object_or_404(Field, pk=pk)



    zone_id = request.query_params.get("zone_id")

    parsed_zone_id = None

    if zone_id is not None:

        try:

            parsed_zone_id = int(zone_id)

        except (TypeError, ValueError):

            return Response(

                {"error": "zone_id must be an integer."},

                status=status.HTTP_400_BAD_REQUEST,

            )



    try:

        result = process_weather_for_field(field, zone_id=parsed_zone_id)

    except ValueError as e:

        return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)



    zones = field.zones.all()

    if parsed_zone_id is not None:

        zones = zones.filter(zone_id=parsed_zone_id)



    zones_data = [serialize_zone_weather(zone) for zone in zones]



    response_data = {

        "message": "Weather data downloaded successfully.",

        "field_id": result["field_id"],

        "zones": zones_data,

    }

    if parsed_zone_id is not None:

        response_data["zone_id"] = parsed_zone_id



    return Response(response_data)





@api_view(["GET"])

def calculate_et(request, pk):

    field = get_object_or_404(Field, pk=pk)

    process_et_for_field(field)



    return Response({

        "message": "Evapotranspiration calculated successfully."

    })





@api_view(["GET"])

def soil_water_balance(request, pk):

    field = get_object_or_404(Field, pk=pk)

    process_soil_water_balance_for_field(field)



    return Response({

        "message": "Soil water balance calculated successfully."

    })





@api_view(["GET"])

def generate_irrigation_recommendation(request, pk):

    field = get_object_or_404(Field, pk=pk)

    result = process_recommendation_for_field(field)



    return Response({

        "message": "Recommendations generated successfully.",

        "recommendations": result["recommendations"],

    })

