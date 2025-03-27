import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import "./ChatWindow.css";

function ChatWindow({ backendURL, contextText }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    // Dodajemy kontekst jako pierwszą wiadomość przy pierwszym renderze
    useEffect(() => {
        if (contextText && messages.length === 0) {
            const initialMsg = { id: "initial-context", sender: "context", text: contextText };
            setMessages([initialMsg]);
        }
    }, [contextText, messages.length]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;
        const userMessage = { id: Date.now(), sender: "user", text: input };
        setMessages((prev) => [...prev, userMessage]);
        const currentInput = input;
        setInput("");
        setIsLoading(true);
        try {
            const payload = { text: currentInput, context: contextText || "" };
            console.log("Wysyłany kontekst:", contextText ? contextText.substring(0, 100) + "..." : "brak");
            const res = await axios.post(`${backendURL}/chat`, payload, {
                headers: { "Content-Type": "application/json" },
            });
            const reply = res.data.reply;
            setMessages((prev) => [
                ...prev,
                { id: Date.now() + 1, sender: "chatgpt", text: reply },
            ]);
        } catch (error) {
            setMessages((prev) => [
                ...prev,
                { id: Date.now() + 1, sender: "chatgpt", text: "Błąd przy komunikacji z ChatGPT" },
            ]);
            console.error("Błąd komunikacji z API:", error);
        }
        setIsLoading(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="chat-window">
            <div className="chat-messages">
                {messages.map((msg) => (
                    <div key={msg.id} className={`chat-message ${msg.sender}`}>
                        {msg.text}
                    </div>
                ))}
                {isLoading && <div className="chat-loading">Ładowanie...</div>}
                <div ref={messagesEndRef} />
            </div>
            <div className="chat-input">
        <textarea
            placeholder="Napisz wiadomość..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
        />
                <button onClick={handleSend} disabled={isLoading}>
                    {isLoading ? "..." : "Wyślij"}
                </button>
            </div>
        </div>
    );
}

export default ChatWindow;
