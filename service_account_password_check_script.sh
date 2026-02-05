#!/usr/bin/env bash

set -eo pipefail

# CHECK_OUTPUT — вывод команды "cat /etc/shadow; cat /etc/passwd"
# Проверяем, что для всех сервисных УЗ без параметра /sbin/nologin (false)
# должен быть установлен пароль в файле /etc/shadow
# Формат /etc/passwd: username:password:uid:gid:gecos:home:shell
# Формат /etc/shadow: username:password_hash:last_change:min:max:warn:inactive:expire:reserved

if [ -z "${CHECK_OUTPUT:-}" ]; then
    exit 51 # Отсутствует переменная
fi

# Разделяем вывод на части /etc/shadow и /etc/passwd
# Определяем по количеству полей:
# /etc/shadow: username:password_hash:... (обычно 2-9 полей)
# /etc/passwd: username:password:uid:gid:gecos:home:shell (ровно 7 полей)

shadow_output=""
passwd_output=""

while IFS= read -r line; do
    # Пропускаем пустые строки и комментарии
    if [[ -z "$line" ]] || [[ "$line" =~ ^[[:space:]]*# ]]; then
        continue
    fi
    
    # Определяем секцию по количеству полей
    field_count=$(echo "$line" | awk -F':' '{print NF}')
    
    if [[ $field_count -eq 7 ]]; then
        # Это строка из /etc/passwd (ровно 7 полей)
        passwd_output+="$line"$'\n'
    elif [[ $field_count -ge 2 ]] && [[ $field_count -le 9 ]]; then
        # Это строка из /etc/shadow (2-9 полей)
        shadow_output+="$line"$'\n'
    fi
done <<< "$CHECK_OUTPUT"

# Проверяем, что получили оба файла
if [[ -z "$shadow_output" ]]; then
    echo "Не удалось извлечь данные из /etc/shadow"
    echo "Не пройдена"
    exit 44 # Неверное значение → "Не пройдена"
fi

if [[ -z "$passwd_output" ]]; then
    echo "Не удалось извлечь данные из /etc/passwd"
    echo "Не пройдена"
    exit 44 # Неверное значение → "Не пройдена"
fi

# Находим пользователей без /sbin/nologin и проверяем их пароли
users_without_password=()

while IFS= read -r line; do
    # Пропускаем пустые строки и комментарии
    if [[ -z "$line" ]] || [[ "$line" =~ ^[[:space:]]*# ]]; then
        continue
    fi
    
    username=$(echo "$line" | awk -F':' '{print $1}')
    shell=$(echo "$line" | awk -F':' '{print $7}')
    
    # Пропускаем строки без username или shell
    if [[ -z "$username" ]] || [[ -z "$shell" ]]; then
        continue
    fi
    
    # Проверяем, что shell не равен /sbin/nologin (и его вариантам)
    # Также проверяем /usr/sbin/nologin, /bin/false, /sbin/false и т.д.
    if [[ "$shell" != "/sbin/nologin" ]] && \
       [[ "$shell" != "/usr/sbin/nologin" ]] && \
       [[ "$shell" != "/bin/false" ]] && \
       [[ "$shell" != "/sbin/false" ]] && \
       [[ "$shell" != "/usr/bin/false" ]]; then
        # Это пользователь, который может войти в систему (не /sbin/nologin)
        # Проверяем, есть ли у него пароль в /etc/shadow
        # Ищем строку с этим username в shadow_output (используем awk для точного совпадения первого поля)
        shadow_line=$(echo "$shadow_output" | awk -F':' -v user="$username" '$1 == user' | head -1)
        
        if [[ -z "$shadow_line" ]]; then
            # Пользователь не найден в /etc/shadow - нет пароля
            users_without_password+=("$username")
        else
            # Извлекаем password_hash (второе поле)
            password_hash=$(echo "$shadow_line" | awk -F':' '{print $2}')
            
            # Пароль считается не установленным, если:
            # - Пустой
            # - Равен * (заблокированный аккаунт)
            # - Равен ! (заблокированный аккаунт)
            if [[ -z "$password_hash" ]] || \
               [[ "$password_hash" == "*" ]] || \
               [[ "$password_hash" == "!" ]]; then
                users_without_password+=("$username")
            fi
        fi
    fi
done <<< "$passwd_output"

# Если есть пользователи без пароля - выводим информацию и "Не пройдена"
if [[ ${#users_without_password[@]} -gt 0 ]]; then
    echo "Найдены пользователи без пароля (не имеют /sbin/nologin):"
    for user in "${users_without_password[@]}"; do
        echo "  $user"
    done
    echo "Не пройдена"
    exit 44 # Неверное значение → "Не пройдена"
fi

# Все пользователи без /sbin/nologin имеют установленный пароль
echo "Пройдена"
exit 0
