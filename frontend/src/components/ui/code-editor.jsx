import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Подсветка синтаксиса bash с защитой от вложенных тегов
const highlightBash = (code) => {
  if (!code) return '';
  
  // Экранируем HTML
  let highlighted = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Используем маркеры для защиты уже обработанных участков
  const markers = {
    COMMENT: '___COMMENT___',
    STRING_SINGLE: '___STRING_SINGLE___',
    STRING_DOUBLE: '___STRING_DOUBLE___',
    VARIABLE: '___VARIABLE___',
    KEYWORD: '___KEYWORD___',
    OPERATOR: '___OPERATOR___',
    NUMBER: '___NUMBER___'
  };
  
  const replacements = [];
  let markerIndex = 0;
  
  // Комментарии (приоритет 1 - обрабатываем первыми)
  highlighted = highlighted.replace(/(#.*$)/gm, (match) => {
    const marker = `${markers.COMMENT}${markerIndex}___`;
    replacements.push({ marker, html: `<span class="text-slate-500 italic">${match}</span>` });
    markerIndex++;
    return marker;
  });
  
  // Строки в одинарных кавычках
  highlighted = highlighted.replace(/'([^']*)'/g, (match, content) => {
    const marker = `${markers.STRING_SINGLE}${markerIndex}___`;
    replacements.push({ marker, html: `<span class="text-green-600">'${content}'</span>` });
    markerIndex++;
    return marker;
  });
  
  // Строки в двойных кавычках
  highlighted = highlighted.replace(/"([^"]*)"/g, (match, content) => {
    const marker = `${markers.STRING_DOUBLE}${markerIndex}___`;
    replacements.push({ marker, html: `<span class="text-green-600">"${content}"</span>` });
    markerIndex++;
    return marker;
  });
  
  // Переменные $VAR или ${VAR} (только вне строк)
  highlighted = highlighted.replace(/\$\{?([a-zA-Z_][a-zA-Z0-9_]*)\}?/g, (match) => {
    // Пропускаем, если это часть маркера
    if (match.includes('___')) return match;
    const marker = `${markers.VARIABLE}${markerIndex}___`;
    replacements.push({ marker, html: `<span class="text-blue-600">${match}</span>` });
    markerIndex++;
    return marker;
  });
  
  // Ключевые слова bash (только целые слова)
  const keywords = [
    'if', 'then', 'else', 'elif', 'fi', 'case', 'esac',
    'for', 'while', 'until', 'do', 'done',
    'function', 'select', 'time',
    'export', 'readonly', 'local', 'declare', 'typeset',
    'return', 'break', 'continue', 'exit',
    'test', 'true', 'false', 'null'
  ];
  
  keywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'g');
    highlighted = highlighted.replace(regex, (match) => {
      // Пропускаем, если это часть маркера
      if (match.includes('___')) return match;
      const marker = `${markers.KEYWORD}${markerIndex}___`;
      replacements.push({ marker, html: `<span class="text-purple-600 font-semibold">${match}</span>` });
      markerIndex++;
      return marker;
    });
  });
  
  // Операторы (только вне строк и комментариев)
  highlighted = highlighted.replace(/(&&|\|\||==|!=|<=|>=|[=<>])/g, (match) => {
    // Пропускаем, если это часть маркера
    if (match.includes('___')) return match;
    const marker = `${markers.OPERATOR}${markerIndex}___`;
    replacements.push({ marker, html: `<span class="text-orange-600">${match}</span>` });
    markerIndex++;
    return marker;
  });
  
  // Числа (только целые слова)
  highlighted = highlighted.replace(/\b(\d+)\b/g, (match) => {
    if (match.includes('___')) return match;
    const marker = `${markers.NUMBER}${markerIndex}___`;
    replacements.push({ marker, html: `<span class="text-cyan-600">${match}</span>` });
    markerIndex++;
    return marker;
  });
  
  // Заменяем маркеры на HTML
  replacements.forEach(({ marker, html }) => {
    highlighted = highlighted.replace(marker, html);
  });
  
  return highlighted;
};

