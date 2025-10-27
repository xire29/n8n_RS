import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { v4 as uuidv4 } from 'uuid'
import ReactMarkdown from 'react-markdown'

type ChatRole = 'user' | 'assistant'

interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  timestamp: number
}

const STORAGE_KEY = 'chat_messages_v1'

function loadMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.filter((m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
    }
    return []
  } catch {
    return []
  }
}

function saveMessages(messages: ChatMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
  } catch {}
}

async function sendToEndpoint(messageText: string, sessionId: string): Promise<string> {
  const res = await fetch('/api/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      message: messageText,
      'session-id': sessionId
    }),
  })
  const ct = res.headers.get('content-type') || ''
  if (!res.ok) {
    const errText = ct.includes('application/json') ? JSON.stringify(await res.json()).slice(0, 200) : await res.text()
    throw new Error(`Request failed (${res.status}): ${errText}`)
  }
  if (ct.includes('application/json')) {
    const data = await res.json()
    // Check for output, reply, message, or text keys
    let text = (data as any).output ?? (data as any).reply ?? (data as any).message ?? (data as any).text ?? ''
    // Convert escape sequences to actual characters
    text = text.replace(/\\n/g, '\n')
    return text || JSON.stringify(data)
  }
  return await res.text()
}

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setMessages(loadMessages())
    setSessionId(uuidv4())
  }, [])

  useEffect(() => {
    saveMessages(messages)
  }, [messages])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isSending])

  function makeId() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36)
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || isSending) return
    const userMsg: ChatMessage = { id: makeId(), role: 'user', content: text, timestamp: Date.now() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsSending(true)
    try {
      const replyText = await sendToEndpoint(text, sessionId)
      const botMsg: ChatMessage = {
        id: makeId(),
        role: 'assistant',
        content: String(replyText || '').slice(0, 4000),
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, botMsg])
    } catch (err: any) {
      const botMsg: ChatMessage = {
        id: makeId(),
        role: 'assistant',
        content: `Error: ${err?.message || 'Failed to fetch'}`,
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, botMsg])
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 flex flex-col">
      <header className="px-4 py-3 border-b border-neutral-800">
        <h1 className="text-lg font-semibold">Movie Recommender</h1>
      </header>
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto w-full px-4 py-6 space-y-3">
          {messages.length === 0 && (
            <div className="text-neutral-400 text-sm">Start the conversation below.</div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-neutral-800 text-neutral-200'} rounded-2xl px-4 py-2 max-w-[75%] break-words prose prose-invert prose-sm`}>
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="m-0 mb-2 last:mb-0">{children}</p>,
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                    em: ({ children }) => <em className="italic">{children}</em>,
                    ol: ({ children }) => <ol className="list-decimal list-inside m-0 mb-2 last:mb-0">{children}</ol>,
                    ul: ({ children }) => <ul className="list-disc list-inside m-0 mb-2 last:mb-0">{children}</ul>,
                    li: ({ children }) => <li className="ml-0">{children}</li>,
                    br: () => <br />,
                  }}
                >
                  {m.content}
                </ReactMarkdown>
              </div>
            </div>
          ))}
          {isSending && (
            <div className="flex justify-start">
              <div className="bg-neutral-800 text-neutral-300 rounded-2xl px-4 py-2">
                <span className="inline-flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neutral-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-neutral-500"></span>
                  </span>
                  Thinking…
                </span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </main>
      <form onSubmit={handleSend} className="border-t border-neutral-800 p-3">
        <div className="max-w-3xl mx-auto w-full flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 bg-neutral-900 text-neutral-100 placeholder-neutral-500 rounded-xl px-4 py-3 outline-none border border-neutral-800 focus:border-neutral-700"
            disabled={isSending}
          />
          <button
            type="submit"
            disabled={isSending || !input.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white rounded-xl px-4 py-3 font-medium"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}

export default App