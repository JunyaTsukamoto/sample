import React, { useState, useRef, useEffect } from 'react';
import styles from './ChatBot.module.css';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
}

interface ChatBotProps {
  onClose: () => void;
}

export const ChatBot: React.FC<ChatBotProps> = ({ onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      text: 'こんにちは！「きづき」AIアシスタントです。本日の社会とAIの「兆し（トレンド）」について何でも聞いてください。ブックマークしている記事や、今日の特定のトピックについて質問したり、要約を深掘りしたりできます。',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessageText = input.trim();
    setInput('');
    
    const userMsgId = Date.now().toString();
    const newUserMessage: Message = {
      id: userMsgId,
      role: 'user',
      text: userMessageText,
    };
    
    setMessages(prev => [...prev, newUserMessage]);
    setLoading(true);

    try {
      // Map message history to Gemini API format, ignoring the welcome message
      const history = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({
          role: m.role,
          parts: [{ text: m.text }],
        }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userMessageText,
          history,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setMessages(prev => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: data.response,
          },
        ]);
      } else {
        throw new Error(data.error || 'Failed to get response');
      }
    } catch (error: any) {
      console.error(error);
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: `エラーが発生しました: ${error.message || '通信エラー'}。時間をおいて再度お試しください。`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Safe and minimal custom Markdown parser
  const renderMarkdown = (text: string) => {
    let escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // **bold** -> <strong>
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // *italic* -> <em>
    escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // `code` -> <code>
    escaped = escaped.replace(/`(.*?)`/g, '<code>$1</code>');

    const lines = escaped.split('\n');
    let htmlResult = '';
    let inList = false;

    lines.forEach(line => {
      const trimmed = line.trim();
      const isListItem = trimmed.startsWith('- ') || trimmed.startsWith('* ');

      if (isListItem) {
        if (!inList) {
          htmlResult += '<ul>';
          inList = true;
        }
        const content = trimmed.substring(2);
        htmlResult += `<li>${content}</li>`;
      } else {
        if (inList) {
          htmlResult += '</ul>';
          inList = false;
        }
        if (trimmed === '') {
          // Ignore extra white spaces
        } else {
          htmlResult += `<p>${line}</p>`;
        }
      }
    });

    if (inList) {
      htmlResult += '</ul>';
    }

    return (
      <div
        className={styles.markdown}
        dangerouslySetInnerHTML={{ __html: htmlResult }}
      />
    );
  };

  return (
    <div className={styles.sidebar}>
      <div className={styles.header}>
        <div className={styles.titleInfo}>
          <span className={styles.sparkle}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707-.707M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" />
            </svg>
          </span>
          <div className={styles.titleText}>
            <span className={styles.title}>兆しAIアシスタント</span>
            <span className={styles.subtitle}>最新ニュースを元に対話します</span>
          </div>
        </div>
        <button onClick={onClose} className={styles.closeBtn} title="閉じる" aria-label="Close">
          &times;
        </button>
      </div>

      <div className={styles.messages}>
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`${styles.message} ${msg.role === 'user' ? styles.user : styles.model}`}
          >
            {renderMarkdown(msg.text)}
          </div>
        ))}
        {loading && (
          <div className={styles.loading}>
            <span className={styles.spinner}></span>
            <span>AIが考え中...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.footer}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="最近のAIの動向は？ #制度 について教えて..."
            className={styles.input}
            disabled={loading}
          />
          <button type="submit" className={styles.sendBtn} disabled={loading || !input.trim()}>
            送信
          </button>
        </form>
      </div>
    </div>
  );
};
export default ChatBot;
