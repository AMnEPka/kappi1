#!/usr/bin/env bash

set -eo pipefail

# CHECK_OUTPUT — вывод команд "grep PASS /etc/login.defs; grep LOGIN /etc/login.defs"
# Ищем значения:
#   PASS_MIN_DAYS – 1
#   PASS_WARN_AGE – 14
#   LOGIN_RETRIES = 10
#   LOGIN_TIMEOUT = 1800

if [ -z "${CHECK_OUTPUT:-}" ]; then
    exit 51 # Отсутствует переменная
fi

# Функция для извлечения значения параметра из вывода
# Формат в файле может быть: PARAM_NAME value или PARAM_NAME=value или PARAM_NAME	value
# Исключаем закомментированные строки (начинающиеся с #)
get_param_value() {
    local param_name="$1"
    # Ищем строку с параметром (не закомментированную), извлекаем значение (число после пробелов/табов/равно)
    echo "$CHECK_OUTPUT" | grep -iE "^[[:space:]]*${param_name}[[:space:]=]+" | \
        grep -vE '^[[:space:]]*#' | \
        sed -E "s/^[[:space:]]*${param_name}[[:space:]=]+([0-9]+).*/\1/" | head -1
}

# Проверяем наличие и значения параметров
errors=()
missing_params=()

# PASS_MIN_DAYS должен быть 1
pass_min_days=$(get_param_value "PASS_MIN_DAYS")
if [[ -z "$pass_min_days" ]]; then
    missing_params+=("PASS_MIN_DAYS")
elif [[ "$pass_min_days" != "1" ]]; then
    errors+=("PASS_MIN_DAYS=$pass_min_days (ожидается: 1)")
fi

# PASS_WARN_AGE должен быть 14
pass_warn_age=$(get_param_value "PASS_WARN_AGE")
if [[ -z "$pass_warn_age" ]]; then
    missing_params+=("PASS_WARN_AGE")
elif [[ "$pass_warn_age" != "14" ]]; then
    errors+=("PASS_WARN_AGE=$pass_warn_age (ожидается: 14)")
fi

# LOGIN_RETRIES должен быть 10
login_retries=$(get_param_value "LOGIN_RETRIES")
if [[ -z "$login_retries" ]]; then
    missing_params+=("LOGIN_RETRIES")
elif [[ "$login_retries" != "10" ]]; then
    errors+=("LOGIN_RETRIES=$login_retries (ожидается: 10)")
fi

# LOGIN_TIMEOUT должен быть 1800
login_timeout=$(get_param_value "LOGIN_TIMEOUT")
if [[ -z "$login_timeout" ]]; then
    missing_params+=("LOGIN_TIMEOUT")
elif [[ "$login_timeout" != "1800" ]]; then
    errors+=("LOGIN_TIMEOUT=$login_timeout (ожидается: 1800)")
fi

# Если есть ошибки или отсутствующие параметры - выводим информацию и "Не пройдена"
if [[ ${#missing_params[@]} -gt 0 ]] || [[ ${#errors[@]} -gt 0 ]]; then
    if [[ ${#missing_params[@]} -gt 0 ]]; then
        echo "Отсутствуют параметры: ${missing_params[*]}"
    fi
    if [[ ${#errors[@]} -gt 0 ]]; then
        echo "Неверные значения:"
        for error in "${errors[@]}"; do
            echo "  $error"
        done
    fi
    echo "Не пройдена"
    exit 44 # Неверное значение → "Не пройдена"
fi

# Все параметры найдены и имеют правильные значения
echo "Пройдена"
exit 0
