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

// Preset questions for quick start
const PRESET_QUESTIONS = [
  "💡 Analyze time/space complexity",
  "🐛 Find potential bugs",
  "🚀 Suggest optimizations",
  "📝 Explain the logic",
  "🎯 Review for interview",
];

export default function AIChat({ codeContent, userRole }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isVipOrAbove = userRole === "vip" || userRole === "admin" || userRole === "god";

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent, presetQuestion?: string) => {
    e.preventDefault();
    const userQuestion = presetQuestion || question.trim();

    if (!userQuestion) {
      setError("Please enter a question");
      return;
    }

    if (!isVipOrAbove) {
      setError("VIP access required");
      return;
    }

    setError("");
    setLoading(true);

    // Add user message immediately
    const userMessage: Message = {
      role: "user",
      content: userQuestion,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setQuestion("");

    // Add placeholder assistant message for streaming
    const assistantMessageIndex = messages.length + 1;
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", timestamp: new Date() },
    ]);

    try {
      // Build conversation history for context
      const conversationHistory = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // Smart code sending logic:
      // - Always send code on first message
      // - Send code if question explicitly mentions code/analysis/review
      const isFirstMessage = messages.length === 0;
      const mentionsCode =
        userQuestion.toLowerCase().includes("code") ||
        userQuestion.toLowerCase().includes("analyze") ||
        userQuestion.toLowerCase().includes("review") ||
        userQuestion.toLowerCase().includes("complexity") ||
        userQuestion.toLowerCase().includes("bug") ||
        userQuestion.toLowerCase().includes("optim");

      const shouldSendCode = (isFirstMessage || mentionsCode) && codeContent.trim();

      let fullResponse = "";

      // Use streaming API for better UX
      await api.ai.chatStream(
        shouldSendCode ? codeContent : undefined,
        userQuestion,
        conversationHistory,
        (chunk) => {
          // Update the placeholder message with streaming content
          fullResponse += chunk;
          setMessages((prev) => {
            const updated = [...prev];
            updated[assistantMessageIndex] = {
              role: "assistant",
              content: fullResponse,
              timestamp: new Date(),
            };
            return updated;
          });
        },
        (errorMsg) => {
          setError(errorMsg);
          // Remove placeholder message on error
          setMessages((prev) => prev.slice(0, -1));
        }
      );

      setLoading(false);
    } catch (err: any) {
      setError(err.message || "Failed to get AI response");
      // Remove user message and placeholder on error
      setMessages((prev) => prev.slice(0, -2));
      setQuestion(userMessage.content); // Restore the question
      setLoading(false);
    }
  };

  const handlePresetQuestion = (preset: string) => {
    if (!codeContent.trim()) {
      setError("Write some code first!");
      return;
    }
    // Extract just the text after emoji
    const questionText = preset.split(" ").slice(1).join(" ");
    handleSubmit(new Event("submit") as any, questionText);
  };

  if (!isVipOrAbove) {
    return (
      <div className="ai-chat-container">
        <div className="ai-chat-vip-notice">
          <div className="vip-icon">🌟</div>
          <h3>VIP Ask AI</h3>
          <p>This feature is available to VIP users and above.</p>
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
        {messages.length > 0 && (
          <button
            className="btn-clear"
            onClick={() => setMessages([])}
            title="Clear conversation"
          >
            Clear
          </button>
        )}
      </div>

      <div className="ai-chat-messages">
        {messages.length === 0 && (
          <div className="ai-empty-state">
            <p className="ai-welcome">
              👋 Hi! I'm Donfra, your AI code interview coach.
            </p>
            <p className="ai-subtitle">
              I can help you practice mock interviews, analyze your solutions, and improve your coding skills.
            </p>

            {codeContent.trim() ? (
              <>
                <p className="preset-label">Quick actions:</p>
                <div className="preset-questions">
                  {PRESET_QUESTIONS.map((preset) => (
                    <button
                      key={preset}
                      className="preset-btn"
                      onClick={() => handlePresetQuestion(preset)}
                      disabled={loading}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="ai-hint">
                💡 Write some code in the editor, then ask me anything!
              </p>
            )}
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
                msg.content ? (
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
                  <span className="typing-indicator">●●●</span>
                )
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

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
            placeholder={
              codeContent.trim()
                ? "Ask about your code..."
                : "Write code first, then ask me anything!"
            }
            disabled={loading}
          />
          <button
            type="submit"
            className="btn-send"
            disabled={loading || !question.trim()}
          >
            {loading ? "..." : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}
