#!/usr/bin/env bash

set -eo pipefail

# CHECK_OUTPUT — вывод команды "cat /etc/securetty"
# Проверяем, что файл пуст или не существует
# Если файл пуст или не существует - "Пройдена", иначе - "Не пройдена"

if [ -z "${CHECK_OUTPUT:-}" ]; then
    exit 51 # Отсутствует переменная
fi

# Проверяем, содержит ли вывод сообщение об ошибке "файл не существует"
# Обычно это: "cat: /etc/securetty: No such file or directory" или подобное
if echo "$CHECK_OUTPUT" | grep -qiE "(no such file|not found|cannot access)"; then
    # Файл не существует - проверка пройдена
    echo "Пройдена"
    exit 0
fi

# Убираем все пробелы, табы и переводы строк для проверки на пустоту
# Если после удаления всех пробельных символов ничего не осталось - файл пуст
trimmed_output=$(echo "$CHECK_OUTPUT" | tr -d '[:space:]')

# Проверяем, пуст ли файл
if [[ -z "$trimmed_output" ]]; then
    # Файл пуст - проверка пройдена
    echo "Пройдена"
    exit 0
else
    # Файл не пуст - проверка не пройдена
    echo "Файл /etc/securetty не пуст"
    echo "Не пройдена"
    exit 44 # Неверное значение → "Не пройдена"
fi
