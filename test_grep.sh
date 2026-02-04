#!/usr/bin/env bash
CHECK_OUTPUT="[sssd]
config_version=2
services = pam

[domain/ad.example.com]
auth_provider = ad

simple_allow_users = user1,user2,user3
simple_allow_groups = group1,group1,group3"

# Старое регулярное выражение (неправильное)
echo "=== Старое (неправильное) ==="
line_old="$(echo "$CHECK_OUTPUT" | grep -E '^[[:space:]]*[^#[:space:]]simple_allow_users[[:space:]]*=' || true)"
echo "Результат: '$line_old'"

# Новое регулярное выражение (правильное)
echo "=== Новое (правильное) ==="
line_new="$(echo "$CHECK_OUTPUT" | grep -E '^[[:space:]]*simple_allow_users[[:space:]]*=' | grep -vE '^[[:space:]]*#' || true)"
echo "Результат: '$line_new'"
