import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Send, MoreHorizontal, Maximize2, Minimize2, Shuffle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type SoulMode = 'gentle' | 'pro' | 'sharp' | 'savage';
type TopicPreference = 'general' | 'emotion' | 'game' | 'coding' | 'medical' | 'elder' | 'kids';
type TonePreference = 'balanced' | 'warm' | 'direct' | 'professional';
type AudienceMode = 'general' | 'elder' | 'kids';

interface UserProfile {
  topicPreference: TopicPreference;
  tonePreference: TonePreference;
  audienceMode: AudienceMode;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  isStreaming?: boolean;
  isError?: boolean;
}

interface RouletteDragState {
  pointerId: number;
  startAngle: number;
  startRotation: number;
}

const SOUL_COOKIE = 'soul_mode';
const PROFILE_COOKIE = 'mini_pref';
const UNLOCK_COOKIE = 'terminal_unlock';
const DEFAULT_SOUL_MODE: SoulMode = 'savage';
const APP_VERSION = import.meta.env.VITE_APP_VERSION || '2.0.0';
const DISPLAY_VERSION = `v${APP_VERSION}`;
const MOBILE_BREAKPOINT_QUERY = '(max-width: 768px)';
const DEFAULT_PROFILE: UserProfile = {
  topicPreference: 'general',
  tonePreference: 'balanced',
  audienceMode: 'general'
};

const MOBILE_DIAL_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del'] as const;

const SOUL_OPTIONS: Array<{ value: SoulMode; label: string; className: string; color: string }> = [
  { value: 'gentle', label: 'GENTLE', className: 'soul-gentle', color: '#8dffd8' },
  { value: 'pro', label: 'PRO', className: 'soul-pro', color: '#93b9ff' },
  { value: 'sharp', label: 'SHARP', className: 'soul-sharp', color: '#ffe58a' },
  { value: 'savage', label: 'SAVAGE', className: 'soul-savage', color: '#ff9a9a' }
];

const normalizeSoulMode = (value: string): SoulMode => {
  const normalized = value.toLowerCase();
  const alias: Record<string, SoulMode> = {
    warm: 'gentle',
    professional: 'pro',
    toxic: 'savage',
    edgy: 'savage'
  };
  const mapped = alias[normalized] || normalized;
  if (mapped === 'gentle' || mapped === 'pro' || mapped === 'sharp' || mapped === 'savage') return mapped;
  return DEFAULT_SOUL_MODE;
};

const formatTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (_) {
    return '';
  }
};

const readCookie = (name: string) => {
  const encodedName = `${name}=`;
  const parts = document.cookie.split(';');
  for (const rawPart of parts) {
    const part = rawPart.trim();
    if (!part.startsWith(encodedName)) continue;
    return decodeURIComponent(part.slice(encodedName.length));
  }
  return '';
};

const writeCookie = (name: string, value: string, days = 180) => {
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
};

const parseProfileCookie = (): UserProfile => {
  try {
    const raw = readCookie(PROFILE_COOKIE);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    return {
      topicPreference: parsed.topicPreference || 'general',
      tonePreference: parsed.tonePreference || 'balanced',
      audienceMode: parsed.audienceMode || 'general'
    };
  } catch {
    return DEFAULT_PROFILE;
  }
};

const inferProfileFromText = (text: string, prev: UserProfile): UserProfile => {
  const normalized = text.toLowerCase();
  const next: UserProfile = { ...prev };

  if (/(情感|恋爱|关系|焦虑|倾诉|安慰|emotion|relationship|feeling)/i.test(normalized)) {
    next.topicPreference = 'emotion';
  } else if (/(游戏|攻略|通关|boss|steam|王者|lol|game|gaming)/i.test(normalized)) {
    next.topicPreference = 'game';
  } else if (/(代码|编程|开发|调试|bug|api|python|javascript|react|程序)/i.test(normalized)) {
    next.topicPreference = 'coding';
  } else if (/(医疗|医生|病|症状|用药|诊断|medical|health|treatment)/i.test(normalized)) {
    next.topicPreference = 'medical';
  } else if (/(老人|老年|长辈|退休|elder|senior)/i.test(normalized)) {
    next.topicPreference = 'elder';
  } else if (/(孩子|小朋友|儿童|宝宝|kid|child)/i.test(normalized)) {
    next.topicPreference = 'kids';
  }

  if (/(温柔|共情|安慰|鼓励|warm|empathetic)/i.test(normalized)) {
    next.tonePreference = 'warm';
  } else if (/(直接|简洁|简短|别废话|concise|direct)/i.test(normalized)) {
    next.tonePreference = 'direct';
  } else if (/(专业|严谨|正式|professional|formal)/i.test(normalized)) {
    next.tonePreference = 'professional';
  }

  if (/(老人|老年|长辈|爸妈|elder|senior)/i.test(normalized)) {
    next.audienceMode = 'elder';
  } else if (/(孩子|小朋友|儿童|kid|child)/i.test(normalized)) {
    next.audienceMode = 'kids';
  } else if (/(普通用户|通用|general)/i.test(normalized)) {
    next.audienceMode = 'general';
  }

  return next;
};

