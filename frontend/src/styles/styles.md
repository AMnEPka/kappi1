src/
├── styles/
│   ├── themes/
│   │   ├── base.js          # Базовые токены (цвета, шрифты, отступы)
│   │   ├── material-you.js  # Material Design 3 тема
│   │   └── yellow-black.js  # Наша кастомная желто-черная тема
│   ├── components/
│   │   ├── button.css.js
│   │   ├── card.css.js
│   │   ├── input.css.js
│   │   └── ...
│   ├── pages/
│   │   ├── layout.css.js
│   │   ├── projects.css.js
│   │   └── ...
│   └── globals.css          # Глобальные сбросы и утилиты
├── providers/
│   └── ThemeProvider.js     # Провайдер темы
└── hooks/
    └── useTheme.js          # Хук для использования темы