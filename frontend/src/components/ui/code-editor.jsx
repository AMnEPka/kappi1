import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Simple text display without syntax highlighting (disabled due to marker bugs)
const highlightBash = (code) => {
  if (!code) return '';
  
  // Just escape HTML and return plain text
  return code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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
