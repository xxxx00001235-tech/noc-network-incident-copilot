#!/usr/bin/env bash

set -euo pipefail

API_URL="${NOC_API_URL:-http://127.0.0.1:8000}"

curl --fail --silent --show-error \
  -X POST "${API_URL}/api/alarms" \
  -H "Content-Type: application/json" \
  -H "X-NOC-Role: operator" \
  -d '{
    "device_id": "SW-NG-DIST-01",
    "device_name": "台北南港匯聚交換器",
    "alarm": "DEVICE_DOWN",
    "status": "DOWN",
    "location": "台北南港機房",
    "ip": "10.10.2.1",
    "device_type": "Distribution Switch",
    "severity": "Critical",
    "owner": "Jeff",
    "email": "admin@example.com"
  }'

echo
echo "已送出 SW-NG-DIST-01 DOWN 告警"
