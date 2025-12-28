/**
 * AI Context Isolation Test Suite
 *
 * This test verifies that AI chat contexts are properly isolated between journals
 * and that no memory, conversation history, or state leaks across different journals.
 *
 * Run this in browser console: copy and paste the entire file content
 */

// Mock localStorage for testing
const mockLocalStorage = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value; },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

let testResults = [];

// Test utilities
function assert(condition, message) {
  if (!condition) {
    throw new Error(`❌ ASSERTION FAILED: ${message}`);
  }
  console.log(`✅ ${message}`);
}

function test(name, fn) {
  console.log(`\n🧪 Running test: ${name}`);
  try {
    fn();
    testResults.push({ name, status: 'PASSED' });
    console.log(`✅ Test PASSED: ${name}`);
  } catch (error) {
    testResults.push({ name, status: 'FAILED', error: error.message });
    console.error(`❌ Test FAILED: ${name}`);
    console.error(`   Error: ${error.message}`);
  }
}

// Mock ChatbotSidebar component logic for testing
function createMockChatbotSidebar() {
  let currentJournalId = null;
  let currentJournalTitle = null;
  let messages = [];
  let draft = '';
  let uploadedFiles = [];

  const id = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  function initializeForJournal(journalId, journalTitle) {
    console.log(`Initializing chatbot for journal: ${journalId}`);

    // Clear all state
    messages = [];
    draft = '';
    uploadedFiles = [];

    // Update context
    currentJournalId = journalId;
    currentJournalTitle = journalTitle;

    // Load journal-specific messages
    const storageKey = `chatbot-messages-${journalId}`;
    const stored = mockLocalStorage.getItem(storageKey);

    if (stored) {
      try {
        const parsedMessages = JSON.parse(stored);
        if (Array.isArray(parsedMessages) && parsedMessages.length > 0) {
          // Validate message context
          const isValid = parsedMessages.every(msg =>
            msg.role && typeof msg.content === 'string' && msg.id
          );
          if (isValid) {
            messages = parsedMessages;
            return;
          }
        }
      } catch (error) {
        console.warn(`Corrupted data for journal ${journalId}, clearing`);
        mockLocalStorage.removeItem(storageKey);
      }
    }

    // Initialize fresh context
    messages = [{
      id: id(),
      role: "assistant",
      content: `Hi! I'm your AI assistant for this journal${journalTitle ? ` "${journalTitle}"` : ''}. Ask me anything about your writing, get help organizing your thoughts, or request summaries and insights. I'm powered by GPT-4o and ready to help!`,
    }];
  }

  function saveMessages() {
    if (currentJournalId && messages.length > 0) {
      const isValid = messages.every(msg =>
        msg.role && typeof msg.content === 'string' && msg.id
      );
      if (isValid) {
        mockLocalStorage.setItem(`chatbot-messages-${currentJournalId}`, JSON.stringify(messages));
      }
    }
  }

  function addUserMessage(content) {
    messages.push({
      id: id(),
      role: "user",
      content: content
    });
    saveMessages();
  }

  function addAssistantMessage(content) {
    messages.push({
      id: id(),
      role: "assistant",
      content: content
    });
    saveMessages();
  }

  function getMessages() {
    return [...messages];
  }

  function clearChatHistory() {
    if (currentJournalId) {
      mockLocalStorage.removeItem(`chatbot-messages-${currentJournalId}`);
      initializeForJournal(currentJournalId, currentJournalTitle);
    }
  }

  return {
    initializeForJournal,
    addUserMessage,
    addAssistantMessage,
    getMessages,
    clearChatHistory,
    getCurrentJournalId: () => currentJournalId,
    getCurrentJournalTitle: () => currentJournalTitle
  };
}

