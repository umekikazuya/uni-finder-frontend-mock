"use client";

import { useState, useEffect, useRef } from "react";

interface ChatMessage {
  id: string;
  type: "user" | "ai";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

interface ChatHistory {
  id: string;
  title: string;
  timestamp: Date;
  messages: ChatMessage[];
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"chat" | "history" | "bookmarks">(
    "chat"
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
  const [bookmarks, setBookmarks] = useState<ChatMessage[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedHistory = localStorage.getItem("clue-ai-chat-history");
    const savedBookmarks = localStorage.getItem("clue-ai-bookmarks");

    if (savedHistory) {
      setChatHistory(
        JSON.parse(savedHistory).map((item: ChatHistory) => ({
          ...item,
          timestamp: new Date(item.timestamp),
          messages: item.messages.map((msg: ChatMessage) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          })),
        }))
      );
    }

    if (savedBookmarks) {
      setBookmarks(
        JSON.parse(savedBookmarks).map((msg: ChatMessage) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }))
      );
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("clue-ai-chat-history", JSON.stringify(chatHistory));
  }, [chatHistory]);

  useEffect(() => {
    localStorage.setItem("clue-ai-bookmarks", JSON.stringify(bookmarks));
  }, [bookmarks]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMessage]);

  const handleSendMessage = async () => {
    if (!query.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: "user",
      content: query,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setQuery("");
    setIsSearching(true);
    setStreamingMessage("");

    const aiMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      type: "ai",
      content: "",
      timestamp: new Date(),
      isStreaming: true,
    };

    setMessages((prev) => [...prev, aiMessage]);

    try {
      const response = await fetch("/api/v1/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: userMessage.content }),
      });

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.content) {
                fullResponse += data.content;
                setStreamingMessage(fullResponse);

                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === aiMessage.id
                      ? { ...msg, content: fullResponse }
                      : msg
                  )
                );
              }
            } catch (e) {
              // Ignore parsing errors
            }
          }
        }
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMessage.id
            ? { ...msg, content: fullResponse, isStreaming: false }
            : msg
        )
      );

      const chatSession: ChatHistory = {
        id: Date.now().toString(),
        title:
          userMessage.content.slice(0, 50) +
          (userMessage.content.length > 50 ? "..." : ""),
        timestamp: new Date(),
        messages: [
          userMessage,
          { ...aiMessage, content: fullResponse, isStreaming: false },
        ],
      };
      setChatHistory((prev) => [chatSession, ...prev.slice(0, 49)]);
    } catch (error) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMessage.id
            ? {
                ...msg,
                content: "申し訳ございません。エラーが発生しました。",
                isStreaming: false,
              }
            : msg
        )
      );
    } finally {
      setIsSearching(false);
      setStreamingMessage("");
    }
  };

  const toggleBookmark = (message: ChatMessage) => {
    setBookmarks((prev) => {
      const isBookmarked = prev.some((b) => b.id === message.id);
      if (isBookmarked) {
        return prev.filter((b) => b.id !== message.id);
      } else {
        return [...prev, message];
      }
    });
  };

  const isBookmarked = (messageId: string) => {
    return bookmarks.some((b) => b.id === messageId);
  };

  const handleHistoryClick = (historyItem: ChatHistory) => {
    setMessages(historyItem.messages);
    setActiveTab("chat");
  };

  const startNewChat = () => {
    setMessages([]);
    setActiveTab("chat");
  };

  const MessageBubble = ({ message }: { message: ChatMessage }) => (
    <div
      className={`flex ${
        message.type === "user" ? "justify-end" : "justify-start"
      } mb-4`}
    >
      <div
        className={`max-w-3xl ${
          message.type === "user" ? "order-2" : "order-1"
        }`}
      >
        <div
          className={`px-4 py-3 rounded-lg ${
            message.type === "user"
              ? "bg-blue-600 text-white"
              : "bg-white border border-gray-200 text-gray-900"
          }`}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
          {message.isStreaming && (
            <div className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-1"></div>
          )}
        </div>
        <div
          className={`flex items-center mt-1 text-xs text-gray-500 ${
            message.type === "user" ? "justify-end" : "justify-start"
          }`}
        >
          <span className="mr-2">
            {message.timestamp.toLocaleTimeString("ja-JP", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {message.type === "ai" && (
            <button
              onClick={() => toggleBookmark(message)}
              className={`p-1 rounded ${
                isBookmarked(message.id)
                  ? "text-yellow-500 hover:text-yellow-600"
                  : "text-gray-400 hover:text-yellow-500"
              }`}
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 px-6 py-4 flex-shrink-0 shadow-sm">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center"></div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Clue.ai
            </h1>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={startNewChat}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span>新しいチャット</span>
            </button>
            <div className="w-10 h-10 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center">
              <svg
                className="w-5 h-5 text-gray-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 px-6 flex-shrink-0">
        <div className="max-w-6xl mx-auto">
          <nav className="-mb-px flex space-x-8">
            {[
              {
                key: "chat",
                label: "チャット",
                count: messages.length,
              },
              {
                key: "history",
                label: "履歴",
                count: chatHistory.length,
              },
              {
                key: "bookmarks",
                label: "ブックマーク",
                count: bookmarks.length,
              },
            ].map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() =>
                  setActiveTab(key as "chat" | "history" | "bookmarks")
                }
                className={`py-4 px-2 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors ${
                  activeTab === key
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <span>{label}</span>
                <span
                  className={`px-2 py-1 rounded-full text-xs ${
                    activeTab === key
                      ? "bg-blue-100 text-blue-600"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {count}
                </span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {activeTab === "chat" && (
            <div className="space-y-6">
              {messages.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4"></div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Clue.aiへようこそ！
                  </h2>
                  <p className="text-gray-600 text-lg">
                    何でもお聞きください。AIがお手伝いします。
                  </p>
                </div>
              ) : (
                messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {activeTab === "history" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  チャット履歴
                </h2>
                <button
                  onClick={startNewChat}
                  className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all font-medium text-sm shadow-md"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  <span>新しいチャットを開始</span>
                </button>
              </div>
              {chatHistory.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-6 h-6 text-gray-400"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                  </div>
                  <p className="text-gray-500">チャット履歴がありません</p>
                </div>
              ) : (
                chatHistory.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white/70 backdrop-blur-sm border border-gray-200/50 rounded-xl p-5 hover:shadow-md transition-all cursor-pointer group"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <button
                        onClick={() => handleHistoryClick(item)}
                        className="text-lg font-semibold text-gray-900 hover:text-blue-600 text-left group-hover:text-blue-600 transition-colors flex-1"
                      >
                        {item.title}
                      </button>
                      <span className="text-sm text-gray-500 ml-4 flex-shrink-0">
                        {item.timestamp.toLocaleDateString("ja-JP", {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        {item.timestamp.toLocaleTimeString("ja-JP", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <svg
                        className="w-4 h-4 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                        />
                      </svg>
                      <span>{item.messages.length}件のメッセージ</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "bookmarks" && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">
                ブックマーク
              </h2>
              {bookmarks.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-6 h-6 text-gray-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </div>
                  <p className="text-gray-500">ブックマークがありません</p>
                </div>
              ) : (
                bookmarks.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))
              )}
            </div>
          )}
        </div>

        {/* Input Area - Only show on chat tab */}
        {activeTab === "chat" && (
          <div className="border-t border-gray-200 bg-white px-6 py-6 flex-shrink-0">
            <div className="relative max-w-4xl mx-auto">
              <div className="flex items-center space-x-4">
                <div className="flex-1 relative">
                  <textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="最近の内部定例で何決まったっけ？"
                    className="w-full px-5 py-4 pr-14 border border-gray-300 rounded-lg focus:ring-1 focus:ring-gray-400 focus:border-gray-400 outline-none text-base resize-none bg-white transition-all placeholder-gray-500 hover:border-gray-400"
                    disabled={isSearching}
                    rows={1}
                    style={{ minHeight: "52px", maxHeight: "120px" }}
                  />
                  <div className="absolute right-4 bottom-4 flex items-center space-x-2">
                    <div className="text-xs text-gray-400">
                      {query.length > 0 && `${query.length}文字`}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={isSearching || !query.trim()}
                  className="w-12 h-12 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors flex items-center justify-center"
                >
                  {isSearching ? (
                    <svg
                      className="w-4 h-4 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
