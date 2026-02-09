#!/usr/bin/env bash

set -eo pipefail

# CHECK_OUTPUT — вывод команды "cat /etc/pam.d/system-auth"
# Проверяем наличие строк:
#   password required pam_pwhistory.so remember=24
#   pam_unix.so sha512 shadow use_authtok

if [ -z "${CHECK_OUTPUT:-}" ]; then
    exit 51 # Отсутствует переменная
fi

# Ищем первую строку: password required pam_pwhistory.so remember=24
# Строка должна быть активной (не закомментированной)
line1="$(echo "$CHECK_OUTPUT" | grep -E 'password[[:space:]]+required[[:space:]]+pam_pwhistory\.so[[:space:]]+remember=24' | grep -vE '^[[:space:]]*#' || true)"

if [[ -z "$line1" ]]; then
    echo "Не найдена строка: password required pam_pwhistory.so remember=24"
    echo "Не пройдена"
    exit 44 # Неверное значение → "Не пройдена"
fi

# Ищем вторую строку: pam_unix.so sha512 shadow use_authtok
# Строка должна быть активной (не закомментированной)
# Может быть в контексте password или другой строки
line2="$(echo "$CHECK_OUTPUT" | grep -E 'pam_unix\.so[[:space:]]+sha512[[:space:]]+shadow[[:space:]]+use_authtok' | grep -vE '^[[:space:]]*#' || true)"

if [[ -z "$line2" ]]; then
    echo "Не найдена строка: pam_unix.so sha512 shadow use_authtok"
    echo "Не пройдена"
    exit 44 # Неверное значение → "Не пройдена"
fi

# Обе строки найдены и активны
echo "Пройдена"
exit 0
