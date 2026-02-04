#!/usr/bin/env bash
# Упрощенная отладочная версия - выводит все в stdout для удобства

echo "=== DEBUG: Начало выполнения ==="
echo "CHECK_OUTPUT length: ${#CHECK_OUTPUT}"
echo "ETALON_INPUT: '$ETALON_INPUT'"
echo ""

# Проверка переменных
if [[ -z "${CHECK_OUTPUT:-}" ]]; then
    echo "ERROR: CHECK_OUTPUT пуста"
    exit 5001
fi

if [[ -z "${ETALON_INPUT:-}" ]]; then
    echo "ERROR: ETALON_INPUT пуста"
    exit 5001
fi

# Поиск строки
echo "=== Поиск строки simple_allow_users ==="
# Правильное регулярное выражение: после пробелов должен быть символ, который не является # или пробелом
line="$(echo "$CHECK_OUTPUT" | grep -E '^[[:space:]]*[^#[:space:]]simple_allow_users[[:space:]]*=' || true)"

if [[ -z "$line" ]]; then
    echo "Строка не найдена (не закомментированная)"
    
    if echo "$CHECK_OUTPUT" | grep -qE '^[[:space:]]*#.*simple_allow_users'; then
        echo "Найдена закомментированная строка"
        exit 4002
    fi
    echo "Строка не найдена вообще"
    exit 4001
fi

echo "Найдена строка: $line"

# Сравнение
actual="$(echo "$line" | sed 's/^[^=]*=//' | tr -d ' ')"
expected="$(echo "$ETALON_INPUT" | tr -d ' ')"

echo "actual: '$actual'"
echo "expected: '$expected'"

if [[ "$actual" == "$expected" ]]; then
    echo "ACTUAL_DATA: $actual"
    echo "Пройдена"
    exit 0
else
    echo "ACTUAL_DATA: $actual"
    echo "Не пройдена - значения не совпадают"
    exit 4004
fi