// Test scenarios
function runIsolationTests() {
  console.log('🚀 Starting AI Context Isolation Tests');

  // Test 1: Basic journal switching
  test('Journal Switching - No Context Leak', () => {
    const chatbot = createMockChatbotSidebar();

    // Initialize first journal
    chatbot.initializeForJournal('journal-1', 'My First Journal');
    chatbot.addUserMessage('Hello from journal 1');
    chatbot.addAssistantMessage('Hello back from journal 1');

    const journal1Messages = chatbot.getMessages();
    assert(journal1Messages.length === 2, 'Journal 1 should have 2 conversation messages (no welcome)');
    assert(journal1Messages[0].content === 'Hello from journal 1', 'Journal 1 first message should be user message');
    assert(journal1Messages[1].content === 'Hello back from journal 1', 'Journal 1 second message should be assistant message');

    // Switch to second journal
    chatbot.initializeForJournal('journal-2', 'My Second Journal');
    const journal2Messages = chatbot.getMessages();
    assert(journal2Messages.length === 0, 'Journal 2 should start completely empty');

    // Switch back to first journal
    chatbot.initializeForJournal('journal-1', 'My First Journal');
    const journal1MessagesAgain = chatbot.getMessages();
    assert(journal1MessagesAgain.length === 2, 'Journal 1 messages should be restored');
    assert(journal1MessagesAgain[0].content === 'Hello from journal 1', 'Journal 1 context should be preserved');
  });

  // Test 2: localStorage isolation
  test('localStorage Isolation', () => {
    const chatbot = createMockChatbotSidebar();

    // Journal 1 conversation
    chatbot.initializeForJournal('journal-a', 'Journal A');
    chatbot.addUserMessage('Secret info for journal A');
    chatbot.addAssistantMessage('Response A');

    // Journal 2 conversation
    chatbot.initializeForJournal('journal-b', 'Journal B');
    chatbot.addUserMessage('Secret info for journal B');
    chatbot.addAssistantMessage('Response B');

    // Verify localStorage isolation
    const journalAData = mockLocalStorage.getItem('chatbot-messages-journal-a');
    const journalBData = mockLocalStorage.getItem('chatbot-messages-journal-b');

    assert(journalAData !== null, 'Journal A data should exist in localStorage');
    assert(journalBData !== null, 'Journal B data should exist in localStorage');

    const journalAStored = JSON.parse(journalAData);
    const journalBStored = JSON.parse(journalBData);

    assert(journalAStored[1].content === 'Secret info for journal A', 'Journal A data should be isolated');
    assert(journalBStored[1].content === 'Secret info for journal B', 'Journal B data should be isolated');
    assert(journalAStored[1].content !== journalBStored[1].content, 'Journal data should not cross-contaminate');
  });

  // Test 3: Clear history isolation
  test('Clear History Isolation', () => {
    const chatbot = createMockChatbotSidebar();

    // Journal X conversation
    chatbot.initializeForJournal('journal-x', 'Journal X');
    chatbot.addUserMessage('Message for X');
    chatbot.addAssistantMessage('Response for X');

    // Journal Y conversation
    chatbot.initializeForJournal('journal-y', 'Journal Y');
    chatbot.addUserMessage('Message for Y');
    chatbot.addAssistantMessage('Response for Y');

    // Clear Journal X history
    chatbot.initializeForJournal('journal-x', 'Journal X');
    chatbot.clearChatHistory();

    // Check Journal Y is unaffected
    chatbot.initializeForJournal('journal-y', 'Journal Y');
    const journalYMessages = chatbot.getMessages();
    assert(journalYMessages.length === 3, 'Journal Y should retain its conversation after clearing Journal X');
    assert(journalYMessages[1].content === 'Message for Y', 'Journal Y context should be preserved');

    // Check Journal X is cleared
    chatbot.initializeForJournal('journal-x', 'Journal X');
    const journalXMessages = chatbot.getMessages();
    assert(journalXMessages.length === 0, 'Journal X should be completely empty after clearing');
  });

  // Test 4: Context validation
  test('Message Context Validation', () => {
    const chatbot = createMockChatbotSidebar();

    // Add valid messages
    chatbot.initializeForJournal('journal-valid', 'Valid Journal');
    chatbot.addUserMessage('Valid message');

    // Simulate corrupted localStorage data
    mockLocalStorage.setItem('chatbot-messages-journal-corrupt', JSON.stringify([
      { id: '1', role: 'invalid', content: 'corrupt' }, // Invalid role
      { id: '2', content: 'missing role' }, // Missing role
      { id: '3', role: 'user' }, // Missing content
    ]));

    // Should detect corruption and reset
    chatbot.initializeForJournal('journal-corrupt', 'Corrupt Journal');
    const messages = chatbot.getMessages();
    assert(messages.length === 0, 'Corrupted journal should reset to empty');
  });

  // Test 5: Concurrent journal operations
  test('Concurrent Journal Operations', () => {
    const chatbot1 = createMockChatbotSidebar();
    const chatbot2 = createMockChatbotSidebar();

    // Simulate two different journal sessions
    chatbot1.initializeForJournal('shared-journal', 'Shared Journal');
    chatbot1.addUserMessage('Message from session 1');

    chatbot2.initializeForJournal('shared-journal', 'Shared Journal');
    chatbot2.addUserMessage('Message from session 2');

    // Both should see the same conversation (simulating shared localStorage)
    const messages1 = chatbot1.getMessages();
    const messages2 = chatbot2.getMessages();

    assert(messages1.length === messages2.length, 'Both sessions should see same conversation length');
    assert(messages1[1].content === messages2[1].content, 'Both sessions should see same first user message');
  });

  // Test 6: Journal ID validation
  test('Journal ID Validation', () => {
    const chatbot = createMockChatbotSidebar();

    // Test with valid journal ID
    chatbot.initializeForJournal('valid-id-123', 'Valid Journal');
    assert(chatbot.getCurrentJournalId() === 'valid-id-123', 'Should accept valid journal ID');

    // Test with null/undefined journal ID
    chatbot.initializeForJournal(null, null);
    const messages = chatbot.getMessages();
    assert(messages.length === 1, 'Should handle null journal ID gracefully');
    assert(messages[0].content.includes('AI assistant'), 'Should provide generic welcome for null journal');

    // Test with empty string journal ID
    chatbot.initializeForJournal('', '');
    assert(chatbot.getCurrentJournalId() === '', 'Should handle empty journal ID');
  });

  console.log('\n📊 Test Results Summary:');
  console.log(`Total tests: ${testResults.length}`);
  console.log(`Passed: ${testResults.filter(t => t.status === 'PASSED').length}`);
  console.log(`Failed: ${testResults.filter(t => t.status === 'FAILED').length}`);

  const failedTests = testResults.filter(t => t.status === 'FAILED');
  if (failedTests.length > 0) {
    console.log('\n❌ Failed Tests:');
    failedTests.forEach(test => {
      console.log(`  - ${test.name}: ${test.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed! AI context isolation is working correctly.');
  }
}

// Database simulation for testing
const mockDatabase = (() => {
  const chats = new Map();
  const chatMessages = new Map();

  return {
    // Simulate Supabase chat operations
    async createChat(journalId) {
      const chatId = `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      chats.set(chatId, { id: chatId, journal_id: journalId });
      return { data: { id: chatId }, error: null };
    },

    async getChat(chatId, journalId) {
      const chat = chats.get(chatId);
      if (chat && chat.journal_id === journalId) {
        return { data: chat, error: null };
      }
      return { data: null, error: { code: 'PGRST116' } };
    },

    async getChatMessages(chatId) {
      const messages = [];
      for (const [msgId, msg] of chatMessages) {
        if (msg.chat_id === chatId) {
          messages.push(msg);
        }
      }
      messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      return { data: messages, error: null };
    },

    async saveMessage(chatId, role, content, files = null) {
      const msgId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const message = {
        id: msgId,
        chat_id: chatId,
        role,
        content,
        files,
        created_at: new Date().toISOString()
      };
      chatMessages.set(msgId, message);
      return { error: null };
    },

    async clearChatMessages(chatId) {
      const toDelete = [];
      for (const [msgId, msg] of chatMessages) {
        if (msg.chat_id === chatId) {
          toDelete.push(msgId);
        }
      }
      toDelete.forEach(id => chatMessages.delete(id));
      return { error: null };
    },

    // Test helpers
    getAllChats() { return Array.from(chats.values()); },
    getAllMessages() { return Array.from(chatMessages.values()); },
    clearAll() {
      chats.clear();
      chatMessages.clear();
    }
  };
})();

// Enhanced chatbot simulator with database integration
function createEnhancedChatbotSimulator() {
  let currentJournalId = null;
  let currentChatId = null;
  let messages = [];
  let isInitializing = false;

  const id = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  async function initializeForJournal(journalId, journalTitle) {
    console.log(`Initializing chatbot for journal: ${journalId}`);

    // Clear all state
    messages = [];
    currentJournalId = journalId;
    currentChatId = null;
    isInitializing = true;

    try {
      // Try to get existing chat
      let chatResult = await mockDatabase.getChat(`chat-${journalId}`, journalId);

      if (!chatResult.data) {
        // Create new chat
        console.log(`Creating new chat for journal ${journalId}`);
        const createResult = await mockDatabase.createChat(journalId);
        currentChatId = createResult.data.id;
      } else {
        currentChatId = chatResult.data.id;
      }

      // Load messages
      const messagesResult = await mockDatabase.getChatMessages(currentChatId);
      const loadedMessages = messagesResult.data || [];

      if (loadedMessages.length === 0) {
        // Start with empty messages - no welcome message
        messages = [];
      } else {
        messages = loadedMessages.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          files: msg.files
        }));
      }

    } catch (error) {
      console.error('Error initializing chat:', error);
      messages = [{
        id: id(),
        role: "assistant",
        content: `Hi! I'm your AI assistant for this journal${journalTitle ? ` "${journalTitle}"` : ''}. There was an issue loading your chat history.`,
      }];
    } finally {
      isInitializing = false;
    }
  }

  async function addUserMessage(content) {
    const userMessage = {
      id: id(),
      role: "user",
      content: content
    };

    messages.push(userMessage);
    await mockDatabase.saveMessage(currentChatId, userMessage.role, userMessage.content);
  }

  async function addAssistantMessage(content) {
    const assistantMessage = {
      id: id(),
      role: "assistant",
      content: content
    };

    messages.push(assistantMessage);
    await mockDatabase.saveMessage(currentChatId, assistantMessage.role, assistantMessage.content);
  }

  function getMessages() {
    return [...messages];
  }

  async function clearChatHistory() {
    if (!currentChatId) return;

    await mockDatabase.clearChatMessages(currentChatId);

    // Reinitialize
    const journalTitle = currentJournalId ? `Journal ${currentJournalId}` : '';
    await initializeForJournal(currentJournalId, journalTitle);
  }

  return {
    initializeForJournal,
    addUserMessage,
    addAssistantMessage,
    getMessages,
    clearChatHistory,
    getCurrentJournalId: () => currentJournalId,
    getCurrentChatId: () => currentChatId,
    isInitializing: () => isInitializing
  };
}

