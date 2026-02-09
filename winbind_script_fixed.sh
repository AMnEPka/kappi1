#!/usr/bin/env bash

set -eo pipefail  

if [ -z "${CHECK_OUTPUT:-}" ]; then
    exit 51 # Отсутствует переменная
fi

if [ -z "${ETALON_INPUT:-}" ]; then
    exit 51
fi

# Ищем строку с require_membership_of= (может быть в контексте pam_winbind.so или отдельно)
# Сначала попробуем найти в контексте pam_winbind.so (собираем многострочную строку)
pam_line="$(echo "$CHECK_OUTPUT" \
    | awk '
        /pam_winbind\.so/ {
            inblock=1
        }
        inblock {
            line = line $0 " "
            if ($0 !~ /\\[[:space:]]*$/) {
                print line
                exit
            }
            next
        }
    ')"

# Если нашли строку с pam_winbind.so, проверяем require_membership_of= в ней
if [[ -n "$pam_line" ]]; then
    # Проверяем, что строка не закомментирована (не начинается с # после пробелов)
    if echo "$pam_line" | grep -qE '^[[:space:]]*#'; then
        # Если закомментирована, проверяем наличие require_membership_of=
        if echo "$pam_line" | grep -qE 'require_membership_of[[:space:]]*='; then
            exit 42 # Строка закомментирована → "Не пройдена"
        fi
        exit 41 # pam_winbind.so закомментирован, но require_membership_of= не найден
    fi
    
    # Проверяем, что в строке есть require_membership_of=
    if echo "$pam_line" | grep -qE 'require_membership_of[[:space:]]*='; then
        # Вытаскиваем часть после require_membership_of= (с учетом пробелов вокруг =)
        actual="$(echo "$pam_line" \
            | sed 's/.*require_membership_of[[:space:]]*=[[:space:]]*//' \
            | sed 's/[[:space:]]*$//')"
    else
        exit 41 # Параметр require_membership_of не найден в строке с pam_winbind.so
    fi
else
    # Если pam_winbind.so не найден, ищем require_membership_of= отдельно
    line="$(echo "$CHECK_OUTPUT" | grep -E 'require_membership_of[[:space:]]*=' | grep -vE '^[[:space:]]*#' || true)"
    
    if [[ -z "$line" ]]; then
        # Проверим, может require_membership_of= есть только в комментариях
        if echo "$CHECK_OUTPUT" | grep -qE '^[[:space:]]*#.*require_membership_of[[:space:]]*='; then
            exit 42 # Строка закомментирована → "Не пройдена"
        fi
        exit 41 # Строка не найдена → "Не пройдена"
    fi
    
    # Вытаскиваем часть после require_membership_of= (с учетом пробелов вокруг =)
    actual="$(echo "$line" \
        | sed 's/.*require_membership_of[[:space:]]*=[[:space:]]*//' \
        | sed 's/[[:space:]]*$//')"
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
