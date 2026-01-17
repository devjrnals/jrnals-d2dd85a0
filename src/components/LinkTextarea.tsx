import { useState, useRef, useEffect } from "react";

interface LinkTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  disabled?: boolean;
  className?: string;
}

export function LinkTextarea({
  value,
  onChange,
  placeholder,
  onKeyDown,
  disabled,
  className = ""
}: LinkTextareaProps) {
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const [isComposing, setIsComposing] = useState(false);

  // URL regex pattern
  const urlRegex = /(https?:\/\/[^\s\)\]\>\"\'\,]+)/gi;

  // Update contentEditable when value prop changes (but not during user typing)
  useEffect(() => {
    if (contentEditableRef.current && !isComposing) {
      const currentText = contentEditableRef.current.innerText;
      if (currentText !== value) {
        updateContent(value);
      }
    }
  }, [value, isComposing]);

  const saveCursorPosition = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !contentEditableRef.current) return null;

    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(contentEditableRef.current);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    return preCaretRange.toString().length;
  };

  const restoreCursorPosition = (position: number) => {
    if (!contentEditableRef.current) return;

    const selection = window.getSelection();
    if (!selection) return;

    const range = document.createRange();
    let charCount = 0;
    let nodeStack = [contentEditableRef.current];
    let node: Node | undefined;
    let foundStart = false;

    while (!foundStart && (node = nodeStack.pop())) {
      if (node.nodeType === Node.TEXT_NODE) {
        const nextCharCount = charCount + (node.textContent?.length || 0);
        if (position <= nextCharCount) {
          range.setStart(node, position - charCount);
          range.setEnd(node, position - charCount);
          foundStart = true;
        }
        charCount = nextCharCount;
      } else {
        let i = node.childNodes.length;
        while (i--) {
          nodeStack.push(node.childNodes[i]);
        }
      }
    }

    if (foundStart) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  };

  const updateContent = (text: string, preserveCursor = false) => {
    if (!contentEditableRef.current) return;

    // Save cursor position if needed
    const cursorPosition = preserveCursor ? saveCursorPosition() : null;

    // Clear existing content
    contentEditableRef.current.innerHTML = "";

    if (!text) {
      return;
    }

    // Split text by URLs and create text nodes and link elements
    const parts: Array<{ type: 'text' | 'link'; content: string }> = [];
    let lastIndex = 0;
    let match;

    urlRegex.lastIndex = 0;
    while ((match = urlRegex.exec(text)) !== null) {
      // Add text before URL
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: text.substring(lastIndex, match.index)
        });
      }

      // Add URL
      let url = match[1].trim();
      url = url.replace(/[.,;!?]+$/, '');
      url = url.replace(/[\)\]\>\"\']+$/, '');

      try {
        new URL(url); // Validate URL
        parts.push({
          type: 'link',
          content: url
        });
        lastIndex = match.index + match[1].length;
      } catch {
        // Invalid URL, treat as text
        parts.push({
          type: 'text',
          content: match[1]
        });
        lastIndex = match.index + match[1].length;
      }
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex)
      });
    }

    // If no URLs found, just add the text
    if (parts.length === 0) {
      parts.push({ type: 'text', content: text });
    }

    // Build HTML content
    parts.forEach((part) => {
      if (part.type === 'link') {
        try {
          const urlObj = new URL(part.content);
          const displayText = urlObj.hostname.replace(/^www\./, '');
          const linkSpan = document.createElement('span');
          linkSpan.className = 'link-wrapper relative inline-block';
          linkSpan.setAttribute('data-url', part.content);
          const link = document.createElement('a');
          link.href = part.content;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.className = 'text-blue-600 dark:text-blue-400 hover:underline cursor-pointer';
          link.textContent = displayText;
          
          // Allow link to open in new tab when clicked
          link.addEventListener('mousedown', (e) => {
            // Don't prevent default - let the link open normally
            // This allows the link to open in a new tab
          });
          
          // Add hover preview functionality
          let previewTimeout: NodeJS.Timeout;
          link.addEventListener('mouseenter', () => {
            clearTimeout(previewTimeout);
            previewTimeout = setTimeout(() => {
              showLinkPreview(linkSpan, part.content);
            }, 300);
          });
          link.addEventListener('mouseleave', () => {
            clearTimeout(previewTimeout);
            previewTimeout = setTimeout(() => {
              hideLinkPreview();
            }, 200);
          });
          
          linkSpan.appendChild(link);
          contentEditableRef.current.appendChild(linkSpan);
        } catch {
          const textNode = document.createTextNode(part.content);
          contentEditableRef.current.appendChild(textNode);
        }
      } else {
        // Handle newlines in text
        const lines = part.content.split('\n');
        lines.forEach((line, index) => {
          if (index > 0) {
            contentEditableRef.current?.appendChild(document.createElement('br'));
          }
          if (line) {
            const textNode = document.createTextNode(line);
            contentEditableRef.current?.appendChild(textNode);
          }
        });
      }
    });

    // Restore cursor position if needed
    if (preserveCursor && cursorPosition !== null) {
      setTimeout(() => {
        restoreCursorPosition(cursorPosition);
      }, 0);
    }
  };

  const handleInput = () => {
    if (!contentEditableRef.current || isComposing) return;

    const text = contentEditableRef.current.innerText;
    onChange(text);
    
    // Only update content with links if text contains URLs and user isn't actively typing
    const hasUrl = /https?:\/\//.test(text);
    if (hasUrl) {
      // Use a longer delay to allow typing to complete
      setTimeout(() => {
        if (contentEditableRef.current?.innerText === text) {
          updateContent(text, true);
        }
      }, 500);
    }
  };

  const showLinkPreview = (element: HTMLElement, url: string) => {
    // Remove existing preview if any
    const existingPreview = document.querySelector('.link-preview-popup');
    if (existingPreview) {
      existingPreview.remove();
    }

    const preview = document.createElement('div');
    preview.className = 'link-preview-popup fixed bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden pointer-events-auto';
    preview.style.width = '320px';
    
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.replace(/^www\./, '');
      preview.innerHTML = `
        <div class="p-4">
          <h4 class="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-1">${hostname}</h4>
          <p class="text-xs text-gray-500 dark:text-gray-500 truncate">${url}</p>
        </div>
      `;
    } catch {
      preview.innerHTML = `
        <div class="p-4">
          <p class="text-sm text-gray-900 dark:text-gray-100 truncate">${url}</p>
        </div>
      `;
    }
    
    document.body.appendChild(preview);
    
    // Position the preview
    const rect = element.getBoundingClientRect();
    preview.style.left = `${rect.left}px`;
    preview.style.top = `${rect.top - preview.offsetHeight - 8}px`;
    
    // Keep preview visible when hovering over it
    preview.addEventListener('mouseenter', () => {
      preview.style.display = 'block';
    });
    preview.addEventListener('mouseleave', () => {
      preview.remove();
    });
  };

  const hideLinkPreview = () => {
    const preview = document.querySelector('.link-preview-popup');
    if (preview) {
      preview.remove();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text/plain');
    const selection = window.getSelection();
    
    if (selection && selection.rangeCount > 0 && contentEditableRef.current) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(pastedText);
      range.insertNode(textNode);
      
      // Move cursor to end of pasted text initially
      range.setStartAfter(textNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      
      const newText = contentEditableRef.current.innerText;
      onChange(newText);
      
      // Check if pasted text contains a URL
      const urlMatch = pastedText.match(/https?:\/\/[^\s\)\]\>\"\'\,]+/);
      const isUrl = urlMatch !== null;
      
      // Update with links after a short delay
      setTimeout(() => {
        if (isUrl && contentEditableRef.current) {
          // Update content first to convert URL to link
          updateContent(newText, false);
          
          // Then position cursor after the link
          setTimeout(() => {
            if (contentEditableRef.current) {
              const linkElements = contentEditableRef.current.querySelectorAll('.link-wrapper');
              if (linkElements.length > 0) {
                const lastLink = linkElements[linkElements.length - 1];
                const range = document.createRange();
                range.setStartAfter(lastLink);
                range.collapse(true);
                const selection = window.getSelection();
                if (selection) {
                  selection.removeAllRanges();
                  selection.addRange(range);
                }
              } else {
                // Fallback: position at end of text
                restoreCursorPosition(newText.length);
              }
            }
          }, 10);
        } else {
          // For non-URL text, preserve cursor position
          const cursorPos = saveCursorPosition();
          updateContent(newText, true);
          if (cursorPos !== null) {
            setTimeout(() => restoreCursorPosition(cursorPos), 0);
          }
        }
      }, 100);
    }
  };

  return (
    <div className="relative">
      <div
        ref={contentEditableRef}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={() => {
          setIsComposing(false);
          handleInput();
        }}
        onKeyDown={onKeyDown}
        data-placeholder={placeholder}
        className={`outline-none whitespace-pre-wrap break-words ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        style={{
          minHeight: '44px',
          maxHeight: '128px',
          overflowY: 'auto',
        }}
        suppressContentEditableWarning
      />
      <style>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
        .link-wrapper a {
          pointer-events: auto;
        }
      `}</style>
    </div>
  );
}

