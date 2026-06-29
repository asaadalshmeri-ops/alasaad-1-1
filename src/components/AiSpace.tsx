import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../utils/api.js';
import {
  Sparkles, Send, RefreshCw, Bot, User, Copy, Check, BookOpen, AlertCircle,
  Award, Terminal, HelpCircle, Cpu, Zap
} from 'lucide-react';

interface Message {
  role: 'user' | 'model';
  text: string;
}

interface AiSpaceProps {
  role: 'student' | 'admin';
  userName: string;
}

export default function AiSpace({ role, userName }: AiSpaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      text: `مرحباً بك يا **${userName}** في **LMS AI Space (سبيس ai)**! 🚀\n\nأنا مساعدك الذكي المدعوم بنموذج **Gemini 3.5**. يمكنك طرح أي أسئلة أكاديمية أو إدارية وسأقوم بمساعدتك فوراً بذكاء ودقة.\n\n*كيف يمكنني خدمتك اليوم؟*`
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const studentSuggestions = [
    { text: 'لخص لي أهم النصائح للاستعداد للامتحانات', icon: Award },
    { text: 'كيف أنظم وقتي بين المحاضرات والواجبات؟', icon: BookOpen },
    { text: 'اشرح لي بأسلوب مبسط أهمية المراقبة الذكية في الامتحانات', icon: Cpu },
    { text: 'اكتب لي رسالة تشجيعية لبدء المذاكرة بجد ونشاط', icon: Sparkles }
  ];

  const adminSuggestions = [
    { text: 'اقترح إعلاناً رسمياً لتعليق الدراسة بسبب الأحوال الجوية', icon: AlertCircle },
    { text: 'كيف أصيغ إشعاراً مهذباً للطلاب المتأخرين عن دفع الرسوم؟', icon: Terminal },
    { text: 'صمم لي 3 أسئلة اختيار من متعدد في مادة البرمجة الأساسية', icon: HelpCircle },
    { text: 'اقترح رداً نموذجياً على شكوى طالب بخصوص صعوبة اختبار', icon: Sparkles }
  ];

  const suggestions = role === 'student' ? studentSuggestions : adminSuggestions;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMessage: Message = { role: 'user', text: textToSend };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Build history excluding the very first model welcome greeting if we want, or send everything
      // Let's send the last 8 messages for context to keep it fast and responsive
      const historyContext = messages.slice(-8);

      const response = await apiRequest('/api/ai/chat', 'POST', {
        prompt: textToSend,
        history: historyContext
      });

      if (response && response.text) {
        setMessages(prev => [...prev, { role: 'model', text: response.text }]);
      } else {
        throw new Error('لم يتم استلام رد صالح من الخادم');
      }
    } catch (err: any) {
      console.error('Error sending message to AI:', err);
      setMessages(prev => [...prev, {
        role: 'model',
        text: `⚠️ **حدث خطأ أثناء الاتصال بالذكاء الاصطناعي:**\n\n${err.message || 'يرجى التحقق من إعدادات الاتصال بمفتاح Gemini API.'}`
      }]);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const clearChat = () => {
    setMessages([
      {
        role: 'model',
        text: `تم بدء جلسة جديدة بنجاح. مرحباً بك مجدداً يا **${userName}** في **LMS AI Space**! 🌟\n\nتفضل بطرح سؤالك الجديد.`
      }
    ]);
  };

  // Helper to render markdown-like text beautifully
  const renderMessageContent = (text: string) => {
    // Simple parser for bold (**text**) and bullet points (* point)
    const lines = text.split('\n');
    return lines.map((line, lIdx) => {
      let content: React.ReactNode = line;

      // Check if line is bullet point
      const isBullet = line.trim().startsWith('* ') || line.trim().startsWith('- ');
      if (isBullet) {
        line = line.replace(/^[\s*-]+/, '').trim();
      }

      // Check if line is numbered list e.g. "1. "
      const numMatch = line.match(/^(\d+)\.\s(.*)/);
      const isNumbered = !!numMatch;

      if (isNumbered && numMatch) {
        line = numMatch[2];
      }

      // Process bold tags
      const parts = line.split('**');
      if (parts.length > 1) {
        content = parts.map((part, pIdx) => {
          if (pIdx % 2 === 1) {
            return <strong key={pIdx} className="font-extrabold text-white bg-white/5 px-1 rounded">{part}</strong>;
          }
          return part;
        });
      }

      if (isBullet) {
        return (
          <div key={lIdx} className="flex items-start gap-2 my-1 mr-2">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 mt-2 shrink-0" />
            <span className="text-slate-200 text-xs sm:text-sm leading-relaxed">{content}</span>
          </div>
        );
      }

      if (isNumbered && numMatch) {
        return (
          <div key={lIdx} className="flex items-start gap-2 my-1 mr-2">
            <span className="text-xs font-bold text-indigo-400 font-mono mt-1 shrink-0">{numMatch[1]}.</span>
            <span className="text-slate-200 text-xs sm:text-sm leading-relaxed">{content}</span>
          </div>
        );
      }

      return (
        <p key={lIdx} className={`text-slate-200 text-xs sm:text-sm leading-relaxed my-1.5 min-h-[1.2em] ${line.trim() === '' ? 'h-2' : ''}`}>
          {content}
        </p>
      );
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-[#121c27] rounded-2xl border border-[#2d3e52] overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="bg-[#172534] border-b border-[#2d3e52] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/30 animate-pulse">
            <Sparkles className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              LMS AI Space <span className="bg-indigo-500/20 text-indigo-300 text-[9px] px-1.5 py-0.5 rounded-full font-normal">سبيس AI</span>
            </h2>
            <p className="text-[10px] text-[#8ea0b4]">مدعوم بـ Gemini 3.5 لتقديم الدعم والحلول الأكاديمية</p>
          </div>
        </div>

        <button
          onClick={clearChat}
          className="text-slate-400 hover:text-white hover:bg-white/5 px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
          title="بدء جلسة جديدة"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>جلسة جديدة</span>
        </button>
      </div>

      {/* Message body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0e1721] scrollbar-thin scrollbar-thumb-slate-700">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 max-w-[85%] ${
              msg.role === 'user' ? 'mr-auto flex-row-reverse' : 'ml-auto'
            }`}
          >
            {/* Avatar */}
            <div
              className={`h-8.5 w-8.5 rounded-xl flex items-center justify-center shrink-0 border ${
                msg.role === 'user'
                  ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              }`}
            >
              {msg.role === 'user' ? (
                <User className="h-4.5 w-4.5" />
              ) : (
                <Bot className="h-4.5 w-4.5" />
              )}
            </div>

            {/* Content bubble */}
            <div className="relative group">
              <div
                className={`p-3.5 rounded-2xl text-right transition-all ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-none'
                    : 'bg-[#172534] border border-[#2d3e52] rounded-tl-none'
                }`}
              >
                {msg.role === 'user' ? (
                  <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed text-indigo-50 font-medium">
                    {msg.text}
                  </p>
                ) : (
                  <div className="space-y-1 text-slate-100">
                    {renderMessageContent(msg.text)}
                  </div>
                )}
              </div>

              {/* Action utilities (e.g. copy) */}
              {msg.role === 'model' && (
                <button
                  onClick={() => copyToClipboard(msg.text, idx)}
                  className="absolute left-2 -bottom-6 opacity-0 group-hover:opacity-100 bg-[#1e2d3e] hover:bg-[#28394e] text-slate-300 hover:text-white px-2 py-1 rounded-md text-[10px] flex items-center gap-1 border border-slate-700 transition-all z-10"
                >
                  {copiedIndex === idx ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span className="text-emerald-400 font-bold">تم النسخ</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>نسخ</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 max-w-[80%] ml-auto">
            <div className="h-8.5 w-8.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <RefreshCw className="h-4 w-4 animate-spin" />
            </div>
            <div className="bg-[#172534] border border-[#2d3e52] p-4 rounded-2xl rounded-tl-none text-right flex items-center gap-2">
              <span className="text-xs text-slate-400 font-bold">جاري تفكير ومعالجة الرد الذكي...</span>
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" />
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Suggested prompts area */}
      {messages.length === 1 && (
        <div className="bg-[#0e1721] px-4 pb-2 pt-0.5 border-t border-slate-800/40">
          <p className="text-[10px] text-slate-400 font-bold mb-2 text-right flex items-center gap-1 justify-end">
            <Zap className="h-3 w-3 text-indigo-400" />
            <span>أسئلة ومقترحات سريعة للبدء:</span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {suggestions.map((s, idx) => {
              const SugIcon = s.icon;
              return (
                <button
                  key={idx}
                  onClick={() => handleSend(s.text)}
                  className="bg-[#172534]/50 hover:bg-[#1a2d40] border border-[#2d3e52]/40 hover:border-indigo-500/30 p-2.5 rounded-xl text-right text-xs text-slate-300 hover:text-white flex items-center gap-2.5 transition-all"
                >
                  <div className="h-6 w-6 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                    <SugIcon className="h-3.5 w-3.5 text-indigo-400" />
                  </div>
                  <span className="truncate">{s.text}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Input container */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(input);
        }}
        className="bg-[#172534] border-t border-[#2d3e52] p-3 flex gap-2 items-center"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          placeholder="اكتب سؤالك هنا أو اسأل الذكاء الاصطناعي عن أي شيء..."
          className="flex-1 bg-[#0e1721] border border-[#2d3e52] rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="bg-indigo-600 hover:bg-indigo-500 text-white p-2.5 rounded-xl transition-all disabled:opacity-50 disabled:hover:bg-indigo-600 shrink-0 flex items-center justify-center"
        >
          <Send className="h-4.5 w-4.5 transform rotate-180" />
        </button>
      </form>
    </div>
  );
}