// Regression Tests for Chat Isolation
function runRegressionTests() {
  test('Regression: Two Journals Created Back-to-Back Have Independent Chats', async () => {
    // Clear all data
    mockDatabase.clearAll();

    const chatbot1 = createEnhancedChatbotSimulator();
    const chatbot2 = createEnhancedChatbotSimulator();

    // Create first journal
    await chatbot1.initializeForJournal('journal-regression-1', 'Regression Journal 1');
    await chatbot1.addUserMessage('Message 1 from journal 1');
    await chatbot1.addAssistantMessage('Response 1 from journal 1');

    // Create second journal immediately after
    await chatbot2.initializeForJournal('journal-regression-2', 'Regression Journal 2');
    await chatbot2.addUserMessage('Message 1 from journal 2');
    await chatbot2.addAssistantMessage('Response 1 from journal 2');

    // Verify complete isolation
    const journal1Messages = chatbot1.getMessages();
    const journal2Messages = chatbot2.getMessages();

    assert(journal1Messages.length === 2, 'Journal 1 should have 2 conversation messages (no welcome)');
    assert(journal2Messages.length === 2, 'Journal 2 should have 2 conversation messages (no welcome)');

    assert(journal1Messages[0].content === 'Message 1 from journal 1', 'Journal 1 first message should be user message');
    assert(journal1Messages[1].content === 'Response 1 from journal 1', 'Journal 1 second message should be assistant message');
    assert(journal2Messages[0].content === 'Message 1 from journal 2', 'Journal 2 first message should be user message');
    assert(journal2Messages[1].content === 'Response 1 from journal 2', 'Journal 2 second message should be assistant message');

    // Verify different chat IDs
    assert(chatbot1.getCurrentChatId() !== chatbot2.getCurrentChatId(), 'Different journals must have different chat IDs');

    // Verify database isolation
    const allChats = mockDatabase.getAllChats();
    assert(allChats.length === 2, 'Should have exactly 2 chats in database');
    assert(allChats.every(chat => chat.journal_id.startsWith('journal-regression-')), 'All chats should belong to regression journals');
  });

  test('Regression: Chat Context Cannot Be Accessed Across Journals', async () => {
    mockDatabase.clearAll();

    const chatbot1 = createEnhancedChatbotSimulator();
    const chatbot2 = createEnhancedChatbotSimulator();

    // Journal 1 extensive conversation
    await chatbot1.initializeForJournal('journal-isolation-A', 'Journal A');
    await chatbot1.addUserMessage('Secret data A1');
    await chatbot1.addAssistantMessage('Secret response A1');
    await chatbot1.addUserMessage('Secret data A2');
    await chatbot1.addAssistantMessage('Secret response A2');

    // Journal 2 different conversation
    await chatbot2.initializeForJournal('journal-isolation-B', 'Journal B');
    await chatbot2.addUserMessage('Secret data B1');
    await chatbot2.addAssistantMessage('Secret response B1');

    // Verify Journal 2 cannot see Journal 1's messages
    const journal1Messages = chatbot1.getMessages();
    const journal2Messages = chatbot2.getMessages();

    assert(journal1Messages.length === 5, 'Journal A should have 5 messages (welcome + 4 conversation)');
    assert(journal2Messages.length === 3, 'Journal B should have 3 messages (welcome + 2 conversation)');

    // Verify no message content crossover
    const journal1Content = journal1Messages.map(m => m.content).join(' ');
    const journal2Content = journal2Messages.map(m => m.content).join(' ');

    assert(!journal2Content.includes('Secret data A1'), 'Journal B should not contain Journal A messages');
    assert(!journal2Content.includes('Secret response A1'), 'Journal B should not contain Journal A responses');
    assert(!journal1Content.includes('Secret data B1'), 'Journal A should not contain Journal B messages');
    assert(!journal1Content.includes('Secret response B1'), 'Journal A should not contain Journal B responses');
  });

  test('Regression: Switching Journals Clears Context Completely', async () => {
    mockDatabase.clearAll();

    const chatbot = createEnhancedChatbotSimulator();

    // Start with Journal X
    await chatbot.initializeForJournal('journal-switch-X', 'Journal X');
    await chatbot.addUserMessage('Message X');
    await chatbot.addAssistantMessage('Response X');

    const journalXMessages = chatbot.getMessages();
    assert(journalXMessages.length === 2, 'Should have 2 messages for Journal X (no welcome)');
    const journalXChatId = chatbot.getCurrentChatId();

    // Switch to Journal Y
    await chatbot.initializeForJournal('journal-switch-Y', 'Journal Y');

    const journalYMessages = chatbot.getMessages();
    assert(journalYMessages.length === 0, 'Journal Y should start completely empty');
    assert(journalYMessages[0].content.includes('Journal Y'), 'Welcome message should be for correct journal');

    const journalYChatId = chatbot.getCurrentChatId();
    assert(journalXChatId !== journalYChatId, 'Switching journals should create new chat ID');

    // Verify Journal X context is preserved when switching back
    await chatbot.initializeForJournal('journal-switch-X', 'Journal X');
    const journalXMessagesAgain = chatbot.getMessages();
    assert(journalXMessagesAgain.length === 3, 'Journal X context should be restored');
    assert(journalXMessagesAgain[1].content === 'Message X', 'Journal X messages should be preserved');
  });

  test('Regression: Chat IDs Are Strictly Scoped to Journal IDs', async () => {
    mockDatabase.clearAll();

    const chatbot = createEnhancedChatbotSimulator();

    // Create multiple journals
    await chatbot.initializeForJournal('journal-scope-1', 'Scope Journal 1');
    const chatId1 = chatbot.getCurrentChatId();

    await chatbot.initializeForJournal('journal-scope-2', 'Scope Journal 2');
    const chatId2 = chatbot.getCurrentChatId();

    await chatbot.initializeForJournal('journal-scope-3', 'Scope Journal 3');
    const chatId3 = chatbot.getCurrentChatId();

    // Verify all chat IDs are different
    assert(chatId1 !== chatId2, 'Different journals must have different chat IDs (1 vs 2)');
    assert(chatId2 !== chatId3, 'Different journals must have different chat IDs (2 vs 3)');
    assert(chatId1 !== chatId3, 'Different journals must have different chat IDs (1 vs 3)');

    // Verify chat ID format includes journal scoping
    assert(chatId1 && chatId1.startsWith('chat-'), 'Chat ID should have proper format');
    assert(chatId2 && chatId2.startsWith('chat-'), 'Chat ID should have proper format');
    assert(chatId3 && chatId3.startsWith('chat-'), 'Chat ID should have proper format');

    // Verify database relationships
    const allChats = mockDatabase.getAllChats();
    assert(allChats.length === 3, 'Should have 3 chats in database');

    const journalIds = allChats.map(chat => chat.journal_id).sort();
    assert(journalIds[0] === 'journal-scope-1', 'Chat should be linked to correct journal 1');
    assert(journalIds[1] === 'journal-scope-2', 'Chat should be linked to correct journal 2');
    assert(journalIds[2] === 'journal-scope-3', 'Chat should be linked to correct journal 3');
  });
}

