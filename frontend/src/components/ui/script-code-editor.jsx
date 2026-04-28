import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CodeMirror from '@uiw/react-codemirror';
import { indentWithTab } from '@codemirror/commands';
import { indentUnit, StreamLanguage } from '@codemirror/language';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { EditorView, keymap } from '@codemirror/view';
import { Code2, Maximize2, Minimize2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import './script-code-editor.css';

export const ScriptCodeEditor = forwardRef(({
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
  const [editorView, setEditorView] = useState(null);
  const viewRef = useRef(null);

  const safeValue = typeof value === 'string' ? value : '';
  const lineCount = safeValue ? safeValue.split('\n').length : 1;
  const editorHeight = isFullscreen
    ? 'calc(100vh - var(--app-header-height, 4rem) - 45px)'
    : `${maxHeight}px`;

  const extensions = useMemo(() => [
    StreamLanguage.define(shell),
    indentUnit.of(' '.repeat(tabSize)),
    keymap.of([indentWithTab]),
    EditorView.lineWrapping,
  ], [tabSize]);

  useEffect(() => {
    onLinesChange?.(lineCount);
  }, [lineCount, onLinesChange]);

  useEffect(() => {
    if (!editorView || !onScrollCallback) return undefined;

    const scrollElement = editorView.scrollDOM;
    const handleScroll = () => {
      onScrollCallback(scrollElement.scrollTop, scrollElement.scrollLeft);
    };

    scrollElement.addEventListener('scroll', handleScroll);
    return () => scrollElement.removeEventListener('scroll', handleScroll);
  }, [editorView, onScrollCallback]);

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

  const handleChange = useCallback((nextValue) => {
    onChange?.({ target: { value: nextValue } });
  }, [onChange]);

  const handleCreateEditor = useCallback((view) => {
    viewRef.current = view;
    setEditorView(view);
  }, []);

  const setText = useCallback((text) => {
    const nextValue = typeof text === 'string' ? text : '';
    const view = viewRef.current;

    if (view) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: nextValue },
      });
    }

    onChange?.({ target: { value: nextValue } });
  }, [onChange]);

  const exitFullscreen = useCallback(() => {
    setIsFullscreen(false);
    onFullscreenExit?.();
  }, [onFullscreenExit]);

  const enterFullscreen = useCallback(() => {
    setIsFullscreen(true);
    onFullscreenEnter?.();
  }, [onFullscreenEnter]);

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  }, [enterFullscreen, exitFullscreen, isFullscreen]);

  useImperativeHandle(ref, () => ({
    getText: () => safeValue,
    setText,
    getScrollTop: () => viewRef.current?.scrollDOM.scrollTop || 0,
    setScrollTop: (val) => {
      if (viewRef.current) viewRef.current.scrollDOM.scrollTop = val;
    },
    getScrollLeft: () => viewRef.current?.scrollDOM.scrollLeft || 0,
    setScrollLeft: (val) => {
      if (viewRef.current) viewRef.current.scrollDOM.scrollLeft = val;
    },
    enterFullscreen,
    exitFullscreen,
    clear: () => setText(''),
    getCursorPosition: () => {
      const view = viewRef.current;
      if (!view) return { line: 1, column: 1 };

      const position = view.state.selection.main.head;
      const line = view.state.doc.lineAt(position);
      return {
        line: line.number,
        column: position - line.from + 1,
      };
    },
    getLineCount: () => lineCount,
    focus: () => viewRef.current?.focus(),
  }), [enterFullscreen, exitFullscreen, lineCount, safeValue, setText]);

  const editor = (
    <div
      className={cn(
        'script-code-editor',
        isFullscreen && 'script-code-editor-fullscreen',
        className
      )}
      style={!isFullscreen ? { minHeight: `${minHeight}px` } : undefined}
    >
      {showHeader && (
        <div className="script-code-editor-header">
          <div className="script-code-editor-title">
            <Code2 className="h-4 w-4" />
            <span>{title}</span>
          </div>
          <div className="script-code-editor-actions">
            {isFullscreen ? (
              <button
                type="button"
                className="script-code-editor-exit-button"
                onClick={exitFullscreen}
                title="Выйти из полноэкранного режима (Esc)"
              >
                <Minimize2 size={16} />
                <span>Выйти из fullscreen</span>
              </button>
            ) : (
              <button
                type="button"
                className="script-code-editor-button"
                onClick={toggleFullscreen}
                title="Развернуть на весь экран"
              >
                <Maximize2 size={16} />
              </button>
            )}
          </div>
        </div>
      )}
      <CodeMirror
        value={safeValue}
        height={editorHeight}
        minHeight={`${minHeight}px`}
        maxHeight={isFullscreen ? undefined : `${maxHeight}px`}
        placeholder={placeholder}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: false,
        }}
        extensions={extensions}
        onChange={handleChange}
        onCreateEditor={handleCreateEditor}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && isFullscreen) {
            event.preventDefault();
            exitFullscreen();
          }
        }}
      />
    </div>
  );

  if (isFullscreen) {
    return createPortal(
      <>
        <div className="script-code-editor-overlay" onClick={exitFullscreen} />
        {editor}
      </>,
      document.body
    );
  }

  return editor;
});

ScriptCodeEditor.displayName = 'ScriptCodeEditor';

export default ScriptCodeEditor;