const extractText = (event: unknown): string => {
  if (!event || typeof event !== 'object') return '';
  const payload = event as Record<string, unknown>;

  if (typeof payload.output_text === 'string') return payload.output_text;

  const delta = payload.delta as Record<string, unknown> | undefined;
  if (delta && typeof delta.output_text === 'string') return delta.output_text;

  const content = payload.content;
  if (Array.isArray(content) && content[0] && typeof content[0] === 'object') {
    const first = content[0] as Record<string, unknown>;
    if (typeof first.text === 'string') return first.text;
  }

  const choices = payload.choices as unknown;
  if (Array.isArray(choices) && choices[0] && typeof choices[0] === 'object') {
    const choice = choices[0] as Record<string, unknown>;
    const choiceDelta = choice.delta as Record<string, unknown> | undefined;
    if (choiceDelta && typeof choiceDelta.content === 'string') return choiceDelta.content;
    if (choiceDelta && Array.isArray(choiceDelta.content) && choiceDelta.content[0]) {
      const first = choiceDelta.content[0] as Record<string, unknown>;
      if (typeof first.text === 'string') return first.text;
    }

    if (choice.message && typeof choice.message === 'object') {
      const message = choice.message as Record<string, unknown>;
      if (typeof message.content === 'string') return message.content;
      if (Array.isArray(message.content) && message.content[0]) {
        const first = message.content[0] as Record<string, unknown>;
        if (typeof first.text === 'string') return first.text;
      }
    }

    if (typeof choice.text === 'string') return choice.text;
  }

  return '';
};

const getClientTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

const isMobileViewport = () =>
  typeof window !== 'undefined' && window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches;

