#!/usr/bin/env bash

set -eo pipefail

# CHECK_OUTPUT — вывод команды "sudo systemctl is-active auditd"
# Проверяем, что служба auditd активна
# Если ответ "active", то "Пройдена"

if [ -z "${CHECK_OUTPUT:-}" ]; then
    exit 51 # Отсутствует переменная
fi

# Убираем ведущие и завершающие пробелы, переводы строк
status=$(echo "$CHECK_OUTPUT" | tr -d '\n\r' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

# Проверяем, что статус равен "active"
if [[ "$status" == "active" ]]; then
    echo "Пройдена"
    exit 0
else
    echo "Служба auditd не активна (статус: '$status')"
    echo "Ожидается: active"
    echo "Не пройдена"
    exit 44 # Неверное значение → "Не пройдена"
fi
