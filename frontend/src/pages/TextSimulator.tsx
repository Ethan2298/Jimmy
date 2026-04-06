import { useState, useEffect, useRef } from 'react';
import { sendMessage, getCars, type Car, type Message } from '../api/client';
import ChatBubble from '../components/ChatBubble';

interface DisplayMessage {
  content: string;
  isUser: boolean;
  timestamp: string;
}

function generatePhoneNumber(): string {
  const area = Math.floor(Math.random() * 900) + 100;
  const prefix = Math.floor(Math.random() * 900) + 100;
  const line = Math.floor(Math.random() * 9000) + 1000;
  return `+1${area}${prefix}${line}`;
}

export default function TextSimulator() {
  const [phoneNumber, setPhoneNumber] = useState(generatePhoneNumber());
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [cars, setCars] = useState<Car[]>([]);
  const [selectedCarId, setSelectedCarId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getCars().then(setCars).catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const handleNewConversation = () => {
    setPhoneNumber(generatePhoneNumber());
    setMessages([]);
    setConversationId(null);
    setSelectedCarId('');
    setInput('');
    inputRef.current?.focus();
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    // Add user message
    const userMsg: DisplayMessage = {
      content: text,
      isUser: true,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);
    setTyping(true);

    try {
      const carId = selectedCarId ? Number(selectedCarId) : undefined;
      const response = await sendMessage(phoneNumber, text, carId);

      // Store conversation_id for continuity
      if (response.conversation_id) {
        setConversationId(response.conversation_id);
      }

      // Clear car selection after first message
      if (selectedCarId) {
        setSelectedCarId('');
      }

      // Display response messages with delays
      if (response.messages && response.messages.length > 0) {
        await displayMessagesWithDelays(response.messages);
      }
    } catch {
      setTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          content: 'Sorry, something went wrong. Please try again.',
          isUser: false,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const displayMessagesWithDelays = async (responseMsgs: Message[]) => {
    for (let i = 0; i < responseMsgs.length; i++) {
      const msg = responseMsgs[i];
      const delay = msg.delay_ms || 1000;

      await new Promise((resolve) => setTimeout(resolve, delay));

      const displayMsg: DisplayMessage = {
        content: msg.content,
        isUser: false,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, displayMsg]);

      // Keep typing indicator if more messages are coming
      if (i < responseMsgs.length - 1) {
        setTyping(true);
      } else {
        setTyping(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)]">
      {/* Header */}
      <div className="bg-charcoal-700 border border-charcoal-500 rounded-t-xl px-5 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {/* Phone avatar */}
          <div className="w-10 h-10 rounded-full bg-charcoal-500 flex items-center justify-center">
            <svg className="w-5 h-5 text-charcoal-300" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </div>
          <div>
            <p className="text-white font-medium text-sm">{phoneNumber}</p>
            <p className="text-charcoal-300 text-xs">
              {conversationId ? `Conversation #${conversationId}` : 'New conversation'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Car selector */}
          <select
            value={selectedCarId}
            onChange={(e) => setSelectedCarId(e.target.value)}
            className="bg-charcoal-800 border border-charcoal-500 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-rpm-red max-w-[200px]"
          >
            <option value="">Text about a car...</option>
            {cars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.year} {c.make} {c.model} - ${c.price.toLocaleString()}
              </option>
            ))}
          </select>
          <button
            onClick={handleNewConversation}
            className="px-3 py-1.5 bg-rpm-red hover:bg-rpm-red-dark text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
          >
            New Conversation
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto bg-charcoal-900 border-x border-charcoal-500 px-4 py-4">
        {messages.length === 0 && !typing && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-charcoal-700 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-charcoal-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/>
              </svg>
            </div>
            <p className="text-charcoal-400 text-sm mb-1">Send a message to Marcus</p>
            <p className="text-charcoal-500 text-xs">
              {selectedCarId ? 'Ask about the selected car' : 'Ask about collector cars, schedule a viewing, or just say hi'}
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <ChatBubble
            key={i}
            message={msg.content}
            isUser={msg.isUser}
            timestamp={msg.timestamp}
          />
        ))}

        {/* Typing Indicator */}
        {typing && (
          <div className="flex justify-start mb-3">
            <div className="bg-charcoal-600 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1">
              <span className="text-charcoal-300 text-xs mr-2">Marcus is typing</span>
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="bg-charcoal-700 border border-charcoal-500 border-t-0 rounded-b-xl px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={selectedCarId ? 'Ask about this car...' : 'Type a message...'}
            disabled={sending}
            className="flex-1 bg-charcoal-800 border border-charcoal-500 rounded-full px-4 py-2.5 text-white text-sm placeholder-charcoal-400 focus:outline-none focus:border-rpm-red disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="w-10 h-10 bg-rpm-red hover:bg-rpm-red-dark disabled:bg-charcoal-500 disabled:cursor-not-allowed text-white rounded-full flex items-center justify-center transition-colors shrink-0"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
