import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  files?: Array<{ name: string; content: string; type: string }>;
}

interface AIRequest {
  journalId: string;
  journalTitle?: string;
  messages: ChatMessage[];
  userMessage: string;
  files?: Array<{ name: string; content: string; type: string }>;
  isQuizRequest: boolean;
  isFlashcardsRequest: boolean;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Enable CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validate request method
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

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

    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse request body
    const body: AIRequest = await req.json()

    // Validate required fields
    if (!body.journalId || !body.userMessage || !Array.isArray(body.messages)) {
      return new Response(JSON.stringify({ error: 'Missing required fields: journalId, userMessage, messages' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validate that messages have proper structure
    const isValidMessages = body.messages.every(msg =>
      msg.role && typeof msg.content === 'string' && msg.id
    )

    if (!isValidMessages) {
      return new Response(JSON.stringify({ error: 'Invalid message context' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Processing AI chat request for user', user.id, 'journal:', body.journalId);

    // Build system prompt based on request type
    let systemPrompt: string
    const userText = body.userMessage

    if (body.isQuizRequest) {
      systemPrompt = `You are a quiz generator for a journal application. The user wants a quiz on: "${userText.replace(/quiz me on\s*/i, '').trim()}". Generate a quiz with exactly 5 multiple-choice questions. Each question must have exactly 4 options (A, B, C, D). Format your response as:

QUIZ_TITLE: [Brief title for the quiz]

QUESTION 1: [Question text]
A) [Option 1]
B) [Option 2]
C) [Option 3]
D) [Option 4]
CORRECT: [Letter of correct answer]

QUESTION 2: [etc.]

Use the provided files if any to make questions more relevant and accurate.`
    } else if (body.isFlashcardsRequest) {
      systemPrompt = `You are a flashcard generator for a journal application. The user wants flashcards on: "${userText.replace(/create flashcards on\s*/i, '').replace(/flashcards on\s*/i, '').trim()}". Generate exactly 8 flashcards that cover the key concepts. Format your response as:

FLASHCARDS_TITLE: [Brief title for the flashcards]

CARD 1:
FRONT: [Question or term]
BACK: [Answer or definition]

CARD 2:
FRONT: [Question or term]
BACK: [Answer or definition]

[etc. for 8 cards]

Use the provided files if any to make flashcards more relevant and accurate.`
    } else {
      systemPrompt = `You are a helpful AI assistant for a journal/note-taking application. The user is currently working on a journal titled "${body.journalTitle || 'Untitled'}". Provide helpful, relevant responses to their questions about journaling, writing, organization, or any other topics they bring up. When files are provided, analyze their contents and use that information to provide more relevant and informed responses. Be concise but informative.

IMPORTANT: This is an isolated conversation for journal ID: ${body.journalId}. Do not reference or recall information from any other journals or conversations. This conversation is completely separate and independent.`
    }

    // Build conversation history
    const conversationMessages = body.messages.map(m => {
      let content = m.content;
      if (m.files && m.files.length > 0) {
        content += '\n\n--- Attached Files ---\n';
        m.files.forEach(file => {
          content += `\n## File: ${file.name}\n\`\`\`\n${file.content}\n\`\`\`\n`;
        });
      }
      return { role: m.role, content };
    });

    // Build user message with files
    let userMessageContent = userText
    if (body.files && body.files.length > 0) {
      userMessageContent += '\n\n--- Attached Files ---\n' +
        body.files.map(file => `## File: ${file.name}\n\`\`\`\n${file.content}\n\`\`\``).join('\n')
    }

    // Prepare OpenAI request
    const openaiMessages = [
      { role: 'system', content: systemPrompt },
      ...conversationMessages,
      { role: 'user', content: userMessageContent }
    ]

    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: openaiMessages,
        max_tokens: 1500,
        temperature: 0.7,
      }),
    })

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text()
      console.error('OpenAI API error:', errorData)
      return new Response(JSON.stringify({ error: 'AI service temporarily unavailable' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const openaiData = await openaiResponse.json()
    const aiResponse = openaiData.choices[0]?.message?.content

    if (!aiResponse) {
      return new Response(JSON.stringify({ error: 'No response from AI service' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Return successful response
    return new Response(JSON.stringify({
      response: aiResponse,
      journalId: body.journalId
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('AI chat function error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})