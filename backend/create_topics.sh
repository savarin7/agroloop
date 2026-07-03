#!/bin/bash

TOPICS=(
  field.created
  satellite.completed
  weather.completed
  et.completed
  swb.completed
  recommendation.completed
)

for topic in "${TOPICS[@]}"
do
  docker exec kafka /opt/kafka/bin/kafka-topics.sh \
    --bootstrap-server localhost:9092 \
    --create \
    --topic $topic \
    --partitions 1 \
    --replication-factor 1
done