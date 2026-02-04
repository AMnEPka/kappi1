#!/usr/bin/env bash
set -euo pipefail

# DEBUG VERSION - Пошаговая отладка скрипта
# Этот скрипт выводит подробную информацию на каждом шаге

echo "=== DEBUG: Начало выполнения скрипта ===" >&2
echo "DEBUG: SHELL: $SHELL" >&2
echo "DEBUG: BASH_VERSION: $BASH_VERSION" >&2
echo "DEBUG: PWD: $PWD" >&2
echo "DEBUG: USER: $USER" >&2

# Проверка переменных окружения
echo "" >&2
echo "=== DEBUG: Проверка переменных окружения ===" >&2

if [[ -z "${CHECK_OUTPUT:-}" ]]; then
    echo "DEBUG: CHECK_OUTPUT is EMPTY or NOT SET" >&2
    echo "DEBUG: Exit code 5001 - Отсутствует переменная CHECK_OUTPUT" >&2
    exit 5001
else
    echo "DEBUG: CHECK_OUTPUT is SET" >&2
    echo "DEBUG: CHECK_OUTPUT length: ${#CHECK_OUTPUT} chars" >&2
    echo "DEBUG: CHECK_OUTPUT lines: $(echo "$CHECK_OUTPUT" | wc -l)" >&2
    echo "DEBUG: CHECK_OUTPUT first 200 chars: $(echo "$CHECK_OUTPUT" | head -c 200)" >&2
    echo "DEBUG: CHECK_OUTPUT contains CRLF: $(echo "$CHECK_OUTPUT" | grep -c $'\r' || echo 0)" >&2
fi

if [[ -z "${ETALON_INPUT:-}" ]]; then
    echo "DEBUG: ETALON_INPUT is EMPTY or NOT SET" >&2
    echo "DEBUG: Exit code 5001 - Отсутствует переменная ETALON_INPUT" >&2
    exit 5001
else
    echo "DEBUG: ETALON_INPUT is SET" >&2
    echo "DEBUG: ETALON_INPUT length: ${#ETALON_INPUT} chars" >&2
    echo "DEBUG: ETALON_INPUT content: $ETALON_INPUT" >&2
fi

# Ищем строку в полученных данных
echo "" >&2
echo "=== DEBUG: Поиск строки simple_allow_users ===" >&2

# Пробуем найти строку (не закомментированную)
# Правильное регулярное выражение: после пробелов должен быть символ, который не является # или пробелом
# Затем идет simple_allow_users
line="$(echo "$CHECK_OUTPUT" | grep -E '^[[:space:]]*[^#[:space:]]simple_allow_users[[:space:]]*=' || true)"

echo "DEBUG: Результат grep (не закомментированная): $(echo "$line" | head -c 100 || echo 'NOT FOUND')" >&2

if [[ -z "$line" ]]; then
    echo "DEBUG: Строка simple_allow_users не найдена (не закомментированная)" >&2
    
    # Проверим, может закомментирована
    commented_line="$(echo "$CHECK_OUTPUT" | grep -E '^[[:space:]]*#.*simple_allow_users' || true)"
    
    if [[ -n "$commented_line" ]]; then
        echo "DEBUG: Найдена закомментированная строка: $(echo "$commented_line" | head -c 100)" >&2
        echo "DEBUG: Exit code 4002 - Строка закомментирована" >&2
        exit 4002
    else
        echo "DEBUG: Строка не найдена ни в активном, ни в закомментированном виде" >&2
        echo "DEBUG: Exit code 4001 - Строка не найдена" >&2
        exit 4001
    fi
fi

echo "DEBUG: Найдена строка: $line" >&2

# Сравниваем значение с эталоном
echo "" >&2
echo "=== DEBUG: Сравнение значений ===" >&2

actual="$(echo "$line" | sed 's/^[^=]*=//' | tr -d ' ')"
expected="$(echo "$ETALON_INPUT" | tr -d ' ')"

echo "DEBUG: actual (из строки): '$actual'" >&2
echo "DEBUG: expected (из ETALON_INPUT): '$expected'" >&2
echo "DEBUG: actual length: ${#actual}" >&2
echo "DEBUG: expected length: ${#expected}" >&2

# Проверка на точное совпадение
if [[ "$actual" == "$expected" ]]; then
    echo "DEBUG: Значения совпадают!" >&2
    echo "ACTUAL_DATA: $actual"
    echo "Пройдена"
    exit 0
else
    echo "DEBUG: Значения НЕ совпадают!" >&2
    echo "DEBUG: actual hex: $(echo -n "$actual" | xxd -p | head -c 100)" >&2
    echo "DEBUG: expected hex: $(echo -n "$expected" | xxd -p | head -c 100)" >&2
    echo "ACTUAL_DATA: $actual"
    echo "DEBUG: Exit code 4004 - Неверное значение" >&2
    exit 4004
fi
