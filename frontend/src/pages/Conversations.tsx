import { useState, useEffect } from 'react';
import { getConversations, getConversation, type Conversation, type Message } from '../api/client';
import ChatBubble from '../components/ChatBubble';

export default function Conversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getConversations()
      .then(setConversations)
      .catch(() => setError('Failed to load conversations'))
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = async (id: number) => {
    if (selectedId === id) {
      setSelectedId(null);
      setMessages([]);
      return;
    }
    setSelectedId(id);
    setLoadingMessages(true);
    try {
      const conv = await getConversation(id);
      setMessages(conv.messages || []);
    } catch {
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-charcoal-400">Loading conversations...</p></div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">Conversations</h1>
      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {conversations.length === 0 ? (
        <div className="flex items-center justify-center h-40">
          <p className="text-charcoal-400">No conversations yet. Use the Text Simulator to start one.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => (
            <div key={conv.id}>
              {/* Conversation Row */}
              <div
                onClick={() => handleSelect(conv.id)}
                className={`flex items-center justify-between px-5 py-4 rounded-xl cursor-pointer transition-colors border ${
                  selectedId === conv.id
                    ? 'bg-charcoal-600 border-rpm-red/30'
                    : 'bg-charcoal-700 border-charcoal-500 hover:border-charcoal-400'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-white font-medium text-sm">{conv.phone_number}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      conv.status === 'active' ? 'bg-green-700 text-green-200' : 'bg-charcoal-500 text-charcoal-300'
                    }`}>
                      {conv.status}
                    </span>
                  </div>
                  <p className="text-charcoal-300 text-sm truncate">{conv.last_message || 'No messages'}</p>
                </div>
                <div className="text-charcoal-400 text-xs ml-4 whitespace-nowrap">
                  {conv.last_message_at ? new Date(conv.last_message_at).toLocaleString() : ''}
                </div>
              </div>

              {/* Expanded Messages */}
              {selectedId === conv.id && (
                <div className="bg-charcoal-800 border border-charcoal-500 border-t-0 rounded-b-xl px-5 py-4 max-h-96 overflow-y-auto">
                  {loadingMessages ? (
                    <p className="text-charcoal-400 text-sm text-center py-4">Loading messages...</p>
                  ) : messages.length === 0 ? (
                    <p className="text-charcoal-400 text-sm text-center py-4">No messages in this conversation</p>
                  ) : (
                    <div className="space-y-1">
                      {messages.map((msg, i) => (
                        <ChatBubble
                          key={i}
                          message={msg.content}
                          isUser={msg.role === 'customer'}
                          timestamp={msg.timestamp}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
