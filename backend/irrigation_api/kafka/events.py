from django.conf import settings
from django.utils import timezone

TOPIC_FIELD_CREATED = "field.created"
TOPIC_SATELLITE_COMPLETED = "satellite.completed"
TOPIC_WEATHER_COMPLETED = "weather.completed"
TOPIC_ET_COMPLETED = "et.completed"
TOPIC_SWB_COMPLETED = "swb.completed"
TOPIC_RECOMMENDATION_COMPLETED = "recommendation.completed"

ALL_TOPICS = [
    TOPIC_FIELD_CREATED,
    TOPIC_SATELLITE_COMPLETED,
    TOPIC_WEATHER_COMPLETED,
    TOPIC_ET_COMPLETED,
    TOPIC_SWB_COMPLETED,
    TOPIC_RECOMMENDATION_COMPLETED,
]


def build_event(event_type, field_id, **extra):
    """Build a standard pipeline event payload."""
    payload = {
        "event_type": event_type,
        "field_id": field_id,
        "timestamp": timezone.now().isoformat(),
    }
    payload.update(extra)
    return payload


def get_bootstrap_servers():
    return settings.KAFKA_CONFIG.get("bootstrap.servers", "localhost:9092")
