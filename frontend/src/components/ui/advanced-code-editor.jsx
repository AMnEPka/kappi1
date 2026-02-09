import { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Maximize2, Minimize2, X, Code2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import './advanced-code-editor.css';

// Simple text display without syntax highlighting (disabled due to marker bugs)
const highlightBash = (code) => {
  if (!code) return '';
  
  // Just escape HTML and return plain text
  return code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

export const AdvancedCodeEditor = forwardRef(({ 
  value = '', 
  onChange, 
  placeholder = '', 
  className = '',
  title = 'Code Editor',
  tabSize = 4,
  showHeader = true,
  minHeight = 300,
  maxHeight = 600,
  onFullscreenEnter,
  onFullscreenExit,
  onLinesChange,
  onScroll: onScrollCallback,
}, ref) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  
  // Scrollbar state
  const [verticalThumbHeight, setVerticalThumbHeight] = useState(0);
  const [verticalThumbTop, setVerticalThumbTop] = useState(0);
  const [horizontalThumbWidth, setHorizontalThumbWidth] = useState(0);
  const [horizontalThumbLeft, setHorizontalThumbLeft] = useState(0);
  const [showVerticalScrollbar, setShowVerticalScrollbar] = useState(false);
  const [showHorizontalScrollbar, setShowHorizontalScrollbar] = useState(false);
  const [isDraggingVertical, setIsDraggingVertical] = useState(false);
  const [isDraggingHorizontal, setIsDraggingHorizontal] = useState(false);
  
  // Refs
  const containerRef = useRef(null);
  const textareaRef = useRef(null);
  const lineNumbersRef = useRef(null);
  const highlightRef = useRef(null);
  const contentWrapperRef = useRef(null);
  const verticalTrackRef = useRef(null);
  const horizontalTrackRef = useRef(null);
  const dragStartRef = useRef({ y: 0, x: 0, scrollTop: 0, scrollLeft: 0 });
  
  const lines = value ? value.split('\n') : [''];
  const lineCount = lines.length;
  
  // Calculate line number width (minimum 3 characters)
  const lineNumberWidth = Math.max(3, String(lineCount).length) * 10 + 20;
  
  // Notify about line count changes
  useEffect(() => {
    onLinesChange?.(lineCount);
  }, [lineCount, onLinesChange]);

  // Calculate scrollbar dimensions
  const updateScrollbars = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const { scrollHeight, scrollWidth, clientHeight, clientWidth, scrollTop, scrollLeft } = textarea;
    
    // Vertical scrollbar
    const needsVerticalScroll = scrollHeight > clientHeight;
    setShowVerticalScrollbar(needsVerticalScroll);
    
    if (needsVerticalScroll) {
      const trackHeight = clientHeight - 15; // Account for horizontal scrollbar
      const thumbHeight = Math.max(30, (clientHeight / scrollHeight) * trackHeight);
      const maxScrollTop = scrollHeight - clientHeight;
      const thumbTop = maxScrollTop > 0 ? (scrollTop / maxScrollTop) * (trackHeight - thumbHeight) : 0;
      
      setVerticalThumbHeight(thumbHeight);
      setVerticalThumbTop(thumbTop);
    }
    
    // Horizontal scrollbar
    const needsHorizontalScroll = scrollWidth > clientWidth;
    setShowHorizontalScrollbar(needsHorizontalScroll);
    
    if (needsHorizontalScroll) {
      const trackWidth = clientWidth - 15; // Account for vertical scrollbar
      const thumbWidth = Math.max(50, (clientWidth / scrollWidth) * trackWidth);
      const maxScrollLeft = scrollWidth - clientWidth;
      const thumbLeft = maxScrollLeft > 0 ? (scrollLeft / maxScrollLeft) * (trackWidth - thumbWidth) : 0;
      
      setHorizontalThumbWidth(thumbWidth);
      setHorizontalThumbLeft(thumbLeft);
    }
  }, []);

  // Sync scroll across elements
  const handleScroll = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    // Sync line numbers vertically
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textarea.scrollTop;
    }
    
    // Sync highlight layer
    if (highlightRef.current) {
      highlightRef.current.scrollTop = textarea.scrollTop;
      highlightRef.current.scrollLeft = textarea.scrollLeft;
    }
    
    updateScrollbars();
    onScrollCallback?.(textarea.scrollTop, textarea.scrollLeft);
  }, [updateScrollbars, onScrollCallback]);

  // Handle vertical scrollbar drag
  const handleVerticalDragStart = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingVertical(true);
    dragStartRef.current = {
      y: e.clientY,
      scrollTop: textareaRef.current?.scrollTop || 0
    };
  }, []);

  const handleHorizontalDragStart = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingHorizontal(true);
    dragStartRef.current = {
      x: e.clientX,
      scrollLeft: textareaRef.current?.scrollLeft || 0
    };
  }, []);

  // Handle mouse move during drag
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDraggingVertical && textareaRef.current && verticalTrackRef.current) {
        const textarea = textareaRef.current;
        const trackHeight = textarea.clientHeight - 15;
        const maxScrollTop = textarea.scrollHeight - textarea.clientHeight;
        const deltaY = e.clientY - dragStartRef.current.y;
        const scrollRatio = deltaY / (trackHeight - verticalThumbHeight);
        
        textarea.scrollTop = Math.max(0, Math.min(maxScrollTop, dragStartRef.current.scrollTop + scrollRatio * maxScrollTop));
        handleScroll();
      }
      
      if (isDraggingHorizontal && textareaRef.current && horizontalTrackRef.current) {
        const textarea = textareaRef.current;
        const trackWidth = textarea.clientWidth - 15;
        const maxScrollLeft = textarea.scrollWidth - textarea.clientWidth;
        const deltaX = e.clientX - dragStartRef.current.x;
        const scrollRatio = deltaX / (trackWidth - horizontalThumbWidth);
        
        textarea.scrollLeft = Math.max(0, Math.min(maxScrollLeft, dragStartRef.current.scrollLeft + scrollRatio * maxScrollLeft));
        handleScroll();
      }
    };

    const handleMouseUp = () => {
      setIsDraggingVertical(false);
      setIsDraggingHorizontal(false);
    };

    if (isDraggingVertical || isDraggingHorizontal) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingVertical, isDraggingHorizontal, verticalThumbHeight, horizontalThumbWidth, handleScroll]);

  // Handle click on scrollbar track
  const handleVerticalTrackClick = useCallback((e) => {
    if (e.target !== verticalTrackRef.current) return;
    
    const textarea = textareaRef.current;
    const track = verticalTrackRef.current;
    if (!textarea || !track) return;
    
    const rect = track.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const trackHeight = textarea.clientHeight - 15;
    const scrollRatio = clickY / trackHeight;
    const maxScrollTop = textarea.scrollHeight - textarea.clientHeight;
    
    textarea.scrollTop = scrollRatio * maxScrollTop;
    handleScroll();
  }, [handleScroll]);

  const handleHorizontalTrackClick = useCallback((e) => {
    if (e.target !== horizontalTrackRef.current) return;
    
    const textarea = textareaRef.current;
    const track = horizontalTrackRef.current;
    if (!textarea || !track) return;
    
    const rect = track.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const trackWidth = textarea.clientWidth - 15;
    const scrollRatio = clickX / trackWidth;
    const maxScrollLeft = textarea.scrollWidth - textarea.clientWidth;
    
    textarea.scrollLeft = scrollRatio * maxScrollLeft;
    handleScroll();
  }, [handleScroll]);

  // Handle Tab key
  const handleKeyDown = useCallback((e) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    // ESC - exit fullscreen
    if (e.key === 'Escape' && isFullscreen) {
      e.preventDefault();
      setIsFullscreen(false);
      onFullscreenExit?.();
      return;
    }
    
    // Tab - insert spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const spaces = ' '.repeat(tabSize);
      
      if (e.shiftKey) {
        // Shift+Tab - remove indentation
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        const lineText = value.substring(lineStart, start);
        const leadingSpaces = lineText.match(/^[ ]{0,4}/)?.[0] || '';
        
        if (leadingSpaces.length > 0) {
          const newValue = value.substring(0, lineStart) + 
            value.substring(lineStart + leadingSpaces.length);
          onChange?.({ target: { value: newValue } });
          
          // Restore cursor position
          requestAnimationFrame(() => {
            textarea.selectionStart = Math.max(lineStart, start - leadingSpaces.length);
            textarea.selectionEnd = Math.max(lineStart, end - leadingSpaces.length);
          });
        }
      } else {
        // Tab - add indentation
        const newValue = value.substring(0, start) + spaces + value.substring(end);
        onChange?.({ target: { value: newValue } });
        
        // Restore cursor position
        requestAnimationFrame(() => {
          textarea.selectionStart = start + tabSize;
          textarea.selectionEnd = start + tabSize;
        });
      }
    }
  }, [value, onChange, tabSize, isFullscreen, onFullscreenExit]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    const newState = !isFullscreen;
    setIsFullscreen(newState);
    
    if (newState) {
      onFullscreenEnter?.();
    } else {
      onFullscreenExit?.();
    }
  }, [isFullscreen, onFullscreenEnter, onFullscreenExit]);

  // Handle body overflow in fullscreen
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

  // Update scrollbars on value/resize change
  useEffect(() => {
    updateScrollbars();
    
    const resizeObserver = new ResizeObserver(() => {
      updateScrollbars();
    });
    
    if (textareaRef.current) {
      resizeObserver.observe(textareaRef.current);
    }
    
    return () => resizeObserver.disconnect();
  }, [value, updateScrollbars, isFullscreen]);

  // Expose API methods via ref
  useImperativeHandle(ref, () => ({
    getText: () => value,
    setText: (text) => onChange?.({ target: { value: text } }),
    getScrollTop: () => textareaRef.current?.scrollTop || 0,
    setScrollTop: (val) => {
      if (textareaRef.current) {
        textareaRef.current.scrollTop = val;
        handleScroll();
      }
    },
    getScrollLeft: () => textareaRef.current?.scrollLeft || 0,
    setScrollLeft: (val) => {
      if (textareaRef.current) {
        textareaRef.current.scrollLeft = val;
        handleScroll();
      }
    },
    enterFullscreen: () => {
      setIsFullscreen(true);
      onFullscreenEnter?.();
    },
    exitFullscreen: () => {
      setIsFullscreen(false);
      onFullscreenExit?.();
    },
    clear: () => onChange?.({ target: { value: '' } }),
    getCursorPosition: () => {
      const textarea = textareaRef.current;
      if (!textarea) return { line: 1, column: 1 };
      
      const pos = textarea.selectionStart;
      const textBefore = value.substring(0, pos);
      const lines = textBefore.split('\n');
      
      return {
        line: lines.length,
        column: lines[lines.length - 1].length + 1
      };
    },
    getLineCount: () => lineCount,
    focus: () => textareaRef.current?.focus()
  }), [value, onChange, lineCount, handleScroll, onFullscreenEnter, onFullscreenExit]);

  const editorContent = (
    <div 
      ref={containerRef}
      className={cn(
        "ace-container",
        isFullscreen && "ace-fullscreen",
        isFocused && "ace-focused",
        className
      )}
      style={!isFullscreen ? { 
        minHeight: `${minHeight}px`,
        maxHeight: `${maxHeight}px`
      } : undefined}
    >
      {/* Header */}
      {showHeader && (
        <div className="ace-header">
          <div className="ace-header-left">
            <button
              type="button"
              className="ace-header-btn"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Выход из полноэкранного режима (Esc)' : 'Развернуть на весь экран'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
        </div>
      )}

      {/* Main Editor Container */}
      <div className="ace-editor-wrapper">
        {/* Line Numbers */}
        <div
          ref={lineNumbersRef}
          className="ace-line-numbers"
          style={{ width: `${lineNumberWidth}px` }}
          aria-hidden="true"
        >
          {lines.map((_, index) => (
            <div key={index} className="ace-line-number">
              {index + 1}
            </div>
          ))}
        </div>

        {/* Content Area */}
        <div 
          ref={contentWrapperRef}
          className="ace-content-wrapper"
        >
          {/* Syntax Highlight Layer */}
          <div
            ref={highlightRef}
            className="ace-highlight-layer"
            aria-hidden="true"
          >
            {value ? (
              <div 
                className="ace-highlight-content"
                dangerouslySetInnerHTML={{ __html: highlightBash(value) }}
              />
            ) : (
              <div className="ace-placeholder">{placeholder}</div>
            )}
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={onChange}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className="ace-textarea"
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            role="textbox"
            aria-label={title}
            aria-multiline="true"
          />

          {/* Vertical Scrollbar */}
          {showVerticalScrollbar && (
            <div 
              ref={verticalTrackRef}
              className={cn("ace-scrollbar-vertical", isDraggingVertical && "ace-scrollbar-active")}
              onClick={handleVerticalTrackClick}
            >
              <div 
                className="ace-scrollbar-thumb"
                style={{ 
                  height: `${verticalThumbHeight}px`,
                  transform: `translateY(${verticalThumbTop}px)`
                }}
                onMouseDown={handleVerticalDragStart}
              />
            </div>
          )}

          {/* Horizontal Scrollbar */}
          {showHorizontalScrollbar && (
            <div 
              ref={horizontalTrackRef}
              className={cn("ace-scrollbar-horizontal", isDraggingHorizontal && "ace-scrollbar-active")}
              onClick={handleHorizontalTrackClick}
            >
              <div 
                className="ace-scrollbar-thumb"
                style={{ 
                  width: `${horizontalThumbWidth}px`,
                  transform: `translateX(${horizontalThumbLeft}px)`
                }}
                onMouseDown={handleHorizontalDragStart}
              />
            </div>
          )}

          {/* Corner fill when both scrollbars are visible */}
          {showVerticalScrollbar && showHorizontalScrollbar && (
            <div className="ace-scrollbar-corner" />
          )}
        </div>
      </div>
    </div>
  );

  // Render with fullscreen overlay
  if (isFullscreen) {
    return (
      <>
        <div className="ace-overlay" onClick={() => {
          setIsFullscreen(false);
          onFullscreenExit?.();
        }} />
        {editorContent}
      </>
    );
  }

  return editorContent;
});

AdvancedCodeEditor.displayName = 'AdvancedCodeEditor';

export default AdvancedCodeEditor;
