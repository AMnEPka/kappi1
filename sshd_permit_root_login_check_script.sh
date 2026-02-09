#!/usr/bin/env bash

set -eo pipefail

# CHECK_OUTPUT — вывод команды "sudo grep PermitRootLogin /etc/ssh/sshd_config"
# Проверяем, что указан запрет регистрации по SSH от УЗ root
# Параметр должен быть: PermitRootLogin no
# Строка должна быть активной (не закомментированной)

if [ -z "${CHECK_OUTPUT:-}" ]; then
    exit 51 # Отсутствует переменная
fi

# Ищем активную (не закомментированную) строку с PermitRootLogin
# В sshd_config может быть несколько строк, берем последнюю активную
# Формат может быть: PermitRootLogin no или PermitRootLogin=no

# Ищем все активные строки (не закомментированные)
# Исключаем строки, начинающиеся с # или содержащие только пробелы и #
active_lines=$(echo "$CHECK_OUTPUT" | grep -iE 'PermitRootLogin' | grep -vE '^[[:space:]]*#' || true)

if [[ -z "$active_lines" ]]; then
    # Нет активных строк с PermitRootLogin
    echo "Не найдена активная директива PermitRootLogin"
    echo "Не пройдена"
    exit 44 # Неверное значение → "Не пройдена"
fi

# Берем последнюю активную строку (если их несколько)
# В sshd_config последняя активная директива имеет приоритет
last_active_line=$(echo "$active_lines" | tail -1)

# Извлекаем значение параметра
# Формат может быть: PermitRootLogin no или PermitRootLogin=no
# Убираем ведущие пробелы, извлекаем значение после PermitRootLogin
# Приводим к нижнему регистру для сравнения
value=$(echo "$last_active_line" | sed -E 's/^[[:space:]]*PermitRootLogin[[:space:]]*[=[:space:]]*//i' | awk '{print $1}' | tr '[:upper:]' '[:lower:]' | sed 's/[[:space:]]*$//')

# Проверяем, что значение не пустое
if [[ -z "$value" ]]; then
    echo "Найдена директива PermitRootLogin без значения"
    echo "Ожидается: PermitRootLogin no"
    echo "Не пройдена"
    exit 44 # Неверное значение → "Не пройдена"
fi

# Проверяем, что значение равно "no"
if [[ "$value" != "no" ]]; then
    echo "Найдена директива PermitRootLogin со значением: $value"
    echo "Ожидается: no"
    echo "Не пройдена"
    exit 44 # Неверное значение → "Не пройдена"
fi

# Проверка пройдена
echo "Пройдена"
exit 0
