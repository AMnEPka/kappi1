# Настройка для работы без интернета

## Текущие проблемы

Приложение имеет следующие внешние зависимости:

### Frontend (index.html):
1. ❌ `https://assets.emergent.sh/scripts/emergent-main.js` - скрипт платформы Emergent
2. ❌ `https://unpkg.com/rrweb@latest/dist/rrweb.min.js` - запись сессий
3. ❌ `https://d2adkz2s9zrlge.cloudfront.net/rrweb-recorder-20250919-1.js` - рекордер
4. ❌ PostHog analytics - аналитика (строки 65-131)

### Frontend (CSS):
5. ❌ `https://fonts.googleapis.com/css2?family=Inter` - шрифт Inter из Google Fonts

---

## Решение для полностью оффлайн версии:

### Шаг 1: Удалить внешние скрипты из index.html

Отредактируйте `/app/frontend/public/index.html`:

```html
<!doctype html>
<html lang="en">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#000000" />
        <meta name="description" content="OSIB - SSH Script Runner" />
        <title>OSIB</title>
        
        <!-- УДАЛИТЬ все script теги с внешними URL -->
    </head>
    <body>
        <noscript>You need to enable JavaScript to run this app.</noscript>
        <div id="root"></div>
    </body>
</html>
```

### Шаг 2: Использовать системные шрифты вместо Google Fonts

Отредактируйте `/app/frontend/src/App.css`:

```css
/* БЫЛО:
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
*/

/* СТАЛО - используем системные шрифты: */
* {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

### Шаг 3: Пересобрать фронтенд

```bash
cd /app/frontend
yarn build
```

---

## Альтернатива: Локальный шрифт Inter

Если обязательно нужен шрифт Inter:

1. Скачайте Inter с https://github.com/rsms/inter/releases
2. Поместите файлы в `/app/frontend/public/fonts/`
3. Обновите CSS:

```css
@font-face {
  font-family: 'Inter';
  src: url('/fonts/Inter-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
}

@font-face {
  font-family: 'Inter';
  src: url('/fonts/Inter-Bold.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
}

* {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}
```

---

## Проверка оффлайн режима

После применения изменений, протестируйте:

```bash
# 1. Отключите интернет на сервере
sudo iptables -A OUTPUT -p tcp --dport 80 -j DROP
sudo iptables -A OUTPUT -p tcp --dport 443 -j DROP

# 2. Откройте приложение в браузере
# 3. Проверьте консоль браузера (F12) на ошибки загрузки
# 4. Убедитесь что всё работает

# 5. Восстановите интернет
sudo iptables -F
```

---

## Текущий статус

⚠️ **Приложение НЕ работает без интернета** - требуются вышеуказанные изменения.

После применения изменений:
✅ Все ресурсы будут локальными
✅ Полная работа без интернета
✅ Быстрая загрузка (нет внешних запросов)
