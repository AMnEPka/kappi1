#!/usr/bin/env bash

set -eo pipefail

# CHECK_OUTPUT — вывод команды "cat /etc/sudoers"
# Проверяем, что директивы #include и/или #includedir не активны
# (имеют вид: # (пробел) include /etc/sudoers.d или полностью закомментированы)
# Активные директивы (без пробела после # или без # вообще) - это нарушение

if [ -z "${CHECK_OUTPUT:-}" ]; then
    exit 51 # Отсутствует переменная
fi

# Список активных (не закомментированных) директив
active_directives=()

# Проверяем каждую строку
while IFS= read -r line; do
    # Пропускаем пустые строки
    if [[ -z "$line" ]]; then
        continue
    fi
    
    # Убираем ведущие пробелы и табы для анализа
    trimmed_line=$(echo "$line" | sed 's/^[[:space:]]*//')
    
    # Пропускаем строки, которые не содержат include или includedir
    if ! echo "$trimmed_line" | grep -qiE '(include|includedir)'; then
        continue
    fi
    
    # Проверяем, является ли директива активной
    # Активная директива - это та, которая НЕ начинается с "# " (решетка и пробел)
    
    # Правильно закомментированная: начинается с "# " (решетка, пробел, затем include/includedir)
    if echo "$trimmed_line" | grep -qE '^#[[:space:]]+(include|includedir)'; then
        # Правильно закомментировано - пропускаем
        continue
    fi
    
    # Двойной комментарий (##) - тоже закомментировано
    if echo "$trimmed_line" | grep -qE '^##'; then
        continue
    fi
    
    # Все остальные случаи - активные директивы (нарушение):
    # - include /path (без #)
    # - #include /path (без пробела после #)
    # - includedir /path (без #)
    # - #includedir /path (без пробела после #)
    active_directives+=("$line")
done <<< "$CHECK_OUTPUT"

# Если найдены активные директивы - выводим информацию и "Не пройдена"
if [[ ${#active_directives[@]} -gt 0 ]]; then
    echo "Найдены активные директивы include/includedir (должны быть закомментированы):"
    for directive in "${active_directives[@]}"; do
        echo "  $directive"
    done
    echo "Не пройдена"
    exit 44 # Неверное значение → "Не пройдена"
fi

# Все директивы include/includedir закомментированы или отсутствуют
echo "Пройдена"
exit 0
