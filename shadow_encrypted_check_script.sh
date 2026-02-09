#!/usr/bin/env bash

set -eo pipefail

# CHECK_OUTPUT — вывод команды "sudo cat /etc/shadow"
# Проверяем, что все пароли в файле /etc/shadow хранятся в зашифрованном виде
# Формат /etc/shadow: username:password_hash:last_change:min:max:warn:inactive:expire:reserved

if [ -z "${CHECK_OUTPUT:-}" ]; then
    exit 51 # Отсутствует переменная
fi

# Функция для проверки, является ли пароль зашифрованным
# Пароль считается зашифрованным, если:
# - Начинается с $ (современные хеши: $1$, $2a$, $5$, $6$ и т.д.)
# - Равен * или ! (заблокированный аккаунт)
# - Имеет формат старых хешей (DES - 13 символов, MD5 - начинается с $1$)
is_encrypted() {
    local password_hash="$1"
    
    # Пустое поле - незашифрованный пароль
    if [[ -z "$password_hash" ]]; then
        return 1
    fi
    
    # Заблокированные аккаунты (* или !) - считаем нормальными
    if [[ "$password_hash" == "*" ]] || [[ "$password_hash" == "!" ]]; then
        return 0
    fi
    
    # Современные хеши начинаются с $ (например, $1$, $2a$, $5$, $6$)
    if [[ "$password_hash" =~ ^\$ ]]; then
        return 0
    fi
    
    # Старые DES хеши имеют длину 13 символов и содержат только буквы, цифры, точки и слеши
    if [[ ${#password_hash} -eq 13 ]] && [[ "$password_hash" =~ ^[a-zA-Z0-9./]+$ ]]; then
        return 0
    fi
    
    # Если не соответствует ни одному формату - незашифрованный
    return 1
}

# Проверяем каждую строку в /etc/shadow
errors=()
line_number=0

while IFS= read -r line; do
    line_number=$((line_number + 1))
    
    # Пропускаем пустые строки и комментарии
    if [[ -z "$line" ]] || [[ "$line" =~ ^[[:space:]]*# ]]; then
        continue
    fi
    
    # Извлекаем username и password_hash (первые два поля)
    username=$(echo "$line" | awk -F':' '{print $1}')
    password_hash=$(echo "$line" | awk -F':' '{print $2}')
    
    # Пропускаем строки без username (некорректный формат)
    if [[ -z "$username" ]]; then
        continue
    fi
    
    # Проверяем, зашифрован ли пароль
    if ! is_encrypted "$password_hash"; then
        errors+=("Строка $line_number, пользователь '$username': пароль не зашифрован (значение: '${password_hash}')")
    fi
done <<< "$CHECK_OUTPUT"

# Если есть ошибки - выводим информацию и "Не пройдена"
if [[ ${#errors[@]} -gt 0 ]]; then
    echo "Найдены незашифрованные пароли:"
    for error in "${errors[@]}"; do
        echo "  $error"
    done
    echo "Не пройдена"
    exit 44 # Неверное значение → "Не пройдена"
fi

# Все пароли зашифрованы
echo "Пройдена"
exit 0
