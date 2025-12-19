# Стили проекта

## Структура стилей

```
frontend/src/
├── styles/                          # Глобальные стили
│   ├── material3.css               # Material Design 3 CSS переменные
│   ├── components.css              # Общие стили компонентов
│   ├── layout.css                  # Стили layout
│   └── themes/                     # Темы
│       ├── base.js                 # Базовые токены
│       ├── material3.js            # MD3 тема
│       └── yellow-black.js         # Кастомная тема
│
├── components/
│   ├── ui/                         # Shadcn UI компоненты (основные)
│   │   ├── button.jsx
│   │   ├── card.jsx
│   │   ├── ...
│   │   └── md3/                    # Material Design 3 компоненты
│   │       ├── index.js            # Экспорт всех MD3 компонентов
│   │       ├── md3-button.css      # Стили кнопок MD3
│   │       └── md3-components.css  # Остальные MD3 компоненты
│   └── layouts/
│       └── MainLayout.css          # Стили layout
│
└── pages/
    └── LoginPage.css               # Стили страницы логина
```

## Использование компонентов

### Shadcn UI (основные компоненты)

Используются повсеместно для форм, диалогов, таблиц и т.д.

```jsx
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
```

### Material Design 3 (layout и интерфейс)

Используются для AppBar, Sidebar и основного интерфейса.

```jsx
import { 
  Button, 
  AppBar, 
  AppBarContent, 
  Sidebar, 
  SidebarContent,
  Card,
  Input,
  Label
} from '@/components/ui/md3';
```

## CSS переменные Material Design 3

Все переменные определены в `styles/material3.css`:

### Цвета

```css
/* Поверхности */
--md-sys-color-surface
--md-sys-color-surface-container
--md-sys-color-on-surface

/* Primary */
--md-sys-color-primary
--md-sys-color-on-primary
--md-sys-color-primary-container
--md-sys-color-on-primary-container

/* Error */
--md-sys-color-error
--md-sys-color-on-error
```

### Типографика

```css
--md-sys-typescale-display-large-font
--md-sys-typescale-headline-large-font
--md-sys-typescale-title-large-font
--md-sys-typescale-body-large-font
--md-sys-typescale-label-large-font
```

### Отступы

```css
--md-sys-spacing-1: 0.25rem
--md-sys-spacing-2: 0.5rem
--md-sys-spacing-3: 0.75rem
--md-sys-spacing-4: 1rem
--md-sys-spacing-6: 1.5rem
--md-sys-spacing-8: 2rem
```

### Закругления

```css
--md-sys-shape-corner-sm: 0.5rem
--md-sys-shape-corner-md: 0.75rem
--md-sys-shape-corner-lg: 1rem
--md-sys-shape-corner-xl: 1.75rem
--md-sys-shape-corner-full: 9999px
```

### Тени (Elevation)

```css
--md-sys-elevation-0 (нет тени)
--md-sys-elevation-1
--md-sys-elevation-2
--md-sys-elevation-3
--md-sys-elevation-4
--md-sys-elevation-5
```

## Как создавать новые стили

### 1. Компонент-специфичные стили

Создайте CSS файл рядом с компонентом:

```
components/MyComponent/
├── MyComponent.jsx
└── MyComponent.css
```

```jsx
// MyComponent.jsx
import './MyComponent.css';

export function MyComponent() {
  return <div className="my-component">...</div>;
}
```

```css
/* MyComponent.css */
.my-component {
  background-color: var(--md-sys-color-surface-container);
  padding: var(--md-sys-spacing-4);
  border-radius: var(--md-sys-shape-corner-md);
}
```

### 2. Страница-специфичные стили

Для стилей конкретной страницы:

```
pages/MyPage/
├── index.jsx
└── MyPage.css
```

### 3. Общие стили

Для переиспользуемых стилей добавьте в `styles/components.css`:

```css
/* styles/components.css */
.status-badge-success {
  background-color: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
}
```

## Утилитарные классы Material Design 3

```css
/* Поверхности */
.md3-surface
.md3-surface-container
.md3-primary
.md3-primary-container

/* Тени */
.md3-elevation-1
.md3-elevation-2
.md3-elevation-3

/* Типографика */
.md3-display-large
.md3-headline-large
.md3-title-large
.md3-body-large
.md3-label-large

/* Эффекты */
.md3-ripple
.md3-state-layer
```

## Tailwind CSS

Tailwind используется для быстрой стилизации:

```jsx
<div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
  ...
</div>
```

Предпочитайте CSS переменные MD3 для цветов основного интерфейса.

## Dark Theme

Тёмная тема автоматически применяется через атрибут `[data-theme="dark"]`.
Все CSS переменные MD3 имеют переопределения для тёмной темы в `material3.css`.

