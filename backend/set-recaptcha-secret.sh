#!/usr/bin/env bash
#
# Sets RECAPTCHA_SECRET on the chisl-contact Lambda.
#
# Why a script rather than a one-liner: `update-function-configuration
# --environment` REPLACES the whole variable map. Passing just the secret would
# silently drop TOPIC_ARN, ALLOWED_ORIGIN, SMS_MAX_CHARS and
# RECAPTCHA_MIN_SCORE — and a missing TOPIC_ARN makes the function return 500
# on every submission. This reads the current map, merges the secret in, and
# writes the whole thing back.
#
# The secret is read with `read -s`, so it is never echoed to the terminal and
# never lands in your shell history.
#
# Usage:  ./set-recaptcha-secret.sh

set -euo pipefail

FUNCTION=chisl-contact
REGION=eu-west-2
PROFILE=${AWS_PROFILE:-styx}

command -v jq >/dev/null || { echo "error: jq is required" >&2; exit 1; }

read -rsp "reCAPTCHA v3 SECRET key (input hidden): " SECRET
echo
[ -n "$SECRET" ] || { echo "error: no secret entered" >&2; exit 1; }

echo "Reading current environment..."
CURRENT=$(aws lambda get-function-configuration \
  --function-name "$FUNCTION" --region "$REGION" --profile "$PROFILE" \
  --query 'Environment.Variables' --output json)

echo "Current variables: $(echo "$CURRENT" | jq -r 'keys | join(", ")')"

PAYLOAD=$(jq -n \
  --arg fn "$FUNCTION" \
  --argjson vars "$(echo "$CURRENT" | jq --arg s "$SECRET" '. + {RECAPTCHA_SECRET: $s}')" \
  '{FunctionName: $fn, Environment: {Variables: $vars}}')

aws lambda update-function-configuration \
  --region "$REGION" --profile "$PROFILE" \
  --cli-input-json "$PAYLOAD" >/dev/null

aws lambda wait function-updated --function-name "$FUNCTION" --region "$REGION" --profile "$PROFILE"

# Confirm the secret is set without printing it.
aws lambda get-function-configuration \
  --function-name "$FUNCTION" --region "$REGION" --profile "$PROFILE" \
  --query 'Environment.Variables' --output json \
  | jq -r 'to_entries | map(if .key == "RECAPTCHA_SECRET" then "\(.key) = <set, \(.value | length) chars>" else "\(.key) = \(.value)" end) | .[]'

echo
echo "Done. Verify spam protection is active:"
echo "  curl -s -X POST https://dngcc8ftia.execute-api.eu-west-2.amazonaws.com/ \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"name\":\"T\",\"email\":\"t@example.com\",\"phone\":\"+447700900123\",\"message\":\"hi\"}'"
echo
echo "Expected: {\"error\":\"Missing spam-check token\"}  <- the check is live"
