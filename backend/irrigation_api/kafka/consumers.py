"""Kafka consumer handlers for the irrigation pipeline."""

import json
import logging

from confluent_kafka import Consumer, KafkaException
from django.shortcuts import get_object_or_404

from irrigation_api.models import Field
from irrigation_api.services import (
    process_et_for_field,
    process_recommendation_for_field,
    process_satellite_for_field,
    process_soil_water_balance_for_field,
    process_weather_for_field,
)

from .events import (
    ALL_TOPICS,
    TOPIC_ET_COMPLETED,
    TOPIC_FIELD_CREATED,
    TOPIC_RECOMMENDATION_COMPLETED,
    TOPIC_SATELLITE_COMPLETED,
    TOPIC_SWB_COMPLETED,
    TOPIC_WEATHER_COMPLETED,
    build_event,
    get_bootstrap_servers,
)
from .producer import publish_event

logger = logging.getLogger(__name__)


def _parse_message(msg):
    payload = json.loads(msg.value().decode("utf-8"))
    field_id = payload.get("field_id")
    if field_id is None:
        raise ValueError(f"Missing field_id in event: {payload}")
    return field_id, payload


def handle_field_created(field_id, _payload):
    """Satellite consumer: download imagery and create zones."""
    field = get_object_or_404(Field, pk=field_id)
    logger.info("Processing satellite data for field %s", field_id)
    result = process_satellite_for_field(field)
    publish_event(
        TOPIC_SATELLITE_COMPLETED,
        build_event(TOPIC_SATELLITE_COMPLETED, field_id, **result),
    )
    logger.info("Satellite processing completed for field %s", field_id)


def handle_satellite_completed(field_id, _payload):
    """Weather consumer: fetch forecast data for each zone."""
    field = get_object_or_404(Field, pk=field_id)
    logger.info("Processing weather data for field %s", field_id)
    result = process_weather_for_field(field)
    publish_event(
        TOPIC_WEATHER_COMPLETED,
        build_event(TOPIC_WEATHER_COMPLETED, field_id, **result),
    )
    logger.info("Weather processing completed for field %s", field_id)


def handle_weather_completed(field_id, _payload):
    """ET calculation consumer."""
    field = get_object_or_404(Field, pk=field_id)
    logger.info("Calculating ET for field %s", field_id)
    result = process_et_for_field(field)
    publish_event(
        TOPIC_ET_COMPLETED,
        build_event(TOPIC_ET_COMPLETED, field_id, **result),
    )
    logger.info("ET calculation completed for field %s", field_id)


def handle_et_completed(field_id, _payload):
    """Soil water balance consumer."""
    field = get_object_or_404(Field, pk=field_id)
    logger.info("Calculating soil water balance for field %s", field_id)
    result = process_soil_water_balance_for_field(field)
    publish_event(
        TOPIC_SWB_COMPLETED,
        build_event(TOPIC_SWB_COMPLETED, field_id, **result),
    )
    logger.info("Soil water balance completed for field %s", field_id)


def handle_swb_completed(field_id, _payload):
    """Recommendation consumer."""
    field = get_object_or_404(Field, pk=field_id)
    logger.info("Generating recommendations for field %s", field_id)
    result = process_recommendation_for_field(field)
    publish_event(
        TOPIC_RECOMMENDATION_COMPLETED,
        build_event(TOPIC_RECOMMENDATION_COMPLETED, field_id, **result),
    )
    logger.info("Pipeline completed for field %s", field_id)

def handle_recommendation_completed(field_id, payload):
    logger.info("Pipeline completed successfully for field %s", field_id)


TOPIC_HANDLERS = {
    TOPIC_FIELD_CREATED: handle_field_created,
    TOPIC_SATELLITE_COMPLETED: handle_satellite_completed,
    TOPIC_WEATHER_COMPLETED: handle_weather_completed,
    TOPIC_ET_COMPLETED: handle_et_completed,
    TOPIC_SWB_COMPLETED: handle_swb_completed,
    TOPIC_RECOMMENDATION_COMPLETED: handle_recommendation_completed,
}


def dispatch_event(topic, field_id, payload):
    handler = TOPIC_HANDLERS.get(topic)
    if handler is None:
        logger.warning("No handler registered for topic %s", topic)
        return
    handler(field_id, payload)


def create_consumer():
    config = {
        "bootstrap.servers": get_bootstrap_servers(),
        "group.id": "agrigrow-pipeline",
        "auto.offset.reset": "earliest",
        "enable.auto.commit": False,
    }
    consumer = Consumer(config)
    consumer.subscribe(ALL_TOPICS)
    return consumer


def run_consumer_loop():
    """Poll Kafka and dispatch events to pipeline handlers."""
    consumer = create_consumer()
    logger.info("Kafka consumer started, subscribed to: %s", ", ".join(ALL_TOPICS))

    try:
        while True:
            msg = consumer.poll(timeout=1.0)
            if msg is None:
                continue
            if msg.error():
                raise KafkaException(msg.error())

            topic = msg.topic()
            try:
                field_id, payload = _parse_message(msg)
                logger.info("Received %s for field %s", topic, field_id)
                dispatch_event(topic, field_id, payload)
                consumer.commit(asynchronous=False)
            except Exception:
                logger.exception(
                    "Failed to process %s message for field pipeline",
                    topic,
                )
    except KeyboardInterrupt:
        logger.info("Shutting down Kafka consumer")
    finally:
        consumer.close()
