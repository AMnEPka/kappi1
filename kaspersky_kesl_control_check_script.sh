#!/usr/bin/env bash

set -eo pipefail

# CHECK_OUTPUT — вывод команды "sudo kesl-control --app-info"
# Проверяем наличие команды и вывода
# Если команды нет - выводим "нет команды"
# Если вывод есть - выводим "Оператор" (для ручной проверки оператором)

if [ -z "${CHECK_OUTPUT:-}" ]; then
    exit 51 # Отсутствует переменная
fi

# Проверяем, содержит ли вывод сообщение об ошибке "команда не найдена"
# Обычно это: "command not found", "No such file or directory", "cannot execute" и т.д.
if echo "$CHECK_OUTPUT" | grep -qiE "(command not found|no such file|cannot execute|not found|не найдена|нет такого файла)"; then
    echo "нет команды"
    exit 44 # Неверное значение → "Не пройдена"
fi

# Убираем пробельные символы для проверки на пустоту
trimmed_output=$(echo "$CHECK_OUTPUT" | tr -d '[:space:]')

# Проверяем, есть ли вывод
if [[ -z "$trimmed_output" ]]; then
    # Вывод пуст - возможно команда не найдена или не выполнилась
    echo "нет команды"
    exit 44 # Неверное значение → "Не пройдена"
fi

# Команда есть и есть вывод - выводим "Оператор" для ручной проверки
echo "Оператор"
exit 0
