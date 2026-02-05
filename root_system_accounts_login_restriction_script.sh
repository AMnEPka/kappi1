#!/usr/bin/env bash

set -eo pipefail

# CHECK_OUTPUT — вывод команды "cat /etc/shadow; cat /etc/passwd"
# Проверяем:
# 1. Убедиться, что установлен запрет входа под УЗ root, задан параметр /sbin/nologin (false)
# 2. В случае если параметр не задан /sbin/nologin проверить, что установлен знак «!» или «*» или «!*», 
#    перед хеш-суммой паролем в файле /etc/shadow
# 3. Убедиться, что интерактивных вход в Систему под встроенными УЗ запрещен, 
#    за исключением случаев, приведенных в ПЭД
# Формат /etc/passwd: username:password:uid:gid:gecos:home:shell
# Формат /etc/shadow: username:password_hash:last_change:min:max:warn:inactive:expire:reserved
# Встроенные УЗ обычно имеют UID < 1000

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

# Функция для проверки, является ли shell запрещающим вход
is_restricted_shell() {
    local shell="$1"
    [[ "$shell" == "/sbin/nologin" ]] || \
    [[ "$shell" == "/usr/sbin/nologin" ]] || \
    [[ "$shell" == "/bin/false" ]] || \
    [[ "$shell" == "/sbin/false" ]] || \
    [[ "$shell" == "/usr/bin/false" ]]
}

# Функция для проверки, заблокирован ли пароль в shadow
is_password_locked() {
    local password_hash="$1"
    # Пароль заблокирован, если:
    # - Равен * (полностью заблокирован)
    # - Равен ! (заблокирован)
    # - Равен !* (заблокирован)
    # - Начинается с ! (включая !*, !$6$... и т.д.)
    [[ "$password_hash" == "*" ]] || \
    [[ "$password_hash" == "!" ]] || \
    [[ "$password_hash" == "!*" ]] || \
    [[ "$password_hash" == "!"* ]]
}

# Список пользователей с нарушениями
violations=()

# Проверяем root и все встроенные УЗ (UID < 1000)
while IFS= read -r line; do
    # Пропускаем пустые строки и комментарии
    if [[ -z "$line" ]] || [[ "$line" =~ ^[[:space:]]*# ]]; then
        continue
    fi
    
    username=$(echo "$line" | awk -F':' '{print $1}')
    uid=$(echo "$line" | awk -F':' '{print $3}')
    shell=$(echo "$line" | awk -F':' '{print $7}')
    
    # Пропускаем строки без username, uid или shell
    if [[ -z "$username" ]] || [[ -z "$uid" ]] || [[ -z "$shell" ]]; then
        continue
    fi
    
    # Проверяем root (UID 0) или встроенные УЗ (UID < 1000)
    # Проверяем, что uid является числом
    if [[ "$username" == "root" ]] || ([[ "$uid" =~ ^[0-9]+$ ]] && [[ "$uid" -lt 1000 ]]); then
        # Ищем соответствующую запись в /etc/shadow
        shadow_line=$(echo "$shadow_output" | awk -F':' -v user="$username" '$1 == user' | head -1)
        
        if [[ -z "$shadow_line" ]]; then
            # Пользователь не найден в /etc/shadow - это нарушение
            violations+=("$username: не найден в /etc/shadow")
            continue
        fi
        
        password_hash=$(echo "$shadow_line" | awk -F':' '{print $2}')
        
        # Проверяем, установлен ли запрет входа
        if is_restricted_shell "$shell"; then
            # Shell запрещает вход - это правильно
            continue
        else
            # Shell не запрещает вход - проверяем, заблокирован ли пароль в shadow
            if ! is_password_locked "$password_hash"; then
                # Пароль не заблокирован - это нарушение
                violations+=("$username: shell разрешает вход ($shell), но пароль не заблокирован в /etc/shadow")
            fi
        fi
    fi
done <<< "$passwd_output"

# Если есть нарушения - выводим информацию и "Не пройдена"
if [[ ${#violations[@]} -gt 0 ]]; then
    echo "Найдены нарушения запрета входа для root и встроенных УЗ:"
    for violation in "${violations[@]}"; do
        echo "  $violation"
    done
    echo "Не пройдена"
    exit 44 # Неверное значение → "Не пройдена"
fi

# Все проверки пройдены
echo "Пройдена"
exit 0
