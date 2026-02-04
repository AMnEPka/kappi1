#!/usr/bin/env bash

set -eo pipefail

# CHECK_OUTPUT — вывод команды "sudo su user" с хоста
# Команда на хосте должна быть выполнена как: echo "" | timeout 10 sudo su user
# Это предотвращает зависание интерактивной сессии и проверяет запрос пароля
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

# Если пароль не запрашивается (например, настроен NOPASSWD), проверка не пройдена
# Также проверяем, что команда не выполнилась успешно (если нет запроса пароля, значит NOPASSWD)
echo "Не пройдена"
exit 44 # Неверное значение → "Не пройдена"
