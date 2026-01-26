import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('Authentication failed:', authError?.message || 'No user found');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', user.id);

    const requestBody = await req.json();
    const { messages, journalTitle, enableWebSearch = false, journalId, isCiteCommand = false, citeStyle = '', citeContent = '', isFactCheckCommand = false, researchEnabled = false } = requestBody;
    
    // #region agent log
    console.log('[DEBUG] Received request body:', JSON.stringify({ researchEnabled, isCiteCommand, citeStyle, citeContent, messagesCount: messages?.length || 0, hasMessages: !!messages }));
    // #endregion
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openAIApiKey) {
      console.error('OPENAI_API_KEY is not configured');
      throw new Error('OpenAI API key is not configured');
    }

    console.log('Processing chat request for user', user.id, 'with', messages.length, 'messages');

    // Define OpenAI function schemas for agentic workflow
    // Only include search_web tool when research is enabled
    const tools: any[] = [
      {
        type: "function",
        function: {
          name: "read_journal_content",
          description: "Read the content of the current journal. Use this to understand what the user has already written in their journal.",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "analyze_file",
          description: "Analyze the content of an uploaded file. Use this when the user has uploaded files and you need to extract or understand their content.",
          parameters: {
            type: "object",
            properties: {
              file_name: {
                type: "string",
                description: "The name of the file to analyze"
              }
            },
            required: ["file_name"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "insert_into_journal",
          description: "Insert content into the current journal. Use this when the user asks you to add, write, or insert content into their journal.",
          parameters: {
            type: "object",
            properties: {
              content: {
                type: "string",
                description: "The content to insert into the journal. Use proper markdown formatting with headings, lists, and paragraphs."
              }
            },
            required: ["content"]
          }
        }
      }
    ];

    // Only add search_web tool when research is enabled
    if (researchEnabled) {
      tools.unshift({
        type: "function",
        function: {
          name: "search_web",
          description: "Search the web for information using Tavily search. Use this when you need current information, facts, or data that isn't in the provided context.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "The search query to find information on the web"
              }
            },
            required: ["query"]
          }
        }
      });
    }

    // Web search function using Tavily MCP endpoint
    async function searchWeb(query: string, controller?: ReadableStreamDefaultController, isCiteCmd?: boolean, isFactCheckCmd?: boolean): Promise<{ context: string; sources: Array<{ title: string; url: string }> }> {
      // Send status update for web search
      if (controller && (isCiteCmd || isFactCheckCmd)) {
        // Check if query mentions specific sources
        const politicoMatch = query.match(/politico/i);
        if (politicoMatch) {
          sendStatusUpdate("Searching for Politico links", controller);
        } else {
          sendStatusUpdate("Searched the web", controller);
        }
      }
      // Get Tavily API key from environment variables only - no hardcoded fallback
      const tavilyApiKey = Deno.env.get('TAVILY_API_KEY');
      if (!tavilyApiKey) {
        console.warn('TAVILY_API_KEY not found, web search disabled');
        return { context: '', sources: [] };
      }
      
      try {
        // Use Tavily MCP endpoint - try MCP protocol first, fallback to direct API
        const mcpUrl = `https://mcp.tavily.com/mcp/?tavilyApiKey=${tavilyApiKey}`;
        let data: any;
        
        try {
          // Try MCP endpoint with JSON-RPC 2.0 format
          const mcpRpcResponse = await fetch(mcpUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'tools/call',
              params: {
                name: 'tavily_search_results_json',
                arguments: {
                  query: query,
                  search_depth: 'basic',
                  include_answer: true,
                  include_raw_content: false,
                  max_results: 10,
                  include_domains: [],
                  exclude_domains: [],
                }
              }
            }),
          });
          
          if (mcpRpcResponse.ok) {
            const rpcData = await mcpRpcResponse.json();
            if (rpcData.result) {
              // Handle MCP JSON-RPC response format
              if (rpcData.result.content && Array.isArray(rpcData.result.content) && rpcData.result.content.length > 0) {
                const content = rpcData.result.content[0];
                if (content.text) {
                  try {
                    data = typeof content.text === 'string' ? JSON.parse(content.text) : content.text;
                  } catch {
                    data = rpcData.result;
                  }
                } else {
                  data = rpcData.result;
                }
              } else {
                data = rpcData.result;
              }
              console.log('Successfully used MCP endpoint');
            } else {
              throw new Error('MCP RPC format not supported - no result field');
            }
          } else {
            const errorText = await mcpRpcResponse.text();
            throw new Error(`MCP endpoint returned ${mcpRpcResponse.status}: ${errorText}`);
          }
        } catch (mcpError) {
          console.warn('MCP endpoint attempt failed, using direct Tavily API:', mcpError);
          
          // Fallback to direct Tavily API - more reliable for production
          const apiResponse = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              api_key: tavilyApiKey,
              query: query,
              search_depth: 'basic',
              include_answer: true,
              include_raw_content: false,
              max_results: 10,
            }),
          });
          
          if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error('Tavily API error:', apiResponse.status, errorText);
            return { context: '', sources: [] };
          }
          
          data = await apiResponse.json();
          console.log('Successfully used direct Tavily API');
        }
        
        if (!data) {
          console.error('No data received from Tavily search');
          return { context: '', sources: [] };
        }
        
        let searchContext = '';
        const sources: Array<{ title: string; url: string }> = [];
        
        // Extract answer if available
        if (data.answer) {
          searchContext += `\n\n📚 Web Search Answer:\n${data.answer}\n`;
        }
        
        // Extract and format results with links
        if (data.results && Array.isArray(data.results) && data.results.length > 0) {
          searchContext += '\n\n🔍 Web Search Results (include these links when citing sources):\n\n';
          
          data.results.forEach((result: any, index: number) => {
            const title = result.title || 'Untitled';
            const url = result.url || '';
            const content = result.content || '';
            
            if (url) {
              // Format with clickable markdown link
              searchContext += `${index + 1}. **[${title}](${url})**\n`;
              searchContext += `   ${content}\n\n`;
              
              // Add to sources array
              if (!sources.find(s => s.url === url)) {
                sources.push({ title, url });
              }
            } else {
              searchContext += `${index + 1}. ${title}\n   ${content}\n\n`;
            }
          });
          
          // Add summary of all source links at the end
          if (sources.length > 0) {
            searchContext += '\n📎 Source Links:\n';
            sources.forEach((source, index) => {
              searchContext += `${index + 1}. [${source.title}](${source.url})\n`;
            });
          }
        }
        
        // If no results but we have an answer, that's still useful
        if (!data.results && data.answer) {
          searchContext += '\n\nNote: Web search found information but no specific source links were returned.';
        }
        
        return { context: searchContext, sources };
      } catch (error) {
        console.error('Web search error:', error);
        return { context: '', sources: [] };
      }
    }

    // Tool execution handlers
    async function executeTool(toolCall: any, uploadedFiles: Array<{ name: string; content: string; type: string }>, controller?: ReadableStreamDefaultController, isCiteCmd?: boolean, isFactCheckCmd?: boolean): Promise<{ result: string; sources?: Array<{ title: string; url: string }> }> {
      const functionName = toolCall.function?.name;
      const args = JSON.parse(toolCall.function?.arguments || '{}');

      console.log('Executing tool:', functionName, 'with args:', args);

      try {
        switch (functionName) {
          case 'search_web':
            const searchResult = await searchWeb(args.query, controller, isCiteCmd, isFactCheckCmd);
            return {
              result: searchResult.context || 'No results found.',
              sources: searchResult.sources
            };

          case 'read_journal_content':
            if (!journalId) {
              return { result: 'Error: No journal ID provided. Cannot read journal content.' };
            }
            const { data: journalData, error: journalError } = await supabase
              .from('journals')
              .select('content, title')
              .eq('id', journalId)
              .eq('user_id', user!.id)
              .single();

            if (journalError || !journalData) {
              return { result: 'Error: Could not read journal content. Journal not found or access denied.' };
            }

            let journalContent = '';
            if (journalData.content) {
              try {
                // Try to parse as JSON (block-based content)
                const parsed = JSON.parse(journalData.content);
                if (Array.isArray(parsed)) {
                  // Extract text from blocks
                  for (const block of parsed) {
                    if (block.type === 'paragraph' || block.type === 'text') {
                      const content = block.content || '';
                      const plainText = content.replace(/<[^>]*>/g, '').trim();
                      if (plainText) {
                        journalContent += plainText + '\n\n';
                      }
                    } else if (block.type === 'heading1' || block.type === 'heading2' || block.type === 'heading3') {
                      const content = block.content || '';
                      const plainText = content.replace(/<[^>]*>/g, '').trim();
                      if (plainText) {
                        journalContent += `# ${plainText}\n\n`;
                      }
                    }
                  }
                } else {
                  journalContent = journalData.content;
                }
              } catch {
                // Not JSON, treat as plain text
                journalContent = journalData.content;
              }
            }

            if (!journalContent.trim()) {
              return { result: `Journal "${journalData.title || 'Untitled'}" is currently empty.` };
            }

            return {
              result: `Journal: "${journalData.title || 'Untitled'}"\n\nContent:\n${journalContent}`
            };

          case 'analyze_file':
            const fileName = args.file_name;
            const file = uploadedFiles.find(f => f.name === fileName);
            if (!file) {
              return { result: `Error: File "${fileName}" not found in uploaded files.` };
            }
            return {
              result: `File: ${file.name}\nType: ${file.type}\n\nContent:\n${file.content}`
            };

          case 'insert_into_journal':
            if (!journalId) {
              return { result: 'Error: No journal ID provided. Cannot insert content.' };
            }
            // Get current journal content
            const { data: currentJournal, error: currentError } = await supabase
              .from('journals')
              .select('content')
              .eq('id', journalId)
              .eq('user_id', user!.id)
              .single();

            if (currentError || !currentJournal) {
              return { result: 'Error: Could not access journal. Journal not found or access denied.' };
            }

            // Parse existing content
            let existingBlocks: any[] = [];
            try {
              const parsed = JSON.parse(currentJournal.content || '[]');
              if (Array.isArray(parsed)) {
                existingBlocks = parsed;
              }
            } catch {
              // If not JSON, create a paragraph block from existing content
              if (currentJournal.content) {
                existingBlocks = [{
                  type: 'paragraph',
                  content: currentJournal.content.replace(/<[^>]*>/g, '')
                }];
              }
            }

            // Convert markdown content to blocks (simple conversion)
            const lines = args.content.split('\n');
            const newBlocks: any[] = [];
            for (const line of lines) {
              if (line.trim().startsWith('## ')) {
                newBlocks.push({
                  type: 'heading2',
                  content: line.replace(/^##\s+/, '')
                });
              } else if (line.trim().startsWith('### ')) {
                newBlocks.push({
                  type: 'heading3',
                  content: line.replace(/^###\s+/, '')
                });
              } else if (line.trim().startsWith('# ')) {
                newBlocks.push({
                  type: 'heading1',
                  content: line.replace(/^#\s+/, '')
                });
              } else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
                newBlocks.push({
                  type: 'paragraph',
                  content: line.replace(/^[-*]\s+/, '')
                });
              } else if (line.trim()) {
                newBlocks.push({
                  type: 'paragraph',
                  content: line.trim()
                });
              } else {
                // Empty line - add spacing
                newBlocks.push({
                  type: 'paragraph',
                  content: ''
                });
              }
            }

            // Append new blocks to existing content
            const updatedBlocks = [...existingBlocks, ...newBlocks];
            const updatedContent = JSON.stringify(updatedBlocks);

            // Update journal
            const { error: updateError } = await supabase
              .from('journals')
              .update({ content: updatedContent })
              .eq('id', journalId)
              .eq('user_id', user!.id);

            if (updateError) {
              return { result: `Error: Failed to insert content into journal: ${updateError.message}` };
            }

            return { result: `Successfully inserted content into journal.` };

          default:
            return { result: `Error: Unknown tool "${functionName}"` };
        }
      } catch (error) {
        console.error('Tool execution error:', error);
        return { result: `Error executing tool "${functionName}": ${error instanceof Error ? error.message : 'Unknown error'}` };
      }
    }

    // Extract uploaded files from messages
    const uploadedFiles: Array<{ name: string; content: string; type: string }> = [];
    for (const msg of messages) {
      if (msg.files && Array.isArray(msg.files)) {
        uploadedFiles.push(...msg.files);
      }
    }

    // Helper function to send status update via SSE
    const sendStatusUpdate = (status: string, controller?: ReadableStreamDefaultController) => {
      if (controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(`event: status\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status })}\n\n`));
      }
    };

    // Tavily Research API functions
    // Get Tavily API key from environment variables only - no hardcoded fallback
    const tavilyApiKey = Deno.env.get('TAVILY_API_KEY');

    async function startTavilyResearch(query: string): Promise<string> {
      // #region agent log
      console.log('[DEBUG] Starting Tavily research with query:', query);
      // #endregion
      const response = await fetch('https://api.tavily.com/research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tavilyApiKey}`,
        },
        body: JSON.stringify({
          input: query,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        // #region agent log
        console.log('[DEBUG] Tavily research start failed:', response.status, errorText);
        // #endregion
        throw new Error(`Tavily Research API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      // #region agent log
      console.log('[DEBUG] Tavily research started, request_id:', data.request_id);
      // #endregion
      return data.request_id;
    }

    async function pollTavilyResearch(requestId: string, controller: ReadableStreamDefaultController, startTime?: number): Promise<{ content: string; sources: Array<{ title: string; url: string; icon?: string; logo?: string; favicon?: string }>; reasoningTrace?: any; answer?: string; rawResponse?: any }> {
      const maxAttempts = 30; // 30 attempts * 2 seconds = 60 seconds max
      let attempts = 0;
      const encoder = new TextEncoder();
      const researchStartTime = startTime || Date.now();

      // Helper to format elapsed time
      const formatElapsedTime = (elapsedMs: number): string => {
        const seconds = Math.floor(elapsedMs / 1000);
        if (seconds < 60) {
          return `${seconds}s`;
        }
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
      };

      while (attempts < maxAttempts) {
        // #region agent log
        console.log('[DEBUG] Polling Tavily research, attempt:', attempts + 1, 'requestId:', requestId);
        // #endregion
        const response = await fetch(`https://api.tavily.com/research/${requestId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tavilyApiKey}`,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          // #region agent log
          console.error('[DEBUG] Tavily polling failed:', response.status, errorText);
          // #endregion
          throw new Error(`Tavily Research polling error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        // #region agent log
        console.log('[DEBUG] Tavily polling response keys:', Object.keys(data));
        console.log('[DEBUG] Tavily status:', data.status, 'attempt:', attempts + 1, '/', maxAttempts);
        console.log('[DEBUG] Full Tavily response:', JSON.stringify(data, null, 2).substring(0, 1000));
        // #endregion
        const status = data.status;

        if (status === 'completed') {
          // Format sources with all metadata (icons, logos, etc.)
          const sources: Array<{ title: string; url: string; icon?: string; logo?: string; favicon?: string }> = [];
          if (data.sources && Array.isArray(data.sources)) {
            for (const source of data.sources) {
              if (source.url) {
                sources.push({
                  title: source.title || source.url,
                  url: source.url,
                  icon: source.icon,
                  logo: source.logo,
                  favicon: source.favicon,
                });
              }
            }
          }

          return {
            content: data.content || '',
            sources: sources,
            reasoningTrace: data.reasoning_trace || data.reasoningTrace || null,
            answer: data.answer || null,
            rawResponse: data, // Include full response for inspection
          };
        } else if (status === 'failed') {
          throw new Error('Tavily research task failed');
        } else if (status === 'pending' || status === 'in_progress') {
          // Calculate elapsed time
          const elapsed = Date.now() - researchStartTime;
          const elapsedStr = formatElapsedTime(elapsed);
          
          // Update status
          if (attempts === 0) {
            sendStatusUpdate(`Starting research... (${elapsedStr})`, controller);
          } else {
            sendStatusUpdate(`Research in progress... (${elapsedStr})`, controller);
          }
          
          // Wait 2 seconds before next poll
          await new Promise(resolve => setTimeout(resolve, 2000));
          attempts++;
        } else {
          throw new Error(`Unknown research status: ${status}`);
        }
      }

      throw new Error('Tavily research polling timeout after 60 seconds');
    }

    async function handleResearchMode(query: string, controller: ReadableStreamDefaultController) {
      const encoder = new TextEncoder();
      const startTime = Date.now();
      // #region agent log
      console.log('[DEBUG] handleResearchMode called with query:', query);
      // #endregion
      try {
        sendStatusUpdate('Starting research...', controller);

        // Start research task
        const requestId = await startTavilyResearch(query);
        // #region agent log
        console.log('[DEBUG] Research task started, requestId:', requestId);
        // #endregion

        // Poll for results (pass startTime to track elapsed time)
        const result = await pollTavilyResearch(requestId, controller, startTime);

        // Calculate total elapsed time
        const totalElapsed = Date.now() - startTime;
        const formatElapsedTime = (elapsedMs: number): string => {
          const seconds = Math.floor(elapsedMs / 1000);
          if (seconds < 60) {
            return `${seconds}s`;
          }
          const minutes = Math.floor(seconds / 60);
          const remainingSeconds = seconds % 60;
          return `${minutes}m ${remainingSeconds}s`;
        };
        const elapsedStr = formatElapsedTime(totalElapsed);
        sendStatusUpdate(`Research completed (${elapsedStr})`, controller);

        // #region agent log
        console.log('[DEBUG] Research result structure:', { 
          hasContent: !!result.content, 
          contentLength: result.content?.length,
          sourcesCount: result.sources?.length,
          hasReasoningTrace: !!result.reasoningTrace,
          reasoningTraceKeys: result.reasoningTrace ? Object.keys(result.reasoningTrace) : null
        });
        // #endregion

        // Format research report - use answer if available, otherwise content
        let report = '# Research Report\n\n';
        const reportContent = result.answer || result.content || 'No content available.';
        report += reportContent;

        // Add reasoning trace if available (shows research steps)
        if (result.reasoningTrace) {
          report += '\n\n## Research Process\n\n';
          if (result.reasoningTrace.steps && Array.isArray(result.reasoningTrace.steps)) {
            result.reasoningTrace.steps.forEach((step: any, index: number) => {
              report += `### Step ${index + 1}: ${step.name || 'Research Step'}\n\n`;
              if (step.description) report += `${step.description}\n\n`;
              if (step.duration) report += `*Duration: ${step.duration}*\n\n`;
            });
          }
        }

        // Add sources section with icons/logos if available
        if (result.sources && result.sources.length > 0) {
          report += '\n\n## Sources\n\n';
          result.sources.forEach((source, index) => {
            const iconMarkdown = source.icon || source.logo || source.favicon ? ` ![${source.title}](${source.icon || source.logo || source.favicon})` : '';
            report += `${index + 1}.${iconMarkdown} [${source.title}](${source.url})\n`;
          });
        }

        // Stream the report content in chunks
        const chunkSize = 50;
        let index = 0;
        
        while (index < report.length) {
          const chunk = report.slice(index, index + chunkSize);
          const data = JSON.stringify({
            choices: [{
              delta: { content: chunk },
              finish_reason: index + chunkSize >= report.length ? 'stop' : null
            }]
          });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          index += chunkSize;
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        // #region agent log
        console.error('[DEBUG] Research mode error:', error);
        console.error('[DEBUG] Error details:', error instanceof Error ? { message: error.message, stack: error.stack } : error);
        // #endregion
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        const errorData = JSON.stringify({
          error: `Research failed: ${errorMessage}`
        });
        controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    }

    // Update system prompt for agentic workflow
    let systemPrompt = `You are a helpful AI assistant for a journal/note-taking application. The user is currently working on a journal titled "${journalTitle || 'Untitled'}". 

You have access to tools that allow you to:
- Search the web for current information
- Read the current journal's content
- Analyze uploaded files
- Insert content into the journal

Use these tools autonomously when needed to provide the best assistance. Plan your approach and execute tools as necessary to answer the user's questions or complete their requests.

When using tools:
- Use search_web when you need current information, facts, or data not in the provided context
- Use read_journal_content to understand what the user has already written
- Use analyze_file to examine uploaded file contents
- Use insert_into_journal when the user asks you to add or write content

After using tools, synthesize the information and provide a clear, helpful response to the user.

When citing web search results, always include clickable markdown links: [Source Name](URL)
Format links naturally in your response, not just at the end.

When generating content for journal insertion, use proper markdown formatting with headings (## for main sections, ### for subsections), bullet points, numbered lists, and paragraphs.`;

    // Modify system prompt for cite command
    if (isCiteCommand) {
      const citationStyleName = citeStyle || 'APA';
      const citationContent = citeContent || '';
      
      systemPrompt = `You are a helpful AI assistant specialized in academic citations. The user wants to cite: ${citationContent}

Citation Style: ${citationStyleName}

Your task is to:
1. Search the web for information about this source (link, book, article, etc.) to get accurate metadata (title, author, publication date, publisher, URL, etc.)
2. Generate citations in ${citationStyleName} format
3. Provide BOTH:
   - Reference list entry (full citation for bibliography/reference list)
   - In-text citation (for use within the body of the text)

Format your response as:
## ${citationStyleName} Citation

### Reference List Entry
[Full citation formatted according to ${citationStyleName} style for the reference list/bibliography]

### In-Text Citation
[In-text citation formatted according to ${citationStyleName} style for use within paragraphs]

### Notes
- If this is a website, include the URL and access date
- If this is a book, include publisher and place of publication
- If this is a journal article, include volume, issue, and page numbers
- Follow ${citationStyleName} style guidelines precisely

Use the search_web tool to find accurate metadata about the source.`;
    }

    // Modify system prompt for fact-check command
    if (isFactCheckCommand) {
      systemPrompt = `You are a helpful AI assistant specialized in fact-checking. The user wants you to verify the accuracy of information.

Your task is to:
1. Analyze any uploaded files or provided links to extract key claims and facts
2. Search the web using multiple queries to verify each claim
3. Compare the claims with authoritative sources
4. Provide a comprehensive fact-check report

Format your response as:
## Fact-Check Report

### Claims Analyzed
[List the key claims you found]

### Verification Results
[For each claim, indicate if it's Verified, Partially Verified, or Unverified, with sources]

### Sources
[List all sources used for verification with links]

Use the analyze_file tool if files are uploaded, and use search_web extensively to verify claims.`;
    }

    // Agentic workflow: Tool execution loop
    const conversationMessages = [
      {
        role: 'system',
        content: systemPrompt
      },
      ...messages
    ];

    let allSources: Array<{ title: string; url: string }> = [];
    const maxToolRounds = 5; // Prevent infinite loops
    let toolRound = 0;

    // Create streaming response early to send status updates
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // #region agent log
          console.log('[DEBUG] Stream start - researchEnabled:', researchEnabled);
          // #endregion
          // Handle research mode - if enabled, skip regular chat flow
          if (researchEnabled) {
            // #region agent log
            console.log('[DEBUG] Research mode enabled - entering research handler');
            // #endregion
            const lastMessage = messages[messages.length - 1];
            const query = lastMessage?.content || '';
            // #region agent log
            console.log('[DEBUG] Research query:', query);
            // #endregion
            if (query.trim()) {
              await handleResearchMode(query, controller);
              return;
            } else {
              // #region agent log
              console.log('[DEBUG] Research mode but no query provided');
              // #endregion
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'No query provided for research' })}\n\n`));
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
              return;
            }
          }

          // Send initial "Thinking..." status
          if (isCiteCommand || isFactCheckCommand) {
            sendStatusUpdate("Thinking...", controller);
          }

          // Check for uploaded files and send status
          if (uploadedFiles.length > 0 && (isCiteCommand || isFactCheckCommand)) {
            sendStatusUpdate(`Read ${uploadedFiles.length} attachment${uploadedFiles.length > 1 ? 's' : ''}`, controller);
          }

          // Tool execution loop
          while (toolRound < maxToolRounds) {
          toolRound++;
          console.log(`Tool execution round ${toolRound}`);

          // Call OpenAI with tools (only if researchEnabled or tools available)
          const requestBody: any = {
            model: 'gpt-4o',
            messages: conversationMessages,
            max_tokens: 1500,
            temperature: 0.7,
          };
          
          // Only include tools if research is enabled (tools array will include search_web)
          if (researchEnabled && tools.length > 0) {
            requestBody.tools = tools;
            requestBody.tool_choice = 'auto'; // Let AI decide when to use tools
          }
          
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      
      if (response.status === 429) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' })}\n\n`));
              controller.close();
              return;
            }
            
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: `OpenAI API error: ${response.status}` })}\n\n`));
            controller.close();
            return;
          }

          const data = await response.json();
          const choice = data.choices?.[0];
          const message = choice?.message;

          if (!message) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'No message in OpenAI response' })}\n\n`));
            controller.close();
            return;
          }

          // Add assistant message to conversation
          conversationMessages.push({
            role: 'assistant',
            content: message.content || null,
            tool_calls: message.tool_calls || undefined
          });

          // Check if AI wants to use tools
          if (message.tool_calls && message.tool_calls.length > 0) {
            console.log(`AI requested ${message.tool_calls.length} tool call(s)`);

            // Send status updates for tool execution
            for (const toolCall of message.tool_calls) {
              const functionName = toolCall.function?.name;
              if (functionName === 'search_web') {
                sendStatusUpdate("Searched the web", controller);
              } else if (functionName === 'analyze_file') {
                sendStatusUpdate("Read 1 attachment", controller);
              }
            }

            // Execute all tool calls in parallel
            const toolResults = await Promise.all(
              message.tool_calls.map(async (toolCall: any) => {
                const result = await executeTool(toolCall, uploadedFiles, controller, isCiteCommand, isFactCheckCommand);
                
                // Collect sources from web search
                if (result.sources) {
                  allSources.push(...result.sources);
                }

                return {
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  name: toolCall.function.name,
                  content: result.result
                };
              })
            );

            // Add tool results to conversation
            conversationMessages.push(...toolResults);
            
            // Continue loop to let AI process tool results
            continue;
          } else {
            // No more tool calls, AI has final response
            console.log('AI provided final response, starting stream');
            
            // If we already have content from the assistant message, stream it
            if (message.content && toolRound === 1) {
              // Stream the content in chunks for better UX
              const content = message.content;
              const chunkSize = 10;
              let index = 0;
              
              while (index < content.length) {
                const chunk = content.slice(index, index + chunkSize);
                const data = JSON.stringify({
                  choices: [{
                    delta: { content: chunk },
                    finish_reason: index + chunkSize >= content.length ? 'stop' : null
                  }]
                });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                index += chunkSize;
              }
              
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
              return;
            } else {
              // Make a streaming call to get the final response
              const streamResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${openAIApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'gpt-4o',
                  messages: conversationMessages,
                  max_tokens: 1500,
                  temperature: 0.7,
                  stream: true,
                }),
              });

              if (!streamResponse.ok) {
                const errorText = await streamResponse.text();
                console.error('OpenAI streaming error:', streamResponse.status, errorText);
                
                if (streamResponse.status === 429) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' })}\n\n`));
                  controller.close();
                  return;
                }
                
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: `OpenAI streaming error: ${streamResponse.status}` })}\n\n`));
                controller.close();
                return;
              }

              // Pipe the streaming response to our controller
              const reader = streamResponse.body?.getReader();
              const decoder = new TextDecoder();
              
              if (reader) {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  controller.enqueue(value);
                }
              }
              
              controller.close();
              return;
            }
          }
        }

          // If we've exhausted tool rounds, return the last message
          console.warn('Reached max tool rounds, returning last response');
          const lastMessage = conversationMessages[conversationMessages.length - 1];
          const finalContent = lastMessage.content || 'I apologize, but I encountered an issue processing your request.';

          // Send the final content
          const data = JSON.stringify({
            choices: [{
              delta: { content: finalContent },
              finish_reason: 'stop'
            }]
          });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Stream execution error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          const errorData = JSON.stringify({
            error: errorMessage
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      }
    });

    // Return the streaming response
    return new Response(stream, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Chat function error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