// Browser console test runner
function runBrowserTests() {
  console.log('🚀 Starting AI Context Isolation Tests in Browser Console');

  // Clear any existing test data
  mockLocalStorage.clear();
  mockDatabase.clearAll();

  runIsolationTests();
  runRegressionTests();

  console.log('\n📊 Test Results Summary:');
  console.log(`Total tests: ${testResults.length}`);
  console.log(`Passed: ${testResults.filter(t => t.status === 'PASSED').length}`);
  console.log(`Failed: ${testResults.filter(t => t.status === 'FAILED').length}`);

  const failedTests = testResults.filter(t => t.status === 'FAILED');
  if (failedTests.length > 0) {
    console.log('\n❌ Failed Tests:');
    failedTests.forEach(test => {
      console.log(`  - ${test.name}: ${test.error}`);
    });
  } else {
    console.log('\n🎉 All tests passed! AI context isolation is working correctly.');
    console.log('\n✅ Regression tests confirm:');
    console.log('  • Multiple journals have completely independent chats');
    console.log('  • No context leakage between journals');
    console.log('  • Chat IDs are properly scoped to journals');
    console.log('  • State clearing works correctly on journal switches');
  }

  return failedTests.length === 0;
}

// Make available globally for browser console testing
if (typeof window !== 'undefined') {
  window.runAIIsolationTests = runBrowserTests;
  window.testAIIsolation = {
    runBrowserTests,
    mockLocalStorage,
    mockDatabase,
    createMockChatbotSidebar,
    createEnhancedChatbotSimulator
  };
  console.log('🔧 AI Isolation Test Suite loaded!');
  console.log('💡 Run: runAIIsolationTests() to execute all tests');
  console.log('💡 Access components: window.testAIIsolation');
}
