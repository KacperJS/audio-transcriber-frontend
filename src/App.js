/***************************************************
 * App.js - Front-end React
 *  - Komunikuje się z backendURL
 *  - Audio Recorder + Dynalist z bullet-list parse
 ***************************************************/

import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useReactMediaRecorder } from "react-media-recorder";
import { jsPDF } from "jspdf";
import "./App.css";

// Adres BACKENDU - kluczowe!
const backendURL = "https://audio-transcriber-backend.onrender.com";

function App() {
    // ===== AUDIO STANY =====
    const [audioFile, setAudioFile] = useState(null);
    const [transcription, setTranscription] = useState("");
    const [analysis, setAnalysis] = useState("");
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const intervalRef = useRef(null);

    // react-media-recorder
    const { startRecording, stopRecording, mediaBlobUrl, status } =
        useReactMediaRecorder({ audio: true, mimeType: "audio/wav" });

    // Gdy skończy się nagrywanie, zapisz plik
    useEffect(() => {
        if (mediaBlobUrl) {
            saveRecording();
        }
    }, [mediaBlobUrl]);

    const handleStartRecording = () => {
        setIsRecording(true);
        setRecordingTime(0);
        startRecording();
        intervalRef.current = setInterval(() => {
            setRecordingTime((prev) => prev + 1);
        }, 1000);
    };

    const handleStopRecording = () => {
        setIsRecording(false);
        stopRecording();
        clearInterval(intervalRef.current);
    };

    const formatTime = (sec) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s < 10 ? "0" : ""}${s}`;
    };

    const saveRecording = async () => {
        try {
            const blob = await (await fetch(mediaBlobUrl)).blob();
            if (!blob || blob.size === 0) {
                alert("Błąd: pusty plik audio.");
                return;
            }
            const file = new File([blob], "recording.wav", { type: "audio/wav" });
            setAudioFile(file);
        } catch {
            alert("Błąd zapisu nagrania.");
        }
    };

    // ===== Wysyłanie do /transcribe =====
    const handleTranscribe = async () => {
        if (!audioFile) {
            alert("Najpierw nagraj lub wybierz plik audio!");
            return;
        }
        const formData = new FormData();
        formData.append("file", audioFile, audioFile.name);

        try {
            const res = await axios.post(`${backendURL}/transcribe`, formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            const text = res.data.text;
            setTranscription(text);
            // Dodaj do Dynalista: "Transkrypcja: ..."
            addItem(null, "Transkrypcja: " + text, 0);
        } catch {
            alert("Błąd transkrypcji");
        }
    };

    // ===== /analyze → ChatGPT bullet-list =====
    const handleAnalyze = async () => {
        if (!transcription) {
            alert("Brak transkrypcji do analizy!");
            return;
        }
        try {
            const res = await axios.post(`${backendURL}/analyze`, { text: transcription });
            const bulletList = res.data.analysis; // np. "- wniosek 1\n- wniosek 2\n"
            setAnalysis(bulletList);

            // Parsujemy bulletList w stylu:
            // "- Cos tam\n- Cos innego\n"
            // Każda linia => nowy węzeł (indent=1)
            const lines = bulletList.split("\n");
            lines.forEach(line => {
                const trimmed = line.trim();
                if (trimmed.startsWith("- ")) {
                    const content = trimmed.slice(2).trim(); // usuwamy '- '
                    // Wstaw jako nowy item w Dynaliście
                    addItem(null, content, 1);
                }
            });
        } catch {
            alert("Błąd analizy");
        }
    };

    // ===== Eksport PDF =====
    const handleDownloadPDF = () => {
        if (!transcription) return;
        const doc = new jsPDF();
        doc.setFont("helvetica");
        doc.setFontSize(14);
        doc.text(`Transkrypcja: ${audioFile?.name || "recording.wav"}`, 10, 10);
        doc.text(transcription, 10, 20, { maxWidth: 180 });
        doc.save("transkrypcja.pdf");
    };

    // ===== PARSOWANIE TRANSKRYPCJI => BĄBELKI
    function parseTranscription(text) {
        if (!text) return [];
        return text.split("\n").filter(l => l.trim() !== "").map(line => {
            const idx = line.indexOf(":");
            if (idx !== -1) {
                const speaker = line.slice(0, idx).trim();
                const content = line.slice(idx+1).trim();
                return { speaker, content };
            }
            return { speaker: "UNKNOWN", content: line.trim() };
        });
    }
    const segments = parseTranscription(transcription);

    // ===== DYNALIST STANY =====
    const [items, setItems] = useState([
        { id: 1, text: "Moje notatki startowe", indent: 0, collapsed: false }
    ]);
    const inputRefs = useRef({});

    // addItem(parentIndex=null => wstaw na końcu, text, indent)
    function addItem(parentIndex, text, indent) {
        const newId = Date.now();
        const newItem = { id: newId, text, indent, collapsed: false };
        setItems(prev => {
            if (parentIndex === null) {
                return [...prev, newItem];
            } else {
                const arr = [...prev];
                arr.splice(parentIndex + 1, 0, newItem);
                return arr;
            }
        });
    }

    function getGroupEnd(start) {
        const base = items[start].indent;
        let end = start;
        for (let i = start+1; i < items.length; i++) {
            if (items[i].indent > base) end = i;
            else break;
        }
        return end;
    }

    function handleKeyDown(e, index) {
        const item = items[index];
        if (e.key === "Enter") {
            e.preventDefault();
            const groupEnd = getGroupEnd(index);
            addItem(groupEnd, "", item.indent);
        } else if (e.key === "Tab") {
            e.preventDefault();
            if (e.shiftKey) {
                if (item.indent > 0) adjustIndent(index, -1);
            } else {
                adjustIndent(index, +1);
            }
        } else if (e.key === "Backspace" && item.text === "") {
            e.preventDefault();
            removeItem(index);
        }
    }

    function adjustIndent(index, delta) {
        setItems(prev => {
            const arr = [...prev];
            arr[index].indent += delta;
            if (arr[index].indent < 0) arr[index].indent = 0;
            return arr;
        });
    }

    function removeItem(index) {
        if (items.length === 1) return; // Nie usuwaj ostatniego
        setItems(prev => {
            const arr = [...prev];
            arr.splice(index, 1);
            return arr;
        });
    }

    function handleChangeItem(e, index) {
        const newText = e.target.value;
        setItems(prev => {
            const arr = [...prev];
            arr[index].text = newText;
            return arr;
        });
    }

    function toggleFold(index) {
        setItems(prev => {
            const arr = [...prev];
            arr[index].collapsed = !arr[index].collapsed;
            return arr;
        });
    }

    function isItemVisible(index) {
        let level = items[index].indent;
        for (let i = index-1; i >= 0; i--) {
            if (items[i].indent < level) {
                if (items[i].collapsed) return false;
                level = items[i].indent;
            }
        }
        return true;
    }

    function renderItem(item, index) {
        if (!isItemVisible(index)) return null;
        const end = getGroupEnd(index);
        const hasChildren = end > index;
        return (
            <div
                key={item.id}
                className="bullet-item"
                style={{ marginLeft: item.indent * 20 }}
            >
                {hasChildren ? (
                    <span className="fold-toggle" onClick={() => toggleFold(index)}>
            {item.collapsed ? "▶" : "▼"}
          </span>
                ) : (
                    <span className="fold-toggle-placeholder" />
                )}
                <input
                    type="text"
                    className="bullet-input"
                    value={item.text}
                    onChange={(e) => handleChangeItem(e, index)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    ref={(el) => (inputRefs.current[item.id] = el)}
                />
            </div>
        );
    }

    return (
        <div style={{ textAlign: "center", padding: 20 }}>
            <div className="app-container">
                <h2 className="header">🎙️ Audio + Dynalist + Bullets GPT</h2>
                <p>Status nagrywania: <strong>{status}</strong></p>
                {isRecording && (
                    <p style={{ fontWeight: "bold", color: "#ff4b5c" }}>
                        ⏳ {formatTime(recordingTime)}
                    </p>
                )}
                <div>
                    <button onClick={handleStartRecording} disabled={isRecording}>🎤 Start</button>
                    <button onClick={handleStopRecording} disabled={!isRecording}>🛑 Stop</button>
                </div>
                <div>
                    <label className="input-button">
                        Wybierz plik
                        <input
                            type="file"
                            accept="audio/*"
                            className="hidden-input"
                            onChange={(e) => setAudioFile(e.target.files[0])}
                        />
                        {audioFile && <span style={{ marginLeft: 10 }}>✅</span>}
                    </label>
                </div>
                <button onClick={handleTranscribe}>📤 Transkrybuj</button>
            </div>

            {transcription && (
                <div className="transcription-container">
                    <h3>Transkrypcja</h3>
                    <div className="transcription-segments">
                        {segments.map((seg, i) => {
                            const cl =
                                seg.speaker.includes("SPEAKER_00") ? "bubble-left" :
                                    seg.speaker.includes("SPEAKER_01") ? "bubble-right" :
                                        "bubble-other";
                            return (
                                <div key={i} className={`segment-line ${cl}`}>
                                    <strong className="segment-speaker">{seg.speaker}:</strong>
                                    <span className="segment-content">{seg.content}</span>
                                </div>
                            );
                        })}
                    </div>
                    <button onClick={handleAnalyze}>🤖 Analiza</button>
                    <button onClick={handleDownloadPDF}>📥 PDF</button>
                </div>
            )}

            {analysis && (
                <div className="analysis-container">
                    <h3>Analiza (surowy text)</h3>
                    <pre className="analysis-text">{analysis}</pre>
                </div>
            )}

            <div className="app-container" style={{ marginTop: 20 }}>
                <h2>Dynalist Notatki</h2>
                <p>
                    <em>Skróty:</em> Enter (nowy), Tab/Shift+Tab (wcięcie), Backspace pusty (usuń), ▶/▼ (fold/unfold)
                </p>
                <div className="bullet-list">
                    {items.map((item, idx) => renderItem(item, idx))}
                </div>
            </div>
        </div>
    );
}

export default App;
