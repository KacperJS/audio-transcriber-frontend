import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useReactMediaRecorder } from "react-media-recorder";
import { jsPDF } from "jspdf";
import ChatWindow from "./ChatWindow";
import "./App.css";
import "./Dynalist.css";


// Ustawienie publicznego adresu backendu na Renderze
const backendURL = "https://audio-transcriber-backend.onrender.com";

function App() {
    // AUDIO RECORDER / PDF / TRANSKRYPCJA
    const [audioFile, setAudioFile] = useState(null);
    const [pdfFile, setPdfFile] = useState(null);
    const [transcription, setTranscription] = useState("");
    const [analysis, setAnalysis] = useState("");
    const [pdfContext, setPdfContext] = useState("");
    const [pdfSummary, setPdfSummary] = useState(""); // Stan dla podsumowania PDF
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [isProcessingPdf, setIsProcessingPdf] = useState(false);
    const intervalRef = useRef(null);

    // Dynalist – notatki (usunęliśmy mechanizm fold/unfold)
    const [items, setItems] = useState([
        { id: "1", text: "Przykładowe notatki startowe", indent: 0 }
    ]);
    const inputRefs = useRef({});

    const { startRecording, stopRecording, mediaBlobUrl, status } =
        useReactMediaRecorder({ audio: true });

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
        if (intervalRef.current) clearInterval(intervalRef.current);
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
                alert("Błąd: plik audio pusty.");
                return;
            }
            const file = new File([blob], "recording.wav", { type: "audio/wav" });
            console.log("Nagranie zapisane pomyślnie:", file);
            setAudioFile(file);
            alert("Nagranie zapisane pomyślnie");
        } catch (error) {
            alert("Błąd zapisu nagrania.");
        }
    };

    // Transkrypcja audio
    const handleTranscribe = async () => {
        if (!audioFile) {
            alert("Najpierw nagraj lub wybierz plik audio!");
            return;
        }
        setIsTranscribing(true);
        const formData = new FormData();
        formData.append("file", audioFile, audioFile.name);
        console.log("Wysyłanie pliku audio do backendu:", audioFile);
        try {
            const res = await axios.post(`${backendURL}/transcribe`, formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            const text = res.data.text;
            console.log("Otrzymana transkrypcja:", text);
            setTranscription(text);

            // Dodajemy nagłówek transkrypcji
            addItem(null, `Transkrypcja: ${audioFile.name}`, 0);

            // Dodajemy segmenty transkrypcji jako punkty
            const segments = parseTranscriptionFunc(text);
            segments.forEach(segment => {
                const content = `${segment.speaker}: ${segment.content}`;
                addItem(null, content, 1);
            });

            alert("Transkrypcja zakończona pomyślnie i dodana do notatek");
        } catch (error) {
            alert("Błąd transkrypcji");
            console.error("Błąd transkrypcji:", error);
        } finally {
            setIsTranscribing(false);
        }
    };

    // Analiza transkrypcji (ChatGPT)
    const handleAnalyze = async () => {
        if (!transcription) {
            alert("Brak transkrypcji do analizy!");
            return;
        }
        try {
            const res = await axios.post(`${backendURL}/analyze`, { text: transcription });
            const bulletList = res.data.analysis;
            console.log("Otrzymana analiza:", bulletList);
            setAnalysis(bulletList);
            const lines = bulletList.split("\n");
            lines.forEach(line => {
                const trimmed = line.trim();
                if (trimmed.startsWith("- ")) {
                    const content = trimmed.slice(2).trim();
                    addItem(null, content, 1);
                }
            });
            alert("Analiza transkrypcji zakończona");
        } catch (error) {
            alert("Błąd analizy");
            console.error("Błąd analizy:", error);
        }
    };

    // Analiza PDF – pobiera pełny tekst i generuje podsumowanie
    const handleAnalyzePDF = async () => {
        if (!pdfFile) {
            alert("Najpierw wybierz plik PDF!");
            return;
        }

        // Sprawdzenie rozmiaru pliku
        const fileSize = pdfFile.size / (1024 * 1024);
        if (fileSize > 10) {
            alert(`Uwaga: Plik ma ${fileSize.toFixed(2)} MB. Duże pliki mogą powodować problemy.`);
        }

        const formData = new FormData();
        formData.append("file", pdfFile, pdfFile.name);
        setIsProcessingPdf(true);

        try {
            const res = await axios.post(`${backendURL}/analyze-pdf`, formData, {
                headers: { "Content-Type": "multipart/form-data" },
                timeout: 180000,
                maxContentLength: 100 * 1024 * 1024,
                maxBodyLength: 100 * 1024 * 1024,
            });

            const fullText = res.data.text;
            console.log("Otrzymany pełny tekst PDF:", fullText.substring(0, 100) + "...");
            setPdfContext(fullText);

            const maxChunkSize = 10000;
            let summaryText = "";
            if (fullText.length > maxChunkSize) {
                summaryText = fullText.substring(0, maxChunkSize);
                alert(`Dokument jest bardzo długi. Analizuję tylko pierwsze ${maxChunkSize} znaków.`);
            } else {
                summaryText = fullText;
            }

            console.log("Generowanie podsumowania dokumentu...");
            const summaryRes = await axios.post(`${backendURL}/analyze`, {
                text: `Przeanalizuj i podsumuj najważniejsze punkty z poniższego dokumentu PDF:\n\n${summaryText}\n\nWypisz listę najważniejszych informacji, każda linia zaczyna się od "- ".`
            }, {
                timeout: 120000,
                maxContentLength: 50 * 1024 * 1024,
                maxBodyLength: 50 * 1024 * 1024,
            });

            const summaryBulletList = summaryRes.data.analysis;
            console.log("Otrzymane podsumowanie PDF:", summaryBulletList);
            setPdfSummary(summaryBulletList);

            const lines = summaryBulletList.split("\n");
            lines.forEach(line => {
                const trimmed = line.trim();
                if (trimmed.startsWith("- ")) {
                    const content = trimmed.slice(2).trim();
                    addItem(null, content, 0);
                }
            });

            alert("Analiza PDF zakończona pomyślnie");
        } catch (error) {
            console.error("Błąd analizy PDF:", error);
            if (error.message && error.message.includes("entity too large")) {
                alert("Błąd - Plik zbyt duży: Serwer nie może przetworzyć tak dużego pliku. Spróbuj mniejszego pliku PDF.");
            } else {
                alert("Błąd analizy PDF");
            }
        } finally {
            setIsProcessingPdf(false);
        }
    };

    const handleDownloadPDF = () => {
        if (!transcription) return;
        const doc = new jsPDF();
        doc.setFont("helvetica");
        doc.setFontSize(14);
        doc.text(`Transkrypcja: ${audioFile?.name || "recording.wav"}`, 10, 10);
        doc.text(transcription, 10, 20, { maxWidth: 180 });
        doc.save("transkrypcja.pdf");
        alert("PDF został pobrany");
    };

    // Funkcja do automatycznego dostosowania wysokości pola tekstowego
    const autoResize = (e) => {
        e.target.style.height = "auto";
        e.target.style.height = `${e.target.scrollHeight}px`;
    };

    // Parsowanie transkrypcji na segmenty
    const parseTranscriptionFunc = (text) => {
        if (!text) return [];
        return text
            .split("\n")
            .filter((l) => l.trim() !== "")
            .map((line) => {
                const idx = line.indexOf(":");
                if (idx !== -1) {
                    const speaker = line.slice(0, idx).trim();
                    const content = line.slice(idx + 1).trim();
                    return { speaker, content };
                }
                return { speaker: "UNKNOWN", content: line.trim() };
            });
    };

    const segments = parseTranscriptionFunc(transcription);

    const generateUniqueKey = () =>
        `${Date.now()}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;

    function addItem(parentIndex, text, indent) {
        const newId = generateUniqueKey();
        const newItem = { id: newId, text, indent };
        setItems((prev) => {
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
        for (let i = start + 1; i < items.length; i++) {
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
        setItems((prev) => {
            const arr = [...prev];
            arr[index].indent += delta;
            if (arr[index].indent < 0) arr[index].indent = 0;
            return arr;
        });
    }

    function removeItem(index) {
        if (items.length === 1) return;
        setItems((prev) => {
            const arr = [...prev];
            arr.splice(index, 1);
            return arr;
        });
    }

    function handleChangeItem(e, index) {
        const newText = e.target.value;
        setItems((prev) => {
            const arr = [...prev];
            arr[index].text = newText;
            return arr;
        });
    }

    // Funkcja renderująca bullet item – mechanizm fold/unfold został usunięty
    function renderItem(item, index) {
        return (
            <div key={item.id} className="bullet-item" style={{ marginLeft: item.indent * 20 }}>
        <textarea
            className="bullet-input"
            value={item.text}
            onChange={(e) => handleChangeItem(e, index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            onInput={autoResize}
            ref={(el) => (inputRefs.current[item.id] = el)}
            style={{ resize: "none", overflow: "hidden", whiteSpace: "pre-wrap", minHeight: "40px" }}
        />
                <button className="drill-down-btn" onClick={() => handleDrillDown(item, index)}>
                    💬
                </button>
            </div>
        );
    }

    const handleDrillDown = async (item, index) => {
        try {
            const prompt = `Rozwiń szczegółowo poniższy punkt:\n\n${item.text}\n\nWypisz w formie listy, każda linia zaczyna się od '- '`;
            const res = await axios.post(`${backendURL}/analyze`, { text: prompt });
            const bulletList = res.data.analysis;
            const lines = bulletList.split("\n");
            let lastItemIndex = index;
            lines.forEach(line => {
                const trimmed = line.trim();
                if (trimmed.startsWith("- ")) {
                    const content = trimmed.slice(2).trim();
                    addItem(lastItemIndex, content, item.indent + 1);
                    lastItemIndex++;
                }
            });
            alert("Rozwijanie punktu zakończone");
        } catch (error) {
            alert("Błąd przy analizie szczegółowej.");
            console.error(error);
        }
    };

    return (
        <div className="app-layout" style={{ display: "flex" }}>
            <div className="left-panel" style={{ flex: 1 }}>
                <div className="app-container">
                    <h2 className="header">🎙️ AI Audio Recorder & Transcriber</h2>
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
                            Wybierz plik audio
                            <input
                                type="file"
                                accept="audio/*"
                                className="hidden-input"
                                onChange={(e) => setAudioFile(e.target.files[0])}
                            />
                            {audioFile && <span style={{ marginLeft: 10 }}>✅</span>}
                        </label>
                    </div>
                    <div>
                        <label className="input-button">
                            Wybierz plik PDF
                            <input
                                type="file"
                                accept="application/pdf"
                                className="hidden-input"
                                onChange={(e) => setPdfFile(e.target.files[0])}
                            />
                            {pdfFile && <span style={{ marginLeft: 10 }}>✅</span>}
                        </label>
                    </div>
                    <button onClick={handleTranscribe} disabled={isTranscribing}>
                        {isTranscribing ? "Transkrybowanie..." : "📤 Transkrybuj"}
                    </button>
                    {pdfFile && (
                        <button onClick={handleAnalyzePDF} disabled={isProcessingPdf}>
                            {isProcessingPdf ? "Analizowanie PDF..." : "📄 Analiza PDF"}
                        </button>
                    )}
                </div>

                {transcription && (
                    <div className="transcription-container">
                        <h3>Transkrypcja</h3>
                        <div className="transcription-segments">
                            {segments.map((seg, i) => {
                                const cl =
                                    seg.speaker.includes("SPEAKER_00")
                                        ? "bubble-left"
                                        : seg.speaker.includes("SPEAKER_01")
                                            ? "bubble-right"
                                            : "bubble-other";
                                return (
                                    <div key={`${seg.speaker}-${i}`} className={`segment-line ${cl}`}>
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

                {pdfSummary && (
                    <div className="pdf-analysis-container">
                        <h3>Analiza PDF (najważniejsze punkty)</h3>
                        <pre className="pdf-analysis-text">{pdfSummary}</pre>
                    </div>
                )}

                <div className="app-container" style={{ marginTop: 20 }}>
                    <h2>Dynalist Notatki</h2>
                    <p>
                        <em>Skróty:</em> Enter (nowy), Tab/Shift+Tab (wcięcie), Backspace pusty (usuń)
                    </p>
                    <div className="bullet-list">
                        {items.map((item, idx) => renderItem(item, idx))}
                    </div>
                </div>
            </div>

            <div className="right-panel" style={{ flex: 0.4, marginLeft: 20 }}>
                <ChatWindow backendURL={backendURL} contextText={pdfContext || transcription || analysis} />
            </div>
        </div>
    );
}

export default App;
