import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Zap, Wifi, WifiOff, Send, BookOpen, Tag, Settings2 } from 'lucide-react';
import { connectPowerSync, getAllEntries, searchEntries, insertEntry } from './db/powersync';
import { askAI, getAvailableProviders, type AIProvider } from './api/claude';
import { v4 as uuidv4 } from 'uuid';

interface Entry {
  id: string;
  question: string;
  answer: string;
  tags: string;
  created_at: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  tags?: string[];
  timestamp: Date;
}

export default function App() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [question, setQuestion] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'connecting' | 'connected' | 'offline'>('connecting');
  const [activeView, setActiveView] = useState<'chat' | 'browse'>('chat');
  const [error, setError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [provider, setProvider] = useState<AIProvider>('ollama');
  const [showSettings, setShowSettings] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const providers = getAvailableProviders();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    async function init() {
      try {
        await connectPowerSync();
        setSyncStatus('connected');
        await loadEntries();
      } catch (err) {
        console.error('PowerSync connection failed:', err);
        setSyncStatus('offline');
        await loadEntries();
      }
    }
    init();
  }, []);

  const loadEntries = useCallback(async () => {
    try {
      const data = await getAllEntries();
      setEntries(data);
    } catch (err) {
      console.error('Failed to load entries:', err);
    }
  }, []);

  const handleSearch = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (q.trim()) {
      const results = await searchEntries(q);
      setEntries(results);
    } else {
      await loadEntries();
    }
  }, [loadEntries]);

  const handleAsk = useCallback(async () => {
    if (!question.trim() || loading) return;

    const userMsg = question.trim();
    setQuestion('');
    setError(null);

    // Add user message to chat immediately
    setChatMessages(prev => [...prev, {
      role: 'user',
      content: userMsg,
      timestamp: new Date(),
    }]);

    setLoading(true);

    try {
      const context = entries.slice(0, 5).map(e => ({
        question: e.question,
        answer: e.answer,
      }));

      const response = await askAI(userMsg, context, provider);

      // Add assistant message to chat
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: response.answer,
        tags: response.tags,
        timestamp: new Date(),
      }]);

      // Store in PowerSync
      const id = uuidv4();
      await insertEntry({
        id,
        question: userMsg,
        answer: response.answer,
        tags: response.tags,
      });

      await loadEntries();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to get answer.';
      setError(errMsg);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${errMsg}`,
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [question, loading, entries, loadEntries, provider]);

  const parseTags = (tagsStr: string): string[] => {
    try {
      return JSON.parse(tagsStr) || [];
    } catch {
      return tagsStr ? [tagsStr] : [];
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-3 flex-shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">SyncMind</h1>
              <p className="text-xs text-gray-400">Local-First AI Knowledge Base</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Provider Selector */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-600 transition-colors"
            >
              <Settings2 className="w-3.5 h-3.5" />
              {providers.find(p => p.id === provider)?.name || provider}
            </button>

            {/* Sync Status */}
            <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border ${
              syncStatus === 'connected'
                ? 'border-green-800 bg-green-900/20 text-green-400'
                : syncStatus === 'offline'
                ? 'border-yellow-800 bg-yellow-900/20 text-yellow-400'
                : 'border-gray-700 bg-gray-800/50 text-gray-400'
            }`}>
              {syncStatus === 'connected' ? (
                <><Wifi className="w-3.5 h-3.5" /> Synced</>
              ) : syncStatus === 'offline' ? (
                <><WifiOff className="w-3.5 h-3.5" /> Offline</>
              ) : (
                <><div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" /> ...</>
              )}
            </div>
          </div>
        </div>

        {/* Settings Dropdown */}
        {showSettings && (
          <div className="max-w-4xl mx-auto mt-3 p-4 bg-gray-900 border border-gray-700 rounded-xl">
            <p className="text-sm font-medium mb-2">AI Provider</p>
            <div className="flex gap-2">
              {providers.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setProvider(p.id); setShowSettings(false); }}
                  disabled={!p.available}
                  className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                    provider === p.id
                      ? 'bg-blue-600 text-white'
                      : p.available
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                  }`}
                >
                  {p.name}
                  {!p.available && ' (no key)'}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* View Toggle */}
      <div className="max-w-4xl mx-auto w-full px-6 pt-4 flex-shrink-0">
        <div className="flex gap-1 bg-gray-900 p-1 rounded-lg w-fit">
          <button
            onClick={() => setActiveView('chat')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeView === 'chat' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Zap className="w-4 h-4" /> Chat
          </button>
          <button
            onClick={() => setActiveView('browse')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeView === 'browse' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <BookOpen className="w-4 h-4" /> Knowledge Base ({entries.length})
          </button>
        </div>
      </div>

      {/* Chat View */}
      {activeView === 'chat' && (
        <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-6">
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto py-6 space-y-4 min-h-0" style={{ maxHeight: 'calc(100vh - 280px)' }}>
            {chatMessages.length === 0 && (
              <div className="text-center py-16 text-gray-500">
                <Zap className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-lg font-medium mb-1">Ask SyncMind anything</p>
                <p className="text-sm">Answers are stored locally and synced across devices.</p>
                <p className="text-xs mt-2">Using: {providers.find(p => p.id === provider)?.name}</p>
              </div>
            )}

            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-md'
                    : 'bg-gray-800 border border-gray-700 text-gray-100 rounded-bl-md'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <div className={`flex items-center gap-1.5 mt-1 flex-wrap ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-500'}`}>
                    <span className="text-xs">{msg.timestamp.toLocaleTimeString()}</span>
                    {msg.tags && msg.tags.length > 0 && msg.tags[0] !== 'general' && msg.tags.map((tag, ti) => (
                      <span key={ti} className="text-[10px] opacity-60 px-1 py-0.5 rounded bg-gray-700/40">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-800 border border-gray-700 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-2 text-gray-400 text-sm">
                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    Thinking...
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg px-4 py-2 text-red-400 text-sm mb-2 flex-shrink-0">
              {error}
            </div>
          )}

          {/* Input */}
          <div className="flex-shrink-0 pb-4">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAsk();
                  }
                }}
                placeholder="Ask anything... (Enter to send, Shift+Enter for new line)"
                rows={1}
                className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 placeholder-gray-500 resize-none focus:outline-none focus:border-blue-500 transition-colors"
                style={{ minHeight: '48px', maxHeight: '120px' }}
              />
              <button
                onClick={handleAsk}
                disabled={loading || !question.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white p-3 rounded-xl transition-colors flex-shrink-0"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Browse View */}
      {activeView === 'browse' && (
        <div className="flex-1 max-w-4xl mx-auto w-full px-6 py-6 space-y-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search your knowledge base..."
              className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-11 pr-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {entries.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No entries yet. Ask your first question!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {entries.map((entry) => (
                <EntryCard key={entry.id} entry={entry} parseTags={parseTags} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-gray-800 px-6 py-3 flex-shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-xs text-gray-500">
          <span>Powered by PowerSync + {provider === 'claude' ? 'Claude AI' : 'Ollama'}</span>
          <span>Data stored locally in SQLite</span>
        </div>
      </footer>
    </div>
  );
}

function EntryCard({
  entry,
  parseTags,
}: {
  entry: Entry;
  parseTags: (s: string) => string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const tags = parseTags(entry.tags);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
      <div className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <p className="font-medium text-gray-100 mb-1">{entry.question}</p>
        {!expanded ? (
          <p className="text-sm text-gray-400 line-clamp-2">{entry.answer}</p>
        ) : (
          <p className="text-sm text-gray-300 whitespace-pre-wrap mt-2">{entry.answer}</p>
        )}
      </div>

      {tags.length > 0 && (
        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          <Tag className="w-3 h-3 text-gray-600" />
          {tags.map((tag) => (
            <span key={tag} className="text-xs bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded-full border border-blue-800/50">
              {tag}
            </span>
          ))}
          <span className="text-xs text-gray-600 ml-auto">
            {new Date(entry.created_at).toLocaleDateString()}
          </span>
        </div>
      )}
    </div>
  );
}
