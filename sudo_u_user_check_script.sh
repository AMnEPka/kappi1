#!/usr/bin/env bash

set -eo pipefail

# CHECK_OUTPUT — вывод команды "sudo -u user cat /etc/shadow" с хоста
# Команда на хосте должна быть выполнена как: echo "" | timeout 10 sudo -u user cat /etc/shadow
# Это предотвращает зависание и проверяет запрос пароля
# CHECK_OUTPUT может быть пустым, если команда не выполнилась - это нормально для проверки

# Нормализуем в нижний регистр для упрощения поиска
lower_output="$(printf '%s\n' "$CHECK_OUTPUT" | tr '[:upper:]' '[:lower:]')"

# Проверяем наличие запроса пароля в выводе
# Признаки запроса пароля:
# - "password:" или "password for"
# - "[sudo] password for"
# - "пароль" (русский)
# - "введите пароль"
# - "enter password"

if echo "$lower_output" | grep -qE "(password|пароль)"; then
    echo "Пройдена"
    exit 0
fi

if echo "$lower_output" | grep -qE "\[sudo\] password for"; then
    echo "Пройдена"
    exit 0
fi

if echo "$CHECK_OUTPUT" | grep -qi "введите пароль"; then
    echo "Пройдена"
    exit 0
fi

if echo "$CHECK_OUTPUT" | grep -qi "enter password"; then
    echo "Пройдена"
    exit 0
fi

# СНАЧАЛА проверяем, выполнилась ли команда успешно (есть содержимое /etc/shadow)
# Если файл выводится, значит пароль НЕ был запрошен - это "Не пройдена"
# Формат /etc/shadow: username:password_hash:last_change:min:max:warn:inactive:expire:reserved
# Проверяем наличие хотя бы одной строки с форматом username:password_hash:...
if echo "$CHECK_OUTPUT" | grep -qE "^[^:]+:[^:]*:[0-9]*:"; then
    # Вывод содержит содержимое /etc/shadow (строки с форматом username:password_hash:...)
    # Это означает, что команда выполнилась успешно БЕЗ запроса пароля
    echo "Не пройдена"
    exit 44 # Неверное значение → "Не пройдена"
fi

# Если команда не выполнилась (нет содержимого файла), но и пароль не запрашивался,
# проверка не пройдена
echo "Не пройдена"
exit 44 # Неверное значение → "Не пройдена"
