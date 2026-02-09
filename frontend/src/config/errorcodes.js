/**
 * frontend/src/config/errorcodes.js
 * Error codes and descriptions for script execution errors.
 * This file mirrors backend/utils/error_codes.py for consistency.
 */

export const ERROR_CODES = {
  11: {
    category: 'Подключение',
    error: 'Нет сетевого доступа',
    description: 'Недоступен сервер или порт',
  },
  12: {
    category: 'Аутентификация',
    error: 'Неверные учётные данные',
    description: 'Ошибка при входе (логин/пароль/SSH-ключ)',
  },
  13: {
    category: 'Авторизация',
    error: 'Недостаточно прав (sudo)',
    description: 'Нет полномочий на выполнение команды',
  },
  14: {
    category: 'Авторизация',
    error: 'Отказано в доступе к файлу',
    description: 'Генерал permission denied',
  },
  21: {
    category: 'Файловая система',
    error: 'Файл не найден',
    description: 'Нет такого файла или директории',
  },
  22: {
    category: 'Файловая система',
    error: 'Не хватает прав на файл',
    description: 'Недостаточные права доступа к файлу',
  },
  23: {
    category: 'Файловая система',
    error: 'Файл повреждён',
    description: 'Файл недоступен или в неправильном формате',
  },
  31: {
    category: 'Процессы/команды',
    error: 'Команда не найдена',
    description: 'Нет такой команды в системе',
  },
  32: {
    category: 'Сервисы',
    error: 'Служба не найдена',
    description: 'Нет такой системной службы',
  },
  33: {
    category: 'Сервисы',
    error: 'Служба остановлена',
    description: 'Служба недоступна/не запущена',
  },
  34: {
    category: 'Процессы',
    error: 'Таймаут выполнения',
    description: 'Команда превысила время выполнения',
  },
  41: {
    category: 'Конфигурация',
    error: 'Строка не найдена',
    description: 'Искомая строка отсутствует в файле',
  },
  42: {
    category: 'Конфигурация',
    error: 'Строка закомментирована',
    description: 'Строка есть, но отключена (закомментирована)',
  },
  43: {
    category: 'Конфигурация',
    error: 'Неверный формат',
    description: 'Синтаксическая ошибка в конфигурации',
  },
  44: {
    category: 'Конфигурация',
    error: 'Неверное значение',
    description: 'Параметр имеет недопустимое значение',
  },
  50: {
    category: 'Критическая',
    error: 'Неизвестная ошибка',
    description: 'Непредвиденная ошибка в скрипте',
  },
  51: {
    category: 'Критическая',
    error: 'Отсутствует переменная',
    description: 'Нет обязательной переменной окружения',
  },
  52: {
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
 * Supports patterns like "exit code: 11" or last line being just a number.
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
