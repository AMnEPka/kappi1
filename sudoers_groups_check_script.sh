#!/usr/bin/env bash

set -eo pipefail

# CHECK_OUTPUT — вывод команды "cat /etc/sudoers"
# ETALON_INPUT — эталонный список групп безопасности
# Необходимо получить список групп безопасности, имеющих полномочия на применение команды sudo
# Список групп приводится после строки "#includedir /etc/sudoers.d"
# Формат: %astra-admin    ALL=(ALL:ALL) NOPASSWD: ALL
# Сравнить с эталонным списком и вывести ACTUAL_DATA: value1, value2

if [ -z "${CHECK_OUTPUT:-}" ]; then
    exit 51 # Отсутствует переменная
fi

if [ -z "${ETALON_INPUT:-}" ]; then
    exit 51 # Отсутствует переменная
fi

# Находим строку "#includedir /etc/sudoers.d" (может быть с пробелами после #)
# И извлекаем все строки после неё, которые начинаются с % (группы)
# Флаг -A в grep означает "после совпадения", но нам нужно найти все строки после этой

# Сначала находим позицию строки "#includedir /etc/sudoers.d"
# Затем извлекаем все строки после неё, которые начинаются с % и содержат sudo правила
found_includedir=false
groups_after_includedir=""

while IFS= read -r line; do
    # Проверяем, является ли строка "#includedir /etc/sudoers.d"
    # Может быть с пробелами: # includedir /etc/sudoers.d или #includedir /etc/sudoers.d
    if echo "$line" | grep -qE '^[[:space:]]*#[[:space:]]*includedir[[:space:]]+/etc/sudoers\.d'; then
        found_includedir=true
        continue
    fi
    
    # Если уже нашли includedir, ищем строки с группами (начинаются с %)
    if [[ "$found_includedir" == true ]]; then
        # Ищем строки, начинающиеся с % (группы безопасности)
        # Формат: %astra-admin    ALL=(ALL:ALL) NOPASSWD: ALL
        if echo "$line" | grep -qE '^[[:space:]]*%'; then
            # Извлекаем имя группы (первое слово после %)
            # Убираем ведущие пробелы, находим % и извлекаем имя группы до первого пробела
            group_name=$(echo "$line" | sed -E 's/^[[:space:]]*%([a-zA-Z0-9_-]+).*/\1/')
            if [[ -n "$group_name" ]]; then
                if [[ -z "$groups_after_includedir" ]]; then
                    groups_after_includedir="$group_name"
                else
                    groups_after_includedir="$groups_after_includedir"$'\n'"$group_name"
                fi
            fi
        fi
    fi
done <<< "$CHECK_OUTPUT"

# Если не нашли includedir, проверяем весь файл на наличие групп
if [[ "$found_includedir" == false ]]; then
    # Ищем все строки с группами в файле
    while IFS= read -r line; do
        if echo "$line" | grep -qE '^[[:space:]]*%'; then
            group_name=$(echo "$line" | sed -E 's/^[[:space:]]*%([a-zA-Z0-9_-]+).*/\1/')
            if [[ -n "$group_name" ]]; then
                if [[ -z "$groups_after_includedir" ]]; then
                    groups_after_includedir="$group_name"
                else
                    groups_after_includedir="$groups_after_includedir"$'\n'"$group_name"
                fi
            fi
        fi
    done <<< "$CHECK_OUTPUT"
fi

# Преобразуем список групп в формат через запятую
if [[ -z "$groups_after_includedir" ]]; then
    actual_groups=""
else
    # Убираем дубликаты, сортируем и объединяем запятыми
    actual_groups=$(echo "$groups_after_includedir" | sort -u | tr '\n' ',' | sed 's/,$//')
fi

# Выводим ACTUAL_DATA
echo "ACTUAL_DATA: $actual_groups"

# Нормализуем данные для сравнения: приводим к единому формату (запятые, отсортированные)
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
actual_normalized="$(normalize "$actual_groups")"

# Проверяем точное совпадение множеств (количество и состав элементов должны совпадать)
# Разбиваем на массивы для проверки
IFS=',' read -ra expected_array <<< "$expected_normalized"
IFS=',' read -ra actual_array <<< "$actual_normalized"

# Проверяем количество элементов
expected_count=${#expected_array[@]}
actual_count=${#actual_array[@]}

if [[ $expected_count -ne $actual_count ]]; then
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
        break
    fi
done

if [[ "$all_found" == true ]]; then
    echo "Пройдена"
    exit 0
else
    exit 44 # Неверное значение → "Не пройдена"
fi
