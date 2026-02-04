/**
 * frontend/src/config/errorcodes.js
 * Error codes and descriptions for script execution errors.
 * This file mirrors backend/utils/error_codes.py for consistency.
 */

export const ERROR_CODES = {
  1001: {
    category: 'Подключение',
    error: 'Нет сетевого доступа',
    description: 'Недоступен сервер или порт',
  },
  1002: {
    category: 'Аутентификация',
    error: 'Неверные учётные данные',
    description: 'Ошибка при входе (логин/пароль/SSH-ключ)',
  },
  1003: {
    category: 'Авторизация',
    error: 'Недостаточно прав (sudo)',
    description: 'Нет полномочий на выполнение команды',
  },
  1004: {
    category: 'Авторизация',
    error: 'Отказано в доступе к файлу',
    description: 'Генерал permission denied',
  },
  2001: {
    category: 'Файловая система',
    error: 'Файл не найден',
    description: 'Нет такого файла или директории',
  },
  2002: {
    category: 'Файловая система',
    error: 'Не хватает прав на файл',
    description: 'Недостаточные права доступа к файлу',
  },
  2003: {
    category: 'Файловая система',
    error: 'Файл повреждён',
    description: 'Файл недоступен или в неправильном формате',
  },
  3001: {
    category: 'Процессы/команды',
    error: 'Команда не найдена',
    description: 'Нет такой команды в системе',
  },
  3002: {
    category: 'Сервисы',
    error: 'Служба не найдена',
    description: 'Нет такой системной службы',
  },
  3003: {
    category: 'Сервисы',
    error: 'Служба остановлена',
    description: 'Служба недоступна/не запущена',
  },
  3004: {
    category: 'Процессы',
    error: 'Таймаут выполнения',
    description: 'Команда превысила время выполнения',
  },
  4001: {
    category: 'Конфигурация',
    error: 'Строка не найдена',
    description: 'Искомая строка отсутствует в файле',
  },
  4002: {
    category: 'Конфигурация',
    error: 'Строка закомментирована',
    description: 'Строка есть, но отключена (закомментирована)',
  },
  4003: {
    category: 'Конфигурация',
    error: 'Неверный формат',
    description: 'Синтаксическая ошибка в конфигурации',
  },
  4004: {
    category: 'Конфигурация',
    error: 'Неверное значение',
    description: 'Параметр имеет недопустимое значение',
  },
  5000: {
    category: 'Критическая',
    error: 'Неизвестная ошибка',
    description: 'Непредвиденная ошибка в скрипте',
  },
  5001: {
    category: 'Критическая',
    error: 'Отсутствует переменная',
    description: 'Нет обязательной переменной окружения',
  },
  5002: {
    category: 'Критическая',
    error: 'Ошибка синтаксиса',
    description: 'Ошибка в обработке данных скриптом',
  },
};

export function getErrorDescription(errorCode) {
  const code = Number(errorCode);
  if (Number.isFinite(code) && ERROR_CODES[code]) return ERROR_CODES[code];
  return {
    category: 'Неизвестно',
    error: `Неизвестный код ошибки: ${errorCode}`,
    description: 'Ошибка не распознана',
  };
}

/**
 * Extract error code from script output (best-effort).
 * Supports patterns like "exit code: 1001" or last line being just a number.
 */
export function extractErrorCode(output) {
  if (!output) return null;
  const text = String(output);

  const exitMatch = text.match(/exit code:?\s*(\d+)/i);
  if (exitMatch?.[1]) return Number(exitMatch[1]);

  const lines = text.trim().split('\n');
  const lastLine = (lines[lines.length - 1] || '').trim();
  if (/^\d+$/.test(lastLine)) return Number(lastLine);

  return null;
}
