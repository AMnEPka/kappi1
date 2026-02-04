#!/usr/bin/env bash

set -eo pipefail  

if [ -z "${CHECK_OUTPUT:-}" ]; then
    exit 51 # Отсутствует переменная
fi

# Ищем строку с auth required pam_wheel.so в полученных данных
# ИСПРАВЛЕНО: используем два шага для правильного поиска
# Шаг 1: находим все строки с auth required pam_wheel.so (включая закомментированные)
# Шаг 2: исключаем закомментированные строки (которые начинаются с # после пробелов)
# Это правильный способ, так как bash не поддерживает negative lookahead
line="$(echo "$CHECK_OUTPUT" | grep -E 'auth[[:space:]]+required[[:space:]]+pam_wheel\.so' | grep -vE '^[[:space:]]*#' || true)"

if [[ -z "$line" ]]; then
    # Проверим, может закомментирована
    if echo "$CHECK_OUTPUT" | grep -qE '^[[:space:]]*#.*auth[[:space:]]+required[[:space:]]+pam_wheel\.so'; then
        exit 42 # Строка закомментирована → "Не пройдена"
    fi
    exit 41 # Строка не найдена → "Не пройдена"
fi

# Если строка найдена и не закомментирована, проверка пройдена
echo "Пройдена"
exit 0
