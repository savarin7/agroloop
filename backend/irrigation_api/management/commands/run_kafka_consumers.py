"""Run Kafka consumers for the irrigation pipeline."""

import logging

from django.core.management.base import BaseCommand

from irrigation_api.kafka.consumers import run_consumer_loop

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = (
        "Start Kafka consumers that orchestrate the field processing pipeline: "
        "satellite -> weather -> ET -> soil water balance -> recommendation"
    )

    def handle(self, *args, **options):
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        )
        self.stdout.write(self.style.SUCCESS("Starting Kafka pipeline consumers..."))
        run_consumer_loop()
