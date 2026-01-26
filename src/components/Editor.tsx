import { useState, useEffect, useRef, useCallback } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

type EditorProps = {
  journalId?: string;
  initialContent?: string;
  onWordCountChange?: (count: number) => void;
  currentQuiz?: any;
  currentQuestionIndex?: number;
  quizResults?: any[];
  showQuizResults?: boolean;
  onQuizAnswer?: (answer: number) => void;
  onExitQuiz?: () => void;
  onQuizAdded?: () => void;
  currentFlashcards?: any;
  onFlashcardsAdded?: () => void;
  onInsertContentReady?: (insertFn: (content: string) => void) => void;
  onGenerateQuiz?: (content: string) => Promise<void>;
};

export const Editor = ({
  journalId,
  initialContent = "",
  onWordCountChange,
  onInsertContentReady,
}: EditorProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const quillRef = useRef<ReactQuill>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // #region agent log
  const logFormatting = useCallback((action: string, data: any) => {
    fetch('http://127.0.0.1:7243/ingest/505803cc-574b-40ed-a9f8-e9c2e267e4a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Editor.tsx:36',message:action,data:{...data,contentLength:content?.length,hasBold:content?.includes('<strong>')||content?.includes('<b>'),hasItalic:content?.includes('<em>')||content?.includes('<i>'),hasUnderline:content?.includes('<u>')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  }, [content]);
  // #endregion

  // Initialize content - handle both HTML and legacy JSON formats
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/505803cc-574b-40ed-a9f8-e9c2e267e4a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Editor.tsx:39',message:'Initializing content',data:{hasInitialContent:!!initialContent,initialContentLength:initialContent?.length,initialContentPreview:initialContent?.substring(0,200),hasHtmlTags:initialContent?.includes('<'),hasBold:initialContent?.includes('<strong>')||initialContent?.includes('<b>'),hasItalic:initialContent?.includes('<em>')||initialContent?.includes('<i>'),hasUnderline:initialContent?.includes('<u>'),hasMarkdownBold:initialContent?.includes('**'),hasMarkdownItalic:initialContent?.includes('*')&&!initialContent?.includes('**')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    if (initialContent) {
      // Check if it's JSON (legacy format) or HTML
      try {
        const parsed = JSON.parse(initialContent);
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/505803cc-574b-40ed-a9f8-e9c2e267e4a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Editor.tsx:45',message:'Parsed as JSON',data:{isArray:Array.isArray(parsed),parsedLength:Array.isArray(parsed)?parsed.length:0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        
        // If it parses as JSON, it's legacy format - extract text content
        if (Array.isArray(parsed)) {
          // Extract text from blocks and convert to HTML
          const htmlParts: string[] = [];
          parsed.forEach((block: any) => {
            if (block.type === 'text' || block.type === 'paragraph') {
              htmlParts.push(`<p>${(block.content || '').replace(/\n/g, '<br>')}</p>`);
            } else if (block.type === 'heading1') {
              htmlParts.push(`<h1>${block.content || ''}</h1>`);
            } else if (block.type === 'heading2') {
              htmlParts.push(`<h2>${block.content || ''}</h2>`);
            } else if (block.type === 'heading3') {
              htmlParts.push(`<h3>${block.content || ''}</h3>`);
            } else if (block.type === 'quote') {
              htmlParts.push(`<blockquote>${block.content || ''}</blockquote>`);
            } else if (block.type === 'bulletList') {
              htmlParts.push(`<ul><li>${block.content || ''}</li></ul>`);
            } else if (block.type === 'numberedList') {
              htmlParts.push(`<ol><li>${block.content || ''}</li></ol>`);
            } else if (block.content) {
              htmlParts.push(`<p>${block.content}</p>`);
            }
          });
          const convertedContent = htmlParts.join('') || '';
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/505803cc-574b-40ed-a9f8-e9c2e267e4a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Editor.tsx:67',message:'Converted JSON to HTML',data:{convertedLength:convertedContent.length,convertedPreview:convertedContent.substring(0,200),hasBold:convertedContent.includes('<strong>')||convertedContent.includes('<b>'),hasItalic:convertedContent.includes('<em>')||convertedContent.includes('<i>'),hasUnderline:convertedContent.includes('<u>'),hasMarkdownBold:convertedContent.includes('**')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          setContent(convertedContent);
        } else {
          setContent(initialContent);
        }
      } catch {
        // Not JSON, treat as HTML or plain text
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/505803cc-574b-40ed-a9f8-e9c2e267e4a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Editor.tsx:71',message:'Not JSON, treating as HTML/text',data:{hasHtmlTags:initialContent.includes('<'),hasBold:initialContent.includes('<strong>')||initialContent.includes('<b>'),hasItalic:initialContent.includes('<em>')||initialContent.includes('<i>'),hasUnderline:initialContent.includes('<u>')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        
        // If it looks like plain text (no HTML tags), wrap it in paragraphs
        if (initialContent && !initialContent.includes('<') && !initialContent.includes('>')) {
          // Check if it contains markdown syntax
          if (initialContent.includes('**') || initialContent.includes('*') || initialContent.includes('__') || initialContent.includes('~~')) {
            // Convert markdown to HTML first
            const htmlContent = markdownToHtml(initialContent);
            const paragraphs = htmlContent.split('\n\n').filter(p => p.trim());
            setContent(paragraphs.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join(''));
          } else {
            const paragraphs = initialContent.split('\n\n').filter(p => p.trim());
            setContent(paragraphs.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join(''));
          }
        } else {
          // Check if HTML content contains markdown syntax (shouldn't happen, but handle it)
          if (initialContent.includes('**') || (initialContent.includes('*') && !initialContent.match(/<[^>]*>/))) {
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/505803cc-574b-40ed-a9f8-e9c2e267e4a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Editor.tsx:100',message:'HTML contains markdown, converting',data:{initialContentPreview:initialContent.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
            // #endregion
            setContent(markdownToHtml(initialContent));
          } else {
            setContent(initialContent);
          }
        }
      }
    } else {
      setContent("");
    }
  }, [initialContent]);

  // Convert markdown to HTML
  const markdownToHtml = useCallback((markdown: string): string => {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/505803cc-574b-40ed-a9f8-e9c2e267e4a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Editor.tsx:109',message:'Converting markdown to HTML',data:{markdownLength:markdown.length,markdownPreview:markdown.substring(0,200),hasMarkdownBold:markdown.includes('**'),hasMarkdownItalic:markdown.includes('*')&&!markdown.includes('**')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
    // #endregion
    
    let html = markdown;
    
    // Convert markdown bold **text** to <strong>text</strong>
    html = html.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
    
    // Convert markdown italic *text* to <em>text</em> (but not **text**)
    html = html.replace(/(?<!\*)\*([^*\s][^*]*?[^*\s])\*(?!\*)/g, '<em>$1</em>');
    html = html.replace(/(?<!\*)\*([^*\s])\*(?!\*)/g, '<em>$1</em>');
    
    // Convert markdown underline __text__ to <u>text</u>
    html = html.replace(/__([^_]+?)__/g, '<u>$1</u>');
    
    // Convert markdown strikethrough ~~text~~ to <s>text</s>
    html = html.replace(/~~([^~]+?)~~/g, '<s>$1</s>');
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/505803cc-574b-40ed-a9f8-e9c2e267e4a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Editor.tsx:125',message:'Markdown conversion complete',data:{htmlLength:html.length,htmlPreview:html.substring(0,200),hasBold:html.includes('<strong>')||html.includes('<b>'),hasItalic:html.includes('<em>')||html.includes('<i>'),hasUnderline:html.includes('<u>'),hasStrike:html.includes('<s>'),hasMarkdownBold:html.includes('**')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
    // #endregion
    
    return html;
  }, []);

  // Calculate word count from HTML content
  const calculateWordCount = useCallback((htmlContent: string) => {
    // Create a temporary div to extract text from HTML
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlContent;
    const text = tempDiv.textContent || tempDiv.innerText || "";
    const words = text.trim().split(/\s+/).filter((word) => word.length > 0);
    return words.length;
  }, []);

  // Update word count when content changes
  useEffect(() => {
    if (onWordCountChange) {
      const wordCount = calculateWordCount(content);
      onWordCountChange(wordCount);
    }
  }, [content, calculateWordCount, onWordCountChange]);

  // Auto-save content
  useEffect(() => {
    if (!journalId) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      if (!journalId) return;

      // Get user for security check
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        console.error("Cannot save: user not authenticated");
        return;
      }

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/505803cc-574b-40ed-a9f8-e9c2e267e4a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Editor.tsx:123',message:'Saving content',data:{contentLength:content.length,contentPreview:content.substring(0,200),hasBold:content.includes('<strong>')||content.includes('<b>'),hasItalic:content.includes('<em>')||content.includes('<i>'),hasUnderline:content.includes('<u>'),hasStrike:content.includes('<s>')||content.includes('<strike>'),hasMarkdownBold:content.includes('**'),hasMarkdownItalic:content.includes('*')&&!content.includes('**')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      
      // SECURITY: Verify ownership before updating
      const { error } = await supabase
        .from("journals")
        .update({ content })
        .eq("id", journalId)
        .eq("user_id", authUser.id); // Only update if user owns it

      if (error) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/505803cc-574b-40ed-a9f8-e9c2e267e4a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Editor.tsx:130',message:'Save error',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
        // #endregion
        console.error("Error saving journal:", error);
        toast({ title: "Error saving", variant: "destructive" });
      } else {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/505803cc-574b-40ed-a9f8-e9c2e267e4a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Editor.tsx:133',message:'Save successful',data:{journalId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
        // #endregion
        console.log("Successfully saved journal", journalId);
      }
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [content, journalId, toast]);

  // Set tooltips for toolbar buttons
  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (quill) {
      const toolbar = quill.getModule('toolbar');
      const toolbarElement = toolbar?.container;
      
      if (toolbarElement) {
        // Map of button classes to tooltip text
        const tooltips: Record<string, string> = {
          'ql-bold': 'Bold',
          'ql-italic': 'Italic',
          'ql-underline': 'Underline',
          'ql-strike': 'Strikethrough',
          'ql-header': 'Heading',
          'ql-list': 'List',
          'ql-indent': 'Indent',
          'ql-link': 'Link',
          'ql-image': 'Image',
          'ql-color': 'Text Color',
          'ql-background': 'Background Color',
          'ql-clean': 'Clear Formatting',
        };
        
        // Set tooltips for buttons
        toolbarElement.querySelectorAll('button').forEach((button: HTMLButtonElement) => {
          const className = Array.from(button.classList).find(cls => cls.startsWith('ql-'));
          if (className) {
            const tooltip = tooltips[className] || button.getAttribute('title') || '';
            if (tooltip) {
              button.setAttribute('title', tooltip);
              button.setAttribute('data-tooltip', tooltip);
            }
          }
        });
        
        // Set tooltips for picker labels
        toolbarElement.querySelectorAll('.ql-picker-label').forEach((label: HTMLElement) => {
          const picker = label.closest('.ql-picker');
          if (picker) {
            const pickerType = Array.from(picker.classList).find(cls => cls.startsWith('ql-'));
            if (pickerType) {
              const tooltipMap: Record<string, string> = {
                'ql-header': 'Heading',
                'ql-size': 'Font Size',
                'ql-font': 'Font Family',
                'ql-color': 'Text Color',
                'ql-background': 'Background Color',
                'ql-align': 'Text Alignment',
              };
              const tooltip = tooltipMap[pickerType] || '';
              if (tooltip) {
                label.setAttribute('title', tooltip);
                label.setAttribute('data-tooltip', tooltip);
              }
            }
          }
        });
      }
    }
  }, [content]); // Re-run when content changes to catch toolbar updates

  // Expose insert content function via callback
  useEffect(() => {
    if (onInsertContentReady) {
      const insertContent = (text: string) => {
        const quill = quillRef.current?.getEditor();
        if (quill) {
          const range = quill.getSelection();
          const index = range ? range.index : quill.getLength();
          quill.insertText(index, text, "user");
          quill.setSelection(index + text.length);
        }
      };
      onInsertContentReady(insertContent);
    }
  }, [onInsertContentReady]);

  // Quill modules configuration
  const modules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ["bold", "italic", "underline", "strike"],
      [{ list: "ordered" }, { list: "bullet" }],
      [{ indent: "-1" }, { indent: "+1" }],
      ["link", "image"],
      [{ color: [] }, { background: [] }],
      ["clean"],
    ],
  };

  const formats = [
    "header",
    "bold",
    "italic",
    "underline",
    "strike",
    "list",
    "bullet",
    "indent",
    "link",
    "image",
    "color",
    "background",
    "align",
    "size",
    "font",
  ];
  
  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7243/ingest/505803cc-574b-40ed-a9f8-e9c2e267e4a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Editor.tsx:186',message:'Formats configured',data:{formatsCount:formats.length,formats:formats.join(',')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
  }, []);
  // #endregion

  return (
    <ScrollArea className="flex-1 h-full">
      <div className="p-6 max-w-4xl mx-auto h-full">
        <style>{`
          .borderless-editor .ql-container {
            border: none !important;
            font-family: inherit;
            font-size: inherit;
          }
          .borderless-editor .ql-editor {
            border: none !important;
            padding: 0 !important;
            min-height: 500px;
            font-family: inherit;
            font-size: inherit;
            line-height: 1.6;
          }
          .borderless-editor .ql-editor.ql-blank::before {
            color: hsl(var(--muted-foreground));
            font-style: normal;
            font-family: inherit;
          }
          .borderless-editor .ql-toolbar {
            border: none !important;
            border-bottom: 1px solid hsl(var(--border)) !important;
            padding: 8px 0 !important;
            margin-bottom: 16px;
            background: transparent;
            font-family: inherit;
          }
          .borderless-editor .ql-toolbar button,
          .borderless-editor .ql-toolbar .ql-picker-label,
          .borderless-editor .ql-toolbar .ql-picker-options {
            font-family: inherit;
          }
          .borderless-editor .ql-toolbar .ql-stroke {
            stroke: hsl(var(--foreground));
          }
          .borderless-editor .ql-toolbar .ql-fill {
            fill: hsl(var(--foreground));
          }
          .borderless-editor .ql-toolbar button:hover,
          .borderless-editor .ql-toolbar button:focus,
          .borderless-editor .ql-toolbar button.ql-active {
            color: hsl(var(--primary));
          }
          .borderless-editor .ql-toolbar button:hover .ql-stroke,
          .borderless-editor .ql-toolbar button:focus .ql-stroke,
          .borderless-editor .ql-toolbar button.ql-active .ql-stroke {
            stroke: hsl(var(--primary));
          }
          .borderless-editor .ql-toolbar button:hover .ql-fill,
          .borderless-editor .ql-toolbar button:focus .ql-fill,
          .borderless-editor .ql-toolbar button.ql-active .ql-fill {
            fill: hsl(var(--primary));
          }
          .borderless-editor .ql-snow {
            border: none !important;
          }
          /* Tooltips for toolbar buttons */
          .borderless-editor .ql-toolbar button {
            position: relative;
          }
          .borderless-editor .ql-toolbar button[data-tooltip]:hover::before {
            content: attr(data-tooltip);
            position: absolute;
            bottom: calc(100% + 8px);
            left: 50%;
            transform: translateX(-50%);
            padding: 6px 10px;
            background: hsl(var(--popover));
            color: hsl(var(--popover-foreground));
            border: 1px solid hsl(var(--border));
            border-radius: 6px;
            font-size: 12px;
            font-family: inherit;
            white-space: nowrap;
            pointer-events: none;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            opacity: 0;
            animation: tooltipFadeIn 0.2s ease-out forwards;
          }
          .borderless-editor .ql-toolbar button[data-tooltip]:hover::after {
            content: '';
            position: absolute;
            bottom: calc(100% + 2px);
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-top: 6px solid hsl(var(--border));
            pointer-events: none;
            z-index: 1001;
            opacity: 0;
            animation: tooltipFadeIn 0.2s ease-out forwards;
          }
          .borderless-editor .ql-toolbar .ql-picker-label {
            position: relative;
          }
          .borderless-editor .ql-toolbar .ql-picker-label[data-tooltip]:hover::before {
            content: attr(data-tooltip);
            position: absolute;
            bottom: calc(100% + 8px);
            left: 50%;
            transform: translateX(-50%);
            padding: 6px 10px;
            background: hsl(var(--popover));
            color: hsl(var(--popover-foreground));
            border: 1px solid hsl(var(--border));
            border-radius: 6px;
            font-size: 12px;
            font-family: inherit;
            white-space: nowrap;
            pointer-events: none;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            opacity: 0;
            animation: tooltipFadeIn 0.2s ease-out forwards;
          }
          .borderless-editor .ql-toolbar .ql-picker-label[data-tooltip]:hover::after {
            content: '';
            position: absolute;
            bottom: calc(100% + 2px);
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-top: 6px solid hsl(var(--border));
            pointer-events: none;
            z-index: 1001;
            opacity: 0;
            animation: tooltipFadeIn 0.2s ease-out forwards;
          }
          @keyframes tooltipFadeIn {
            from {
              opacity: 0;
              transform: translateX(-50%) translateY(4px);
            }
            to {
              opacity: 1;
              transform: translateX(-50%) translateY(0);
            }
          }
        `}</style>
        <ReactQuill
          ref={quillRef}
          theme="snow"
          value={content}
          onChange={(value, delta, source, editor) => {
            // #region agent log
            const htmlValue = editor.getHTML();
            const textValue = editor.getText();
            const deltaValue = JSON.stringify(delta);
            fetch('http://127.0.0.1:7243/ingest/505803cc-574b-40ed-a9f8-e9c2e267e4a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Editor.tsx:244',message:'onChange triggered',data:{source,valueLength:value.length,htmlLength:htmlValue.length,textLength:textValue.length,htmlPreview:htmlValue.substring(0,200),textPreview:textValue.substring(0,200),hasBold:htmlValue.includes('<strong>')||htmlValue.includes('<b>'),hasItalic:htmlValue.includes('<em>')||htmlValue.includes('<i>'),hasUnderline:htmlValue.includes('<u>'),hasStrike:htmlValue.includes('<s>')||htmlValue.includes('<strike>'),hasMarkdownBold:textValue.includes('**')||htmlValue.includes('**'),deltaOps:delta?.ops?.length,deltaPreview:deltaValue.substring(0,300)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
            setContent(htmlValue);
          }}
          modules={modules}
          formats={formats}
          placeholder="Start writing your journal entry..."
          className="borderless-editor"
        />
      </div>
    </ScrollArea>
  );
};
