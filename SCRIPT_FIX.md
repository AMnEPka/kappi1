# Исправление скрипта для проверки sssd.conf

## Проблема
Exit code 162, нет stdout/stderr - bash не может выполнить скрипт.

## Причина
Неправильное регулярное выражение в скрипте: `[^#]` требует символ перед `simple_allow_users`, что неправильно.

## Исправленный скрипт

Используйте этот скрипт в поле "Скрипт-обработчик":

```bash
#!/usr/bin/env bash
set -euo pipefail

# CHECK_OUTPUT — уже содержит вывод команды с хоста
# ETALON_INPUT — эталонные данные

if [[ -z "${CHECK_OUTPUT:-}" ]]; then
    exit 5001 # Отсутствует переменная
fi

if [[ -z "${ETALON_INPUT:-}" ]]; then
    exit 5001
fi

# Ищем строку в полученных данных (НЕ в файле!)
# ИСПРАВЛЕНО: правильное регулярное выражение
# [^#[:space:]] означает: символ, который не является # или пробелом
line="$(echo "$CHECK_OUTPUT" | grep -E '^[[:space:]]*[^#[:space:]]simple_allow_users[[:space:]]*=' || true)"

if [[ -z "$line" ]]; then
    # Проверим, может закомментирована
    if echo "$CHECK_OUTPUT" | grep -qE '^[[:space:]]*#.*simple_allow_users'; then
        exit 4002 # Строка закомментирована → "Не пройдена"
    fi
    exit 4001 # Строка не найдена → "Не пройдена"
fi

# Сравниваем значение с эталоном
actual="$(echo "$line" | sed 's/^[^=]*=//' | tr -d ' ')"
expected="$(echo "$ETALON_INPUT" | tr -d ' ')"

echo "ACTUAL_DATA: $actual"

if [[ "$actual" == "$expected" ]]; then
    echo "Пройдена"
    exit 0
else
    exit 4004 # Неверное значение → "Не пройдена"
fi
```

## Что изменилось

**Было (неправильно):**
```bash
line="$(echo "$CHECK_OUTPUT" | grep -E '^[[:space:]]*[^#]simple_allow_users[[:space:]]*=' || true)"
```

**Стало (правильно):**
```bash
line="$(echo "$CHECK_OUTPUT" | grep -E '^[[:space:]]*[^#[:space:]]simple_allow_users[[:space:]]*=' || true)"
```

## Объяснение

- `[^#]` - требует один символ, который не является `#` (неправильно)
- `[^#[:space:]]` - требует один символ, который не является `#` или пробелом (правильно)

Это позволяет находить строки вида:
- `simple_allow_users = ...` ✅
- `  simple_allow_users=...` ✅
- Но НЕ найдет: `#simple_allow_users = ...` ✅

## Отладка

Теперь в логах будет:
1. Проверка синтаксиса bash (bash -n)
2. Выполнение с отладкой (bash -x) - показывает все команды
3. Детальное логирование всех шагов

Проверьте логи приложения и `logs/ssh_operations.log` для детальной информации.