export function CodeEditor({ 
  value, 
  onChange, 
  placeholder = '', 
  className = '',
  rows = 15 
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const textareaRef = useRef(null);
  const lineNumbersRef = useRef(null);
  const highlightRef = useRef(null);
  const editorContainerRef = useRef(null);
  
  const lines = value ? value.split('\n') : [''];
  const lineCount = lines.length;
  
  // Синхронизация прокрутки - textarea является источником истины
  const handleScroll = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    // Синхронизируем вертикальную прокрутку: нумерация и подсветка следуют за textarea
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textarea.scrollTop;
    }
    if (highlightRef.current) {
      highlightRef.current.scrollTop = textarea.scrollTop;
    }
  };
  
  // Синхронизация горизонтальной прокрутки через контейнер
  useEffect(() => {
    const container = editorContainerRef.current;
    const textarea = textareaRef.current;
    const highlight = highlightRef.current;
    
    if (!container || !textarea || !highlight) return;
    
    const syncHorizontalScroll = () => {
      // Синхронизируем горизонтальную прокрутку подсветки с контейнером
      highlight.scrollLeft = container.scrollLeft;
    };
    
    container.addEventListener('scroll', syncHorizontalScroll);
    return () => {
      container.removeEventListener('scroll', syncHorizontalScroll);
    };
  }, [value]);
  
  // Убираем автоматическое изменение высоты - используем фиксированную высоту с прокруткой
  
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };
  
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);
  
  const editorContent = (
    <div className={cn(
      "relative border rounded-lg bg-slate-50 flex flex-col",
      isFullscreen ? "fixed inset-0 z-50 rounded-none" : "",
      className
    )} style={isFullscreen ? { height: '100vh' } : { maxHeight: '600px' }}>
      {/* Панель инструментов */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-100 border-b flex-shrink-0">
        <span className="text-xs text-slate-600 font-medium">Bash Script</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggleFullscreen}
          className="h-7 w-7 p-0"
        >
          {isFullscreen ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      {/* Редактор */}
      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        {/* Нумерация строк - без скроллбара, синхронизируется с textarea */}
        <div
          ref={lineNumbersRef}
          className="flex-shrink-0 px-3 py-2 bg-slate-100 border-r text-right text-xs text-slate-500 font-mono select-none overflow-hidden"
          style={{ 
            minWidth: `${String(lineCount).length * 0.6 + 1}em`,
            lineHeight: '1.5rem',
            paddingTop: '0.5rem',
            paddingBottom: '0.5rem'
          }}
        >
          {lines.map((_, index) => (
            <div key={index} style={{ lineHeight: '1.5rem', height: '1.5rem' }}>
              {index + 1}
            </div>
          ))}
        </div>
        
        {/* Область редактирования */}
        <div className="flex-1 relative min-w-0 overflow-hidden">
          {/* Подсветка синтаксиса (фон) - без прокрутки, синхронизируется */}
          {value ? (
            <div
              ref={highlightRef}
              className="absolute inset-0 py-2 px-3 pointer-events-none font-mono text-sm whitespace-pre overflow-hidden"
              style={{ 
                lineHeight: '1.5rem',
                paddingTop: '0.5rem',
                paddingBottom: '0.5rem',
                minWidth: 'max-content'
              }}
              dangerouslySetInnerHTML={{ 
                __html: highlightBash(value)
              }}
            />
          ) : (
            <div
              ref={highlightRef}
              className="absolute inset-0 py-2 px-3 pointer-events-none font-mono text-sm whitespace-pre text-slate-400 overflow-hidden"
              style={{ 
                lineHeight: '1.5rem',
                paddingTop: '0.5rem',
                paddingBottom: '0.5rem'
              }}
            >
              {placeholder}
            </div>
          )}
          
          {/* Контейнер с горизонтальным скроллбаром внизу */}
          <div 
            ref={editorContainerRef}
            className="absolute inset-0 overflow-x-auto overflow-y-hidden pointer-events-none"
            style={{ zIndex: 1 }}
          >
            <div style={{ minWidth: 'max-content', height: '100%' }} />
          </div>
          
          {/* Текстовое поле - с вертикальным скроллбаром, поверх всего */}
          <textarea
            ref={textareaRef}
            value={value || ''}
            onChange={(e) => onChange(e)}
            onScroll={handleScroll}
            placeholder=""
            className="absolute inset-0 w-full h-full py-2 px-3 bg-transparent font-mono text-sm resize-none border-0 outline-none caret-slate-900 overflow-y-auto overflow-x-hidden whitespace-pre"
            style={{ 
              lineHeight: '1.5rem',
              tabSize: 2,
              color: 'transparent',
              textShadow: '0 0 0 rgba(0, 0, 0, 0)',
              WebkitTextFillColor: 'transparent',
              paddingTop: '0.5rem',
              paddingBottom: '0.5rem',
              margin: 0,
              minWidth: 'max-content',
              zIndex: 2
            }}
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
  
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-white">
        {editorContent}
      </div>
    );
  }
  
  return editorContent;
}
