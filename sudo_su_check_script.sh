#!/usr/bin/env bash

set -eo pipefail

# CHECK_OUTPUT — вывод команды "sudo su" с хоста
# Команда на хосте должна быть выполнена как: echo "exit" | timeout 30 sudo su
# Это предотвращает зависание интерактивной сессии

if [ -z "${CHECK_OUTPUT:-}" ]; then
    exit 51 # Отсутствует переменная
fi

# Нормализуем в нижний регистр для упрощения поиска английских сообщений
lower_output="$(printf '%s\n' "$CHECK_OUTPUT" | tr '[:upper:]' '[:lower:]')"

# Примеры сообщений об отказе, характерные для sudo/su
# - "user is not in the sudoers file. this incident will be reported."
# - "is not allowed to execute"
# - русские сообщения могут выглядеть как "отказано в доступе", "сбой при проверке подлинности"
if echo "$lower_output" | grep -q "not in the sudoers file"; then
    echo "Пройдена"
    exit 0
fi

if echo "$lower_output" | grep -q "not allowed to execute"; then
    echo "Пройдена"
    exit 0
fi

if echo "$CHECK_OUTPUT" | grep -qi "сбой при проверке подлинности"; then
    echo "Пройдена"
    exit 0
fi

if echo "$CHECK_OUTPUT" | grep -qi "отказано в доступе"; then
    echo "Пройдена"
    exit 0
fi

# Если вывод пустой или вообще не похож на ошибку — считаем, что запрета нет (sudo su сработал)
if [ -z "$CHECK_OUTPUT" ]; then
    exit 50 # Непредвидённый формат вывода
fi

# Явно считаем, что если ни одно из стандартных сообщений не найдено,
# то команда не заблокирована должным образом
echo "Не пройдена"
exit 0
