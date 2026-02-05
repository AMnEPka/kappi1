#!/usr/bin/env bash

set -eo pipefail

# CHECK_OUTPUT — вывод команды "cat /var/log/audit/audit.log" (или "sudo cat /var/log/audit/audit.log")
# Проверяем, что в журнале содержатся события за последние 90 дней
# Формат audit.log: type=... msg=audit(1234567890.123:456): ... где 1234567890.123 - Unix timestamp

if [ -z "${CHECK_OUTPUT:-}" ]; then
    exit 51 # Отсутствует переменная
fi

# Вычисляем timestamp для даты 90 дней назад
# Получаем текущий timestamp и вычитаем 90 дней (в секундах)
current_timestamp=$(date +%s)
days_ago_90=$((current_timestamp - 90 * 24 * 60 * 60))

# Извлекаем все timestamps из лог-файла
# Формат: msg=audit(1234567890.123:456): где 1234567890.123 - timestamp
# Используем grep для поиска всех строк с msg=audit(...) и извлекаем timestamp
timestamps=$(echo "$CHECK_OUTPUT" | grep -oE 'msg=audit\([0-9]+\.[0-9]+:[0-9]+\)' | sed -E 's/msg=audit\(([0-9]+)\.[0-9]+:[0-9]+\)/\1/' || true)

if [[ -z "$timestamps" ]]; then
    echo "Не найдено событий в журнале audit.log"
    echo "Не пройдена"
    exit 44 # Неверное значение → "Не пройдена"
fi

# Проверяем, есть ли хотя бы одно событие за последние 90 дней
found_recent_event=false

while IFS= read -r timestamp_str; do
    # Пропускаем пустые строки
    if [[ -z "$timestamp_str" ]]; then
        continue
    fi
    
    # Проверяем, что timestamp больше или равен дате 90 дней назад
    if [[ "$timestamp_str" -ge "$days_ago_90" ]]; then
        found_recent_event=true
        break
    fi
done <<< "$timestamps"

# Проверяем результат
if [[ "$found_recent_event" == true ]]; then
    echo "Пройдена"
    exit 0
else
    echo "В журнале audit.log не найдено событий за последние 90 дней"
    echo "Не пройдена"
    exit 44 # Неверное значение → "Не пройдена"
fi
