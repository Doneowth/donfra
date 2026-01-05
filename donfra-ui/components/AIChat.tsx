"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { api } from "@/lib/api";
import "./AIChat.css";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AIChatProps {
  codeContent: string;
  userRole?: string;
}

export default function AIChat({ codeContent, userRole }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [codeAnalyzed, setCodeAnalyzed] = useState(false); // Track if code has been sent
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isVipOrAdmin = userRole === "vip" || userRole === "admin";

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) {
      setError("Please enter a question");
      return;
    }

    if (!isVipOrAdmin) {
      setError("VIP or admin access required");
      return;
    }

    setError("");
    setLoading(true);

    // Add user message immediately
    const userMessage: Message = {
      role: "user",
      content: question,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setQuestion("");

    try {
      // Build conversation history for context
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Only send code on first message or if not analyzed yet
      const shouldSendCode = !codeAnalyzed && codeContent.trim();

      // Use non-streaming API
      const response = await api.ai.chat(
        shouldSendCode ? codeContent : undefined,
        question,
        conversationHistory
      );

      const assistantMessage: Message = {
        role: "assistant",
        content: response.response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      if (shouldSendCode) {
        setCodeAnalyzed(true);
      }

      setLoading(false);
    } catch (err: any) {
      setError(err.message || "Failed to get AI response");
      // Remove the user message if request failed
      setMessages((prev) => prev.slice(0, -1));
      setQuestion(userMessage.content); // Restore the question
      setLoading(false);
    }
  };

  const handleAnalyzeCode = async () => {
    if (!codeContent.trim()) {
      setError("No code to analyze");
      return;
    }

    if (!isVipOrAdmin) {
      setError("VIP or admin access required");
      return;
    }

    setError("");
    setLoading(true);

    // Add user message
    const userMessage: Message = {
      role: "user",
      content: "Please analyze this code and provide suggestions.",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await api.ai.analyze(codeContent);

      // Mark code as analyzed
      setCodeAnalyzed(true);

      const assistantMessage: Message = {
        role: "assistant",
        content: response.response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      setError(err.message || "Failed to analyze code");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  if (!isVipOrAdmin) {
    return (
      <div className="ai-chat-container">
        <div className="ai-chat-vip-notice">
          <div className="vip-icon">🌟</div>
          <h3>VIP Ask AI</h3>
          <p>This feature is available to VIP and admin users only.</p>
          <p>Upgrade to VIP to unlock AI-powered code analysis and suggestions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-chat-container">
      <div className="ai-chat-header">
        <div className="ai-title">
          <span className="ai-icon">🤖</span>
          <span>Donfra AI</span>
        </div>
        <button
          className="btn-analyze"
          onClick={handleAnalyzeCode}
          disabled={loading || !codeContent.trim()}
          title="Analyze current code"
        >
          Analyze Code
        </button>
      </div>

      <div className="ai-chat-messages">
        {messages.length === 0 && (
          <div className="ai-empty-state">
            <p>👋 Hi! I'm Donfra, your AI code assistant.</p>
            <p>Ask me questions about your code or click "Analyze Code" for suggestions.</p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`ai-message ${msg.role}`}>
            <div className="message-header">
              <span className="message-role">
                {msg.role === "user" ? "You" : "Donfra"}
              </span>
              <span className="message-time">
                {msg.timestamp.toLocaleTimeString()}
              </span>
            </div>
            <div className="message-content">
              {msg.role === "assistant" ? (
                <ReactMarkdown
                  components={{
                    code: ({ node, inline, className, children, ...props }: any) => {
                      return !inline ? (
                        <pre className="code-block">
                          <code className={className} {...props}>
                            {children}
                          </code>
                        </pre>
                      ) : (
                        <code className="inline-code" {...props}>
                          {children}
                        </code>
                      );
                    },
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="ai-message assistant loading">
            <div className="message-header">
              <span className="message-role">Donfra</span>
            </div>
            <div className="message-content">
              <span className="loading-dots">Thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="ai-chat-input">
        {error && <div className="ai-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            className="ai-input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about your code..."
            disabled={loading}
          />
          <button
            type="submit"
            className="btn-send"
            disabled={loading || !question.trim()}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
