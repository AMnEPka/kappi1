#!/usr/bin/env bash

set -eo pipefail  

if [ -z "${CHECK_OUTPUT:-}" ]; then
    exit 51 # Отсутствует переменная
fi

if [ -z "${ETALON_INPUT:-}" ]; then
    exit 51
fi

# Парсим вывод getent passwd: извлекаем первый элемент (имя пользователя) до первого двоеточия
# Формат getent passwd: username:password:uid:gid:gecos:home:shell
# Нам нужен только username (первый элемент)
actual_users="$(echo "$CHECK_OUTPUT" | awk -F':' '{print $1}' | grep -v '^$' | sort -u | tr '\n' ',' | sed 's/,$//')"

if [[ -z "$actual_users" ]]; then
    exit 41 # Список пользователей пуст → "Не пройдена"
fi

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
actual_normalized="$(normalize "$actual_users")"

echo "ACTUAL_DATA: $actual_users"
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