export function ChatInterface() {
  const [isUnlocked, setIsUnlocked] = useState(() => readCookie(UNLOCK_COOKIE) === '1');
  const [isMobileDevice, setIsMobileDevice] = useState(() => isMobileViewport());
  const [unlockInput, setUnlockInput] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isSoulRouletteOpen, setIsSoulRouletteOpen] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [isWheelDragging, setIsWheelDragging] = useState(false);
  const [isWheelSpinning, setIsWheelSpinning] = useState(false);
  const [soulMode, setSoulMode] = useState<SoulMode>(() => {
    const saved = readCookie(SOUL_COOKIE);
    return saved ? normalizeSoulMode(saved) : DEFAULT_SOUL_MODE;
  });
  const [userProfile, setUserProfile] = useState<UserProfile>(() => parseProfileCookie());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<Message[]>([]);
  const rouletteRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<RouletteDragState | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia(MOBILE_BREAKPOINT_QUERY);
    const onChange = () => setIsMobileDevice(media.matches);

    onChange();
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    }

    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    writeCookie(SOUL_COOKIE, soulMode, 365);
  }, [soulMode]);

  useEffect(() => {
    writeCookie(PROFILE_COOKIE, JSON.stringify(userProfile), 180);
  }, [userProfile]);

  const submitUnlock = useCallback(async (candidate: string) => {
    const password = candidate.trim();
    if (!password || isUnlocking) return;

    setUnlockError('');
    setIsUnlocking(true);

    try {
      const response = await fetch('/api/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      if (!response.ok) {
        throw new Error('Invalid passcode');
      }

      writeCookie(UNLOCK_COOKIE, '1', 30);
      setIsUnlocked(true);
      setUnlockInput('');
    } catch {
      setUnlockError('Wrong passcode');
    } finally {
      setIsUnlocking(false);
    }
  }, [isUnlocking]);

  const appendDialDigit = (digit: string) => {
    if (isUnlocking) return;
    if (digit === 'clear') {
      setUnlockInput('');
      setUnlockError('');
      return;
    }
    if (digit === 'del') {
      setUnlockInput((prev) => prev.slice(0, -1));
      setUnlockError('');
      return;
    }

    setUnlockInput((prev) => {
      if (prev.length >= 12) return prev;
      return `${prev}${digit}`;
    });
    setUnlockError('');
  };

  const scrollToBottom = useCallback((smooth = true) => {
    const behavior = smooth ? 'smooth' : 'auto';
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    scrollToBottom(messages.length > 1);
  }, [messages, scrollToBottom]);

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

  const resetChat = () => {
    setMessages([]);
    setInput('');
    setIsSending(false);
    queueMicrotask(() => textareaRef.current?.focus());
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;

    const now = new Date();
    const userMessage: Message = {
      id: `user-${now.getTime()}`,
      role: 'user',
      content: text,
      createdAt: now.toISOString()
    };

    const assistantMessage: Message = {
      id: `assistant-${now.getTime()}`,
      role: 'assistant',
      content: '',
      createdAt: new Date(now.getTime() + 1).toISOString(),
      isStreaming: true
    };

    const nextProfile = inferProfileFromText(text, userProfile);
    setUserProfile(nextProfile);

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput('');
    setIsSending(true);

    const history = [...messagesRef.current, userMessage]
      .filter((msg) => !msg.isError)
      .map((msg) => ({ role: msg.role, content: msg.content }));

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          history,
          soulMode,
          userProfile: nextProfile,
          clientTimeZone: getClientTimeZone(),
          locale: navigator.language || 'zh-CN'
        })
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(detail || `请求失败 (${response.status})`);
      }

      if (!response.body) {
        throw new Error('服务器没有返回内容');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let accumulated = '';
      let hasError = false;

      const updateAssistant = (next: Partial<Message>) => {
        setMessages((prev) => prev.map((msg) => (msg.id === assistantMessage.id ? { ...msg, ...next } : msg)));
      };

      const processPayload = (payload: string) => {
        if (!payload || payload === '[DONE]' || hasError) return;

        try {
          const event = JSON.parse(payload);
          if (event?.error) {
            const message = event.error?.message || event.error?.body || '请求失败';
            throw new Error(typeof message === 'string' ? message : '请求失败');
          }

          const delta = extractText(event);
          if (delta) {
            accumulated += delta;
            updateAssistant({ content: accumulated, isStreaming: true });
            scrollToBottom();
          }
        } catch (err) {
          hasError = true;
          const message = err instanceof Error ? err.message : '解析失败';
          updateAssistant({
            content: `[错误] ${message}`,
            isStreaming: false,
            isError: true
          });
        }
      };

      const flushBuffer = (force = false) => {
        let separatorIndex;
        while ((separatorIndex = buffer.indexOf('\n\n')) !== -1) {
          const rawEvent = buffer.slice(0, separatorIndex);
          buffer = buffer.slice(separatorIndex + 2);
          const lines = rawEvent.split(/\r?\n/);
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            processPayload(payload);
            if (hasError) return;
          }
        }

        if (force && buffer.trim()) {
          const remainder = buffer.trim();
          const lines = remainder.split(/\r?\n/);
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            processPayload(payload);
            if (hasError) return;
          }
          buffer = '';
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          flushBuffer(true);
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        flushBuffer();
      }

      if (!hasError) {
        updateAssistant({
          content: accumulated || '(无响应内容)',
          isStreaming: false
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '请求失败';
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessage.id
            ? {
                ...msg,
                content: `[错误] ${message}`,
                isStreaming: false,
                isError: true
              }
            : msg
        )
      );
    } finally {
      setIsSending(false);
      scrollToBottom();
      queueMicrotask(() => textareaRef.current?.focus());
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter') return;

    if (event.altKey) {
      event.preventDefault();
      const target = event.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const value = target.value;
      const insertion = '\n';
      target.value = `${value.slice(0, start)}${insertion}${value.slice(end)}`;
      const cursor = start + insertion.length;
      target.setSelectionRange(cursor, cursor);
      setInput(target.value);
      return;
    }

    if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const toggleFocusMode = useCallback(() => {
    if (!isMobileViewport()) return;
    setIsFocusMode((prev) => !prev);
  }, []);

  const handleDesktopUnlockSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitUnlock(unlockInput);
  };

  const getPointerAngle = (event: React.PointerEvent<HTMLDivElement>) => {
    const wheel = rouletteRef.current;
    if (!wheel) return 0;
    const rect = wheel.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(event.clientY - cy, event.clientX - cx) * (180 / Math.PI);
  };

  const toSoulIndexFromRotation = (rotation: number) => {
    const step = Math.round(-rotation / 90);
    return ((step % SOUL_OPTIONS.length) + SOUL_OPTIONS.length) % SOUL_OPTIONS.length;
  };

  const applySoulByRotation = useCallback((rotation: number) => {
    const index = toSoulIndexFromRotation(rotation);
    const selected = SOUL_OPTIONS[index];
    if (selected) setSoulMode(selected.value);
  }, []);

  const snapRotation = useCallback((rotation: number) => {
    const snapped = Math.round(rotation / 90) * 90;
    setWheelRotation(snapped);
    applySoulByRotation(snapped);
  }, [applySoulByRotation]);

  const openSoulRoulette = () => {
    setIsSoulRouletteOpen((prev) => !prev);
  };

  const handleWheelPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isWheelSpinning) return;
    event.preventDefault();
    const angle = getPointerAngle(event);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startAngle: angle,
      startRotation: wheelRotation
    };
    setIsWheelDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleWheelPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const angle = getPointerAngle(event);
    const delta = angle - drag.startAngle;
    setWheelRotation(drag.startRotation + delta);
  };

  const finishWheelDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragStateRef.current = null;
    setIsWheelDragging(false);
    snapRotation(wheelRotation);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const spinWheelRandomly = () => {
    if (isWheelSpinning) return;
    const targetIndex = Math.floor(Math.random() * SOUL_OPTIONS.length);
    const desiredNorm = ((-targetIndex * 90) % 360 + 360) % 360;
    const currentNorm = ((wheelRotation % 360) + 360) % 360;
    const baseSpin = 720 + Math.floor(Math.random() * 360);
    const alignDelta = (desiredNorm - ((currentNorm + baseSpin) % 360) + 360) % 360;
    const targetRotation = wheelRotation + baseSpin + alignDelta;

    setIsWheelSpinning(true);
    setWheelRotation(targetRotation);
    window.setTimeout(() => {
      setIsWheelSpinning(false);
      snapRotation(targetRotation);
    }, 900);
  };

  useEffect(() => {
    if (!isSoulRouletteOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSoulRouletteOpen(false);
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [isSoulRouletteOpen]);

  useEffect(() => {
    const index = SOUL_OPTIONS.findIndex((item) => item.value === soulMode);
    if (index >= 0) {
      setWheelRotation(-index * 90);
    }
  }, [soulMode]);

  const hasMessages = messages.length > 0;
  const unlockDots = Array.from({ length: Math.max(4, Math.min(8, unlockInput.length || 4)) });

  if (!isUnlocked) {
    return (
      <div className="retro-terminal lock-shell">
        <div className="lock-screen">
          {isMobileDevice ? (
            <div className="mobile-lock-panel">
              <div className="lock-title">SECURE TERMINAL</div>
              <div className="lock-subtitle">Enter passcode to continue</div>
              <div className="dial-dots" aria-label="Passcode dots">
                {unlockDots.map((_, idx) => (
                  <span key={`dot-${idx}`} className={`dial-dot${idx < unlockInput.length ? ' active' : ''}`} />
                ))}
              </div>
              <div className="dial-grid">
                {MOBILE_DIAL_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`dial-key${key === 'clear' || key === 'del' ? ' control' : ''}`}
                    onClick={() => appendDialDigit(key)}
                    disabled={isUnlocking}
                  >
                    {key === 'clear' ? 'CLR' : key === 'del' ? 'DEL' : key}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="dial-submit"
                onClick={() => void submitUnlock(unlockInput)}
                disabled={isUnlocking || unlockInput.length === 0}
              >
                {isUnlocking ? 'CHECKING...' : 'UNLOCK'}
              </button>
              {unlockError && <div className="lock-error">{unlockError}</div>}
            </div>
          ) : (
            <div className="desktop-lock-panel">
              <div className="lock-title">SYSTEM LOGIN</div>
              <div className="lock-subtitle">Keyboard input required</div>
              <form className="desktop-lock-form" onSubmit={handleDesktopUnlockSubmit}>
                <input
                  type="password"
                  className="desktop-pass-input"
                  autoFocus
                  value={unlockInput}
                  onChange={(event) => {
                    setUnlockInput(event.target.value);
                    setUnlockError('');
                  }}
                  placeholder="Passcode"
                  disabled={isUnlocking}
                />
                <button type="submit" className="desktop-unlock-button" disabled={isUnlocking || !unlockInput.trim()}>
                  {isUnlocking ? 'VERIFYING...' : 'UNLOCK'}
                </button>
              </form>
              {unlockError && <div className="lock-error">{unlockError}</div>}
            </div>
          )}
        </div>
        <div className="scanlines" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className={`retro-terminal soul-mode-${soulMode}${isFocusMode ? ' focus-mode' : ''}`}>
      {!isFocusMode && (
        <div className="terminal-header">
          <div className="terminal-title">
            <span className="terminal-symbol">&gt;</span>
            <span className="blinking-cursor">_</span>
            <span className="title-text">CHAT_SESSION.EXE</span>
          </div>
          <button
            type="button"
            className="terminal-controls terminal-controls-button"
            onClick={openSoulRoulette}
            aria-label="Open soul roulette"
          >
            <div className="control-dot" />
            <div className="control-dot" />
            <div className="control-dot" />
          </button>
        </div>
      )}

      <div className="chat-container">
        <div className="chat-messages">
          <button
            type="button"
            className="focus-toggle-button"
            onClick={toggleFocusMode}
            aria-label={isFocusMode ? 'Exit focus mode' : 'Enter focus mode'}
          >
            {isFocusMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          {!hasMessages && (
            <div className="welcome-message">
              <div className="ascii-art">
                ╔══════════════════════════════╗<br />
                ║&nbsp;&nbsp;RETRO CHAT SYSTEM - {DISPLAY_VERSION}&nbsp;&nbsp;║<br />
                ║&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;║<br />
                ╚══════════════════════════════╝
              </div>
            </div>
          )}

          {messages.map((message, index) => {
            const isUser = message.role === 'user';
            const showTyping = message.role === 'assistant' && message.isStreaming;

            return (
              <div
                key={message.id}
                className={`message ${isUser ? 'user-message' : 'ai-message'}${message.isError ? ' error-message' : ''}`}
              >
                <div className="message-header">
                  <span className="message-prefix">{isUser ? '[USER]' : '[SYSTEM]'}</span>
                  <span className="message-time">{formatTime(message.createdAt)}</span>
                </div>
                <div className="message-content">
                  <span className="prompt-symbol">&gt;</span>
                  {isUser ? (
                    <span>{message.content}</span>
                  ) : (
                    <div className="markdown-content">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
                {showTyping && index === messages.length - 1 && (
                  <div className="typing-indicator">
                    <MoreHorizontal size={16} className="typing-icon" />
                    <span>处理中...</span>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {!isFocusMode && (
          <div className="input-section">
            <div className="input-container">
              <div className="input-prompt">
                <span className="prompt-symbol">&gt;</span>
              </div>
              <textarea
                ref={textareaRef}
                value={input}
                placeholder="输入您的消息..."
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                className="chat-input"
                rows={1}
                disabled={isSending}
              />
            </div>
            <div className="button-group">
              <button
                type="button"
                onClick={() => void handleSend()}
                className="action-button send-button"
                disabled={!input.trim() || isSending}
              >
                <Send size={16} />
                <span>{hasMessages ? '继续对话' : '开始对话'}</span>
              </button>
              <button
                type="button"
                onClick={resetChat}
                className="action-button new-chat-button"
                disabled={messages.length === 0 && !input}
              >
                <Plus size={16} />
                <span>新对话</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {isSoulRouletteOpen && (
        <div className="soul-roulette-overlay" onClick={() => setIsSoulRouletteOpen(false)}>
          <div className="soul-roulette-panel" onClick={(event) => event.stopPropagation()}>
            <div className="roulette-indicator" />
            <div
              ref={rouletteRef}
              className={`soul-wheel${isWheelDragging ? ' dragging' : ''}${isWheelSpinning ? ' spinning' : ''}`}
              style={{
                transform: `rotate(${wheelRotation}deg)`,
                background: `conic-gradient(
                  ${SOUL_OPTIONS[0].color} 0deg 90deg,
                  ${SOUL_OPTIONS[1].color} 90deg 180deg,
                  ${SOUL_OPTIONS[2].color} 180deg 270deg,
                  ${SOUL_OPTIONS[3].color} 270deg 360deg
                )`
              }}
              onPointerDown={handleWheelPointerDown}
              onPointerMove={handleWheelPointerMove}
              onPointerUp={finishWheelDrag}
              onPointerCancel={finishWheelDrag}
            >
              {SOUL_OPTIONS.map((option, index) => (
                <div
                  key={option.value}
                  className={`soul-wheel-label ${option.className}`}
                  style={{
                    transform: `rotate(${index * 90}deg) translateY(-88px) rotate(${-index * 90}deg)`
                  }}
                >
                  {option.label}
                </div>
              ))}
              <button
                type="button"
                className="soul-wheel-center"
                onClick={spinWheelRandomly}
                aria-label="Randomize soul"
              >
                <Shuffle size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="scanlines" aria-hidden="true" />
    </div>
  );
}
