import * as React from "react"
import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ 
  className, 
  type, 
  name, 
  // Новые пропсы для управления автозаполнением
  allowAutoComplete = false,  // Явное разрешение
  autoComplete: explicitAutoComplete, // Явное значение (приоритетное)
  ...props 
}, ref) => {
  
  // Функция определяет значение autoComplete по умолчанию
  const getAutoCompleteValue = () => {
    // 1. Если передано явное значение — используем его (самый высокий приоритет)
    if (explicitAutoComplete !== undefined) {
      return explicitAutoComplete;
    }
    
    // 2. Если явно разрешено автозаполнение (для формы логина)
    if (allowAutoComplete) {
      if (type === 'password') {
        return 'current-password';
      }
      if (name === 'username' || name === 'email') {
        return 'username';
      }
    }
    
    // 3. Умные значения по умолчанию для остальных случаев
    if (type === 'password') {
      // Для всех паролей вне логина — запрещаем подсказки
      return 'new-password';
    }
    
    // 4. Для всех остальных полей — отключаем автозаполнение
    return 'off';
  };

  return (
    <input
      type={type}
      name={name}
      className={cn(
        "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-base shadow-sm transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      autoComplete={getAutoCompleteValue()} // <-- Автоматическое определение
      {...props} />
  );
})
Input.displayName = "Input"

export { Input }