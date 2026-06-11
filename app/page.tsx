"use client";

import type React from "react";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Bot, User, Copy, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
}

const WELCOME_MESSAGE: Message = {
  id: "1",
  content: "Hey! I'm Waleed, your AI friend. How can I help you today?",
  role: "assistant",
  timestamp: new Date(),
};

// How fast the assistant's reply is "typed" out, in characters per tick.
const TYPE_CHARS_PER_TICK = 2;
const TYPE_TICK_MS = 25;

export default function ChatSystem() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const adjustTextareaHeight = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);

  const sendMessage = async () => {
    if (!input.trim() || isTyping || isStreaming) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input.trim(),
      role: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    const aiMessageId = (Date.now() + 1).toString();
    let messageCreated = false;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: aiMessageId,
          content: "",
          role: "assistant",
          timestamp: new Date(),
        },
      ]);
      messageCreated = true;
      setIsTyping(false);
      setIsStreaming(true);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let fullText = "";
      let displayedLength = 0;
      let readerDone = false;

      const readChunks = (async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            readerDone = true;
            break;
          }
          fullText += decoder.decode(value, { stream: true });
        }
      })();

      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          if (displayedLength < fullText.length) {
            displayedLength = Math.min(
              displayedLength + TYPE_CHARS_PER_TICK,
              fullText.length
            );
            const visibleText = fullText.slice(0, displayedLength);
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === aiMessageId
                  ? { ...msg, content: visibleText }
                  : msg
              )
            );
          } else if (readerDone) {
            clearInterval(interval);
            resolve();
          }
        }, TYPE_TICK_MS);
      });

      await readChunks;
    } catch (error) {
      console.error("Error:", error);
      const errorContent = `Sorry, I encountered an error: ${
        error instanceof Error ? error.message : "Unknown error"
      }. Please try again.`;

      if (messageCreated) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId ? { ...msg, content: errorContent } : msg
          )
        );
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: aiMessageId,
            content: errorContent,
            role: "assistant",
            timestamp: new Date(),
          },
        ]);
      }
    } finally {
      setIsTyping(false);
      setIsStreaming(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMessage();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({
      description: "Message copied to clipboard",
    });
  };

  const clearChat = () => {
    setMessages([{ ...WELCOME_MESSAGE, timestamp: new Date() }]);
  };

  const isBusy = isTyping || isStreaming;

  return (
    <div className="flex h-dvh flex-col bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-3 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 shadow-md shadow-emerald-950/50 sm:h-10 sm:w-10">
              <Bot className="h-5 w-5 text-white" />
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-zinc-950 bg-emerald-400" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold leading-tight text-zinc-50 sm:text-lg">
                Waleed
              </h1>
              <p className="hidden truncate text-xs text-zinc-400 sm:block">
                Your AI friend, here to help
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={clearChat}
            className="shrink-0 gap-2 border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline">Clear chat</span>
          </Button>
        </div>
      </header>

      {/* Chat Messages */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full" ref={scrollAreaRef}>
          <div className="mx-auto max-w-3xl space-y-5 px-3 py-4 sm:space-y-6 sm:px-6 sm:py-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start gap-2 sm:gap-3 ${
                  message.role === "user" ? "flex-row-reverse" : ""
                }`}
              >
                <Avatar className="h-7 w-7 shrink-0 sm:h-8 sm:w-8">
                  <AvatarFallback
                    className={
                      message.role === "user"
                        ? "bg-zinc-700 text-zinc-200"
                        : "bg-gradient-to-br from-emerald-400 to-teal-600 text-white"
                    }
                  >
                    {message.role === "user" ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </AvatarFallback>
                </Avatar>

                <div
                  className={`flex min-w-0 flex-1 flex-col ${
                    message.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`group max-w-[88%] rounded-2xl px-4 py-3 sm:max-w-[80%] ${
                      message.role === "user"
                        ? "rounded-tr-sm bg-emerald-600 text-white"
                        : "rounded-tl-sm bg-zinc-900 text-zinc-100 ring-1 ring-zinc-800"
                    }`}
                  >
                    <div className="whitespace-pre-wrap break-words text-sm leading-relaxed sm:text-[15px]">
                      {message.content}
                      {isStreaming &&
                        message.role === "assistant" &&
                        message.id === messages[messages.length - 1]?.id && (
                          <span className="ml-0.5 inline-block h-4 w-[2px] -translate-y-0.5 animate-pulse bg-emerald-400 align-middle" />
                        )}
                    </div>
                    <div
                      className={`mt-2 flex items-center justify-between gap-3 border-t pt-1.5 ${
                        message.role === "user"
                          ? "border-emerald-500/40"
                          : "border-zinc-800"
                      }`}
                    >
                      <span
                        className={`text-[11px] ${
                          message.role === "user"
                            ? "text-emerald-100/80"
                            : "text-zinc-500"
                        }`}
                      >
                        {message.timestamp.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyMessage(message.content)}
                        className={`h-6 w-6 p-0 opacity-60 transition-opacity hover:opacity-100 ${
                          message.role === "user"
                            ? "text-emerald-100 hover:bg-emerald-700 hover:text-white"
                            : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                        }`}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex items-start gap-2 sm:gap-3">
                <Avatar className="h-7 w-7 shrink-0 sm:h-8 sm:w-8">
                  <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-teal-600">
                    <Bot className="h-4 w-4 text-white" />
                  </AvatarFallback>
                </Avatar>
                <div className="rounded-2xl rounded-tl-sm bg-zinc-900 px-4 py-3 ring-1 ring-zinc-800">
                  <div className="flex space-x-1">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-zinc-500" />
                    <div
                      className="h-2 w-2 animate-bounce rounded-full bg-zinc-500"
                      style={{ animationDelay: "0.1s" }}
                    />
                    <div
                      className="h-2 w-2 animate-bounce rounded-full bg-zinc-500"
                      style={{ animationDelay: "0.2s" }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Input Area */}
      <div className="border-t border-zinc-800 bg-zinc-950/80 px-3 py-3 backdrop-blur-md sm:px-6 sm:py-4">
        <div className="mx-auto max-w-3xl">
          <form onSubmit={handleSubmit} className="flex items-end gap-2 sm:gap-3">
            <div className="relative flex-1">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                rows={1}
                className="min-h-[44px] max-h-40 resize-none rounded-2xl border-zinc-700 bg-zinc-900 py-3 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-emerald-500/60 sm:text-[15px]"
                disabled={isBusy}
              />
            </div>
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isBusy}
              className="h-11 w-11 shrink-0 rounded-2xl bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <p className="mt-2 flex items-center justify-center gap-1 text-center text-[11px] text-zinc-500">
            <Sparkles className="h-3 w-3" />
            Enter to send, Shift+Enter for a new line
          </p>
        </div>
      </div>
    </div>
  );
}
