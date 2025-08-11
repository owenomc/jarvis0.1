"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";

const JARVIS_WAKE = "jarvis"; // Accepts "jarvis" anywhere in phrase
const LLM_API_URL = "http://localhost:11434/api/generate";
const MAX_HISTORY_LENGTH = 50; // Limit conversation history

type Message = { role: "user" | "assistant"; content: string };

interface JarvisListenerProps {
  visualDescription: string;
  visualError?: string | null;
}

export default function JarvisListener({
  visualDescription,
  visualError,
}: JarvisListenerProps) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isListeningRef = useRef(false);
  const awaitingCommandRef = useRef(false);
  const lastWakeTimestampRef = useRef<number>(0);
  const voicesRef = useRef<SpeechSynthesisVoice[] | null>(null);
  const selectedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  const [status, setStatus] = useState("Initializing...");
  const [lastHeard, setLastHeard] = useState("");
  const [llmResponse, setLlmResponse] = useState("");
  const [history, setHistory] = useState<Message[]>([]);
  const [micError, setMicError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  // Load voices
  useEffect(() => {
    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
      if (voicesRef.current.length > 0) {
        selectedVoiceRef.current =
          voicesRef.current.find(
            (v) =>
              v.lang.startsWith("en") &&
              (v.name.toLowerCase().includes("google") ||
                v.name.toLowerCase().includes("samantha") ||
                v.name.toLowerCase().includes("microsoft"))
          ) || voicesRef.current[0];
      }
    };

    loadVoices();
    if ("onvoiceschanged" in speechSynthesis) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Start speech recognition
  const startRecognition = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setStatus("Speech Recognition API not supported in this browser.");
      setMicError("Speech recognition is not supported. Please use a compatible browser like Chrome.");
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.onresult = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
      setStatus("Listening for 'Hey Jarvis'...");
      isListeningRef.current = true;
      retryCountRef.current = 0; // Reset retry count
    };

    recognition.onend = () => {
      setIsListening(false);
      if (isListeningRef.current && retryCountRef.current < maxRetries) {
        setTimeout(() => {
          try {
            recognition.start();
            setIsListening(true);
            setStatus("Listening for 'Hey Jarvis'...");
          } catch (err) {
            retryCountRef.current += 1;
            setStatus(`Failed to restart recognition (attempt ${retryCountRef.current}/${maxRetries}).`);
            console.error("Recognition restart error:", err);
          }
        }, 500);
      } else {
        setStatus(retryCountRef.current >= maxRetries ? "Recognition stopped due to repeated failures." : "Stopped listening.");
      }
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      console.error("Speech recognition error:", event.error);
      if (["not-allowed", "service-not-allowed"].includes(event.error)) {
        setMicError("Microphone access denied. Please enable microphone permissions in your browser settings.");
        setStatus("Microphone access denied.");
      } else {
        setStatus(`Speech recognition error: ${event.error}`);
      }
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const transcript = event.results[i][0].transcript
            .trim()
            .toLowerCase();
          setLastHeard(transcript);

          if (!awaitingCommandRef.current && transcript.includes(JARVIS_WAKE)) {
            const now = Date.now();
            if (now - lastWakeTimestampRef.current < 2000) return;
            lastWakeTimestampRef.current = now;
            awaitingCommandRef.current = true;
            setStatus("Yes? Listening for your command...");
            speak("Ready for action.");
            setLlmResponse("");
            setIsThinking(false);
            return;
          }

          if (awaitingCommandRef.current) {
            if (
              transcript === JARVIS_WAKE ||
              transcript === `hey ${JARVIS_WAKE}`
            ) {
              speak("Yes?");
              return;
            }
            setStatus("Thinking...");
            setIsThinking(true);
            setLlmResponse("");

            if (transcript.includes("what do you see")) {
              const response = visualDescription || "I don't see anything yet.";
              setHistory((hist) => [
                ...hist.slice(-MAX_HISTORY_LENGTH + 1), // Trim history
                { role: "user", content: transcript },
                { role: "assistant", content: response },
              ]);
              speak(response);
              setStatus("Yes? Listening for your command...");
              setIsThinking(false);
              return;
            }

            const userMsg: Message = {
              role: "user",
              content: transcript.includes("see") || transcript.includes("look")
                ? `${transcript} (Visual: ${visualDescription})`
                : transcript, // Only include visual description for relevant queries
            };
            handleLLM([...history, userMsg], transcript);
            awaitingCommandRef.current = false;
          }
        }
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [visualDescription, history]);

  useEffect(() => {
    navigator.permissions
      ?.query({ name: "microphone" as PermissionName })
      .then((perm) => {
        if (perm.state === "denied") {
          setMicError("Microphone permission denied. Please enable microphone permissions in your browser settings and reload.");
          setStatus("Please enable microphone and reload.");
        } else {
          startRecognition();
        }
      })
      .catch(() => startRecognition());

    return () => {
      isListeningRef.current = false;
      recognitionRef.current?.stop();
    };
  }, [startRecognition]);

  // Speak function
  const speak = (text: string) => {
    if (!text.trim()) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1.15;
    utterance.pitch = 1.05;
    utterance.volume = 1.0;

    if (selectedVoiceRef.current) {
      utterance.voice = selectedVoiceRef.current;
    }

    window.speechSynthesis.speak(utterance);
  };

  // LLM streaming handler
  const handleLLM = async (newHistory: Message[], transcript: string) => {
    setLlmResponse("");
    setIsThinking(true);
    let fullResp = "";

    try {
      const systemPrompt = `You are JARVIS, Tony Stark's legendary AI assistant.
- Respond with wit, confidence, and dry humor when appropriate.
- Always be concise, direct, and highly efficient.
- Use visual data only when the user asks about the environment, objects, or people.
- If asked about someone's appearance or surroundings, use the provided visual description as if observing in real time.
- Do not greet unless prompted, and never call the user "Master".
- Do not explain yourself unless asked.
- Avoid filler like “As an AI” or “Of course”.
- If a question is ambiguous, make a clever guess or ask for clarification in a JARVIS-like manner.
- Stay professional, but don't be afraid to be a bit cheeky.`;

      const formattedHistory = newHistory
        .slice(-MAX_HISTORY_LENGTH) // Limit history
        .map((h) => `${h.role === "user" ? "User" : "Jarvis"}: ${h.content}`)
        .join("\n");

      const prompt = `${systemPrompt}\n\n${formattedHistory}\nJarvis:`;

      const res = await fetch(LLM_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama3",
          prompt,
          stream: true,
          options: {
            temperature: 0.3,
            top_p: 0.8,
            num_predict: 50,
            stop: ["User:", "Jarvis:"],
          },
        }),
      });

      if (!res.ok || !res.body) {
        const errorText = await res.text();
        console.error("LLM request failed:", errorText);
        setLlmResponse(`LLM error: ${errorText}`);
        setStatus("Yes? Listening...");
        speak("Something went wrong. Try again.");
        setIsThinking(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            const text = parsed.response || "";
            fullResp += text;
            setLlmResponse((prev) => prev + text);
          } catch (err) {
            console.error("JSON parse error in LLM stream:", err, "Line:", line);
          }
        }
      }

      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer);
          const text = parsed.response || "";
          fullResp += text;
          setLlmResponse((prev) => prev + text);
        } catch (err) {
          console.error("Final JSON parse error:", err, "Buffer:", buffer);
        }
      }

      if (fullResp.trim()) {
        setHistory((hist) => [
          ...hist.slice(-MAX_HISTORY_LENGTH + 1),
          { role: "user", content: transcript },
          { role: "assistant", content: fullResp },
        ]);
        setLlmResponse("");
        speak(fullResp);
      }

      setStatus("Listening for 'Jarvis'...");
      setIsThinking(false);
    } catch (error) {
      console.error("LLM network error:", error);
      setLlmResponse("Network error. Please check the LLM server.");
      setStatus("Listening for 'Jarvis'...");
      speak("Network issue. Let's try that again.");
      setIsThinking(false);
    }
  };

  return (
    <>
      {micError && (
        <div
          style={{
            position: "fixed",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#ff5555",
            color: "white",
            padding: 15,
            borderRadius: 10,
            zIndex: 10000,
            maxWidth: 400,
            textAlign: "center",
          }}
          role="alert"
          aria-live="assertive"
        >
          {micError}
        </div>
      )}
      {visualError && (
        <div
          style={{
            position: "fixed",
            top: 60,
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#f59e42",
            color: "#222",
            padding: 12,
            borderRadius: 10,
            zIndex: 10000,
            maxWidth: 400,
            textAlign: "center",
            fontWeight: "bold",
          }}
          role="alert"
          aria-live="assertive"
        >
          Visual Error: {visualError}
        </div>
      )}

      <div
        style={{
          backgroundColor: "#1e1e1e",
          borderRadius: 16,
          boxShadow: "0 0 20px rgba(255, 255, 255, 0.1)",
          padding: 20,
          maxWidth: 460,
          color: "white",
          fontFamily: "Segoe UI, Tahoma, sans-serif",
          userSelect: "none",
          display: "flex",
          flexDirection: "column",
          height: "520px",
        }}
        role="region"
        aria-label="Jarvis Voice Assistant"
      >
        <h2 style={{ color: "#a78bfa", margin: 0, marginBottom: 10 }}>
          Jarvis Voice Assistant
        </h2>

        <div style={{ fontSize: 14, color: "#ccc", marginBottom: 8 }}>
          Status: <b>{status}</b>
          {isListening && (
            <span
              style={{
                color: isThinking ? "#facc15" : "#4ade80",
                fontWeight: "bold",
                marginLeft: 8,
                animation: "pulse 1.5s infinite",
              }}
              aria-hidden="true"
            >
              {isThinking ? "● Thinking" : "● Listening"}
            </span>
          )}
        </div>

        <div
          style={{
            backgroundColor: "#2a2a2a",
            borderRadius: 10,
            padding: 12,
            flex: 1,
            overflowY: "auto",
            fontSize: 14,
            fontFamily: "monospace",
            whiteSpace: "pre-wrap",
            marginBottom: 10,
            lineHeight: "1.4em",
          }}
          role="log"
          aria-live="polite"
        >
          <div>
            <b>Last Heard:</b> {lastHeard || "(waiting...)"}
          </div>

          <hr style={{ margin: "10px 0", borderColor: "#444" }} />

          <div>
            <b>Conversation:</b>
            {history.length === 0 && (
              <div style={{ marginTop: 8 }}>Say "Hey Jarvis" to begin.</div>
            )}
            {history.map((m, i) => (
              <div
                key={i}
                style={{
                  color: m.role === "user" ? "#93c5fd" : "#d1d5db",
                  marginTop: 8,
                  fontWeight: m.role === "user" ? "bold" : "normal",
                }}
              >
                {m.role === "user" ? "You:" : "Jarvis:"} {m.content}
              </div>
            ))}
          </div>

          {llmResponse && (
            <div style={{ marginTop: 12, color: "#cbd5e1" }}>
              <b>Jarvis is typing:</b> {llmResponse}
            </div>
          )}
        </div>
      </div>
    </>
  );
}