#!/usr/bin/env bash
# ФИНАЛЬНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ
# Исправлены все проблемы:
# 1. Правильное регулярное выражение [^#[:space:]] вместо [^#]
# 2. Безопасная обработка многострочных переменных
# 3. Убрано set -u чтобы избежать проблем с переменными окружения

set -eo pipefail  # Убрали -u чтобы избежать проблем

# CHECK_OUTPUT — уже содержит вывод команды с хоста
# ETALON_INPUT — эталонные данные

# Безопасная проверка переменных (обрабатывает многострочные значения)
if [ -z "${CHECK_OUTPUT:-}" ]; then
    exit 51 # Отсутствует переменная
fi

if [ -z "${ETALON_INPUT:-}" ]; then
    exit 51
fi

# Ищем строку в полученных данных (НЕ в файле!)
# ИСПРАВЛЕНО: используем два шага для правильного поиска
# Шаг 1: находим все строки с simple_allow_users (включая закомментированные)
# Шаг 2: исключаем закомментированные строки (которые начинаются с # после пробелов)
# Это правильный способ, так как bash не поддерживает negative lookahead
line="$(echo "$CHECK_OUTPUT" | grep -E '^[[:space:]]*simple_allow_users[[:space:]]*=' | grep -vE '^[[:space:]]*#' || true)"

if [[ -z "$line" ]]; then
    # Проверим, может закомментирована
    if echo "$CHECK_OUTPUT" | grep -qE '^[[:space:]]*#.*simple_allow_users'; then
        exit 42 # Строка закомментирована → "Не пройдена"
    fi
    exit 41 # Строка не найдена → "Не пройдена"
fi

# Сравниваем значение с эталоном
actual="$(echo "$line" | sed 's/^[^=]*=//' | tr -d ' ')"

# Нормализуем данные для сравнения: приводим к единому формату (запятые, отсортированные)
# Эталонные данные могут быть в формате:
#   - "user1,user2" (запятые)
#   - "user1\nuser2" (переносы строк)  
#   - "user1 user2" (пробелы)
# Actual данные обычно в формате "user1,user2,user3" (запятые)
# Нормализуем оба к формату: "user1,user2" (запятые, отсортированные, без дубликатов)

# Нормализация: заменяем все разделители (переносы строк, табы, пробелы, запятые) на запятые,
# затем убираем пустые элементы, сортируем и объединяем запятыми
normalize() {
    local input="$1"
    # Заменяем все возможные разделители на запятые
    echo "$input" | \
        tr '\n\t ' ',' | \
        # Убираем множественные запятые
        sed 's/,,*/,/g' | \
        # Убираем запятые в начале и конце
        sed 's/^,\|,$//g' | \
        # Разбиваем по запятым, убираем пустые, сортируем уникальные
        awk -F',' '{for(i=1;i<=NF;i++) if($i!="") print $i}' | \
        sort -u | \
        # Объединяем запятыми
        tr '\n' ',' | sed 's/,$//'
}

expected_normalized="$(normalize "$ETALON_INPUT")"
actual_normalized="$(normalize "$actual")"

echo "ACTUAL_DATA: $actual"
echo "DEBUG: actual_normalized='$actual_normalized'"
echo "DEBUG: expected_normalized='$expected_normalized'"

# Проверяем точное совпадение множеств (количество и состав элементов должны совпадать)
# Разбиваем на массивы для проверки
IFS=',' read -ra expected_array <<< "$expected_normalized"
IFS=',' read -ra actual_array <<< "$actual_normalized"

# Проверяем количество элементов
expected_count=${#expected_array[@]}
actual_count=${#actual_array[@]}

echo "DEBUG: expected_count=$expected_count, actual_count=$actual_count"

if [[ $expected_count -ne $actual_count ]]; then
    echo "DEBUG: количество элементов не совпадает (эталон: $expected_count, actual: $actual_count)"
    exit 44 # Неверное значение → "Не пройдена"
fi

# Проверяем, что каждый элемент из эталона есть в actual
all_found=true
for expected_item in "${expected_array[@]}"; do
    found=false
    for actual_item in "${actual_array[@]}"; do
        if [[ "$expected_item" == "$actual_item" ]]; then
            found=true
            break
        fi
    done
    if [[ "$found" == false ]]; then
        all_found=false
        echo "DEBUG: элемент '$expected_item' не найден в actual"
        break
    fi
done

if [[ "$all_found" == true ]]; then
    echo "Пройдена"
    exit 0
else
    exit 44 # Неверное значение → "Не пройдена"
fi
