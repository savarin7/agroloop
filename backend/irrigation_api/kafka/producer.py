"""Kafka producer for publishing pipeline events."""

import json
import logging

from confluent_kafka import Producer
from django.conf import settings

from .events import get_bootstrap_servers

logger = logging.getLogger(__name__)

_producer = None


def get_producer():
    global _producer
    if _producer is None:
        config = {
            "bootstrap.servers": get_bootstrap_servers(),
            "client.id": settings.KAFKA_CONFIG.get(
                "client.id", "agrigrow-django-producer"
            ),
        }
        _producer = Producer(config)
    return _producer


def _delivery_callback(err, msg):
    if err:
        logger.error("Kafka delivery failed for %s: %s", msg.topic(), err)
    else:
        logger.info(
            "Event delivered to %s [partition %s @ offset %s]",
            msg.topic(),
            msg.partition(),
            msg.offset(),
        )


def publish_event(topic, payload):
    """Publish a JSON event to the given Kafka topic."""
    producer = get_producer()
    producer.produce(
        topic,
        value=json.dumps(payload).encode("utf-8"),
        callback=_delivery_callback,
    )
    producer.flush(timeout=10)
