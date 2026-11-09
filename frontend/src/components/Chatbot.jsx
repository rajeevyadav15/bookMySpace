import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { trimForApi } from "../utils/chat";
import { buttonCls, inputCls } from "./styles";

const GREETING = {
  role: "assistant",
  content: "Hi! Ask me about movies, shows and seats. Hindi, English ya Hinglish, sab chalega.",
};

function friendlyError(err) {
  if (err.status === 429) return "Too many questions. Please try again later.";
  if (err.status === 503) return "The assistant is not available right now.";
  if (err.status === 502) return "The assistant is busy. Try again in a moment.";
  return err.message || "Something went wrong";
}

export default function Chatbot() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    if (open && endRef.current) endRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending, open]);

  // Fresh chat after logout, so the next user never sees old messages
  useEffect(() => {
    if (!user) {
      setMessages([GREETING]);
      setError("");
    }
  }, [user]);

  async function send(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setSending(true);
    setError("");

    try {
      const data = await api("/ai/chat", {
        method: "POST",
        body: { messages: trimForApi(next) },
      });
      setMessages((cur) => [...cur, { role: "assistant", content: data.reply }]);
    } catch (err) {
      // Remove the failed message and give the text back to the user
      setMessages(next.slice(0, -1));
      setInput(text);
      setError(friendlyError(err));
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-20 rounded-full bg-rose-600 px-5 py-3 font-medium text-white shadow-lg hover:bg-rose-500"
      >
        Ask AI
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-20 flex h-[28rem] w-[calc(100vw-2rem)] max-w-sm flex-col rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
        <h2 className="font-semibold">BookMySpace assistant</h2>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close chat"
          className="text-slate-400 hover:text-white"
        >
          ✕
        </button>
      </div>

      {!user ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-slate-300">Please login to chat with the assistant.</p>
          <Link to="/login" onClick={() => setOpen(false)} className={buttonCls}>
            Login
          </Link>
        </div>
      ) : (
        <>
          <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
                {/* Plain text only. AI output is never rendered as HTML */}
                <span
                  className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-left ${
                    m.role === "user" ? "bg-rose-600 text-white" : "bg-slate-800 text-slate-100"
                  }`}
                >
                  {m.content}
                </span>
              </div>
            ))}

            {sending && <p className="text-slate-400">Thinking...</p>}
            <div ref={endRef} />
          </div>

          {error && <p className="px-4 pb-2 text-xs text-red-300">{error}</p>}

          <form onSubmit={send} className="flex gap-2 border-t border-slate-700 p-3">
            <input
              className={inputCls}
              placeholder="Ask about movies or shows"
              value={input}
              maxLength={500}
              onChange={(e) => setInput(e.target.value)}
            />
            <button className={buttonCls} disabled={sending || !input.trim()}>
              Send
            </button>
          </form>
        </>
      )}
    </div>
  );
}