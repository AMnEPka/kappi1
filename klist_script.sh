#!/usr/bin/env bash

set -eo pipefail  

if [ -z "${CHECK_OUTPUT:-}" ]; then
    exit 51 # Отсутствует переменная
fi

# Проверяем наличие кэшированных билетов в выводе klist
# Паттерн: "Cached Tickets:" с любым количеством пробелов, затем "(" и любая цифра кроме 0
# Примеры: "Cached Tickets: (1)", "Cached Tickets:  (2)", "Cached Tickets:(3)"
if echo "$CHECK_OUTPUT" | grep -qE 'Cached Tickets:[[:space:]]*\([1-9][0-9]*\)'; then
    echo "Пройдена"
    exit 0
else
    # Проверим, может билетов нет (0) или строка отсутствует
    if echo "$CHECK_OUTPUT" | grep -qE 'Cached Tickets:[[:space:]]*\(0\)'; then
        exit 44 # Кэшированных билетов нет (0) → "Не пройдена"
    else
        exit 41 # Строка "Cached Tickets" не найдена или формат неверный → "Не пройдена"
    fi
fi
