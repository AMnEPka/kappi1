// config/errorCodes.js
export const ERROR_CODES = {
    1001: {
      category: 'Подключение',
      error: 'Нет сетевого доступа',
      description: 'Недоступен сервер или порт'
    },
    1002: {
      category: 'Аутентификация',
      error: 'Неверные учётные данные',
      description: 'Ошибка при входе (логин/пароль/SSH-ключ)'
    },
    1003: {
      category: 'Авторизация',
      error: 'Недостаточно прав (sudo)',
      description: 'Нет полномочий на выполнение команды'
    },
    1004: {
      category: 'Авторизация',
      error: 'Отказано в доступе',
      description: 'Генерал permission denied'
    },
    2001: {
      category: 'Файловая система',
      error: 'Файл не найден',
      description: 'Нет такого файла или директории'
    },
    2002: {
      category: 'Файловая система',
      error: 'Не хватает прав на файл',
      description: 'Недостаточные права доступа к файлу'
    },
    2003: {
      category: 'Файловая система',
      error: 'Файл повреждён',
      description: 'Файл недоступен или в неправильном формате'
    },
    3001: {
      category: 'Процессы/команды',
      error: 'Команда не найдена',
      description: 'Нет такой команды в системе'
    },
    3002: {
      category: 'Сервисы',
      error: 'Служба не найдена',
      description: 'Нет такой системной службы'
    },
    3003: {
      category: 'Сервисы',
      error: 'Служба остановлена',
      description: 'Служба недоступна/не запущена'
    },
    3004: {
      category: 'Процессы',
      error: 'Таймаут выполнения',
      description: 'Команда превысила время выполнения'
    },
    4001: {
      category: 'Конфигурация',
      error: 'Строка не найдена',
      description: 'Искомая строка отсутствует в файле'
    },
    4002: {
      category: 'Конфигурация',
      error: 'Строка закомментирована',
      description: 'Строка есть, но отключена (закомментирована)'
    },
    4003: {
      category: 'Конфигурация',
      error: 'Неверный формат',
      description: 'Синтаксическая ошибка в конфигурации'
    },
    4004: {
      category: 'Конфигурация',
      error: 'Неверное значение',
      description: 'Параметр имеет недопустимое значение'
    },
    5000: {
      category: 'Критическая',
      error: 'Неизвестная ошибка',
      description: 'Непредвиденная ошибка в скрипте'
    },
    5001: {
      category: 'Критическая',
      error: 'Отсутствует переменная',
      description: 'Нет обязательной переменной окружения'
    },
    5002: {
      category: 'Критическая',
      error: 'Ошибка синтаксиса',
      description: 'Ошибка в обработке данных скриптом'
    }
  };
  
  // Функция для получения описания ошибки по коду
  export function getErrorDescription(errorCode) {
    const code = parseInt(errorCode);
    if (ERROR_CODES[code]) {
      return ERROR_CODES[code];
    }
    
    // Если код не найден, возвращаем общую ошибку
    return {
      category: 'Неизвестно',
      error: `Неизвестный код ошибки: ${errorCode}`,
      description: 'Ошибка не распознана'
    };
  }
  
  // Функция для извлечения кода ошибки из вывода скрипта
  export function extractErrorCode(output) {
    if (!output) return null;
    
    // Ищем паттерн exit code
    const exitMatch = output.match(/exit code:? (\d+)/i);
    if (exitMatch) {
      return parseInt(exitMatch[1]);
    }
    
    // Ищем просто число в конце вывода
    const lines = output.trim().split('\n');
    const lastLine = lines[lines.length - 1];
    const numberMatch = lastLine.match(/^\d+$/);
    if (numberMatch) {
      return parseInt(numberMatch[0]);
    }
    
    return null;
  }