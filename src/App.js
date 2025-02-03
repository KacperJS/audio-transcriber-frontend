import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useReactMediaRecorder } from "react-media-recorder";
import { jsPDF } from "jspdf";
import "./App.css";

const App = () => {
    // Ustawienie publicznego adresu backendu na Renderze
    const backendURL = "https://audio-transcriber-backend.onrender.com";

    const [audioFile, setAudioFile] = useState(null);
    const [transcription, setTranscription] = useState("");
    const [analysis, setAnalysis] = useState(""); // Stan dla analizy (ChatGPT)
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const intervalRef = useRef(null);

    const { startRecording, stopRecording, mediaBlobUrl, status } = useReactMediaRecorder({
        audio: true,
        mimeType: "audio/wav",
    });

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
            setRecordingTime((prevTime) => prevTime + 1);
        }, 1000);
    };

    const handleStopRecording = () => {
        setIsRecording(false);
        stopRecording();
        clearInterval(intervalRef.current);
    };

    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
    };

    const saveRecording = async () => {
        try {
            const response = await fetch(mediaBlobUrl);
            const blob = await response.blob();
            if (!blob || blob.size === 0) {
                console.error("❌ Błąd: Otrzymano pusty plik.");
                alert("Nagranie nie zostało poprawnie zapisane.");
                return;
            }
            const file = new File([blob], "recording.wav", { type: "audio/wav" });
            console.log("✅ Nagranie zakończone. Plik gotowy:", file);
            setAudioFile(file);
        } catch (error) {
            console.error("❌ Błąd zapisywania pliku:", error);
            alert("Wystąpił błąd podczas zapisywania nagrania.");
        }
    };

    const handleTranscribe = async () => {
        if (!audioFile) {
            alert("❌ Proszę nagrać lub przesłać plik audio!");
            return;
        }
        const formData = new FormData();
        formData.append("file", audioFile, audioFile.name);
        console.log("📤 Wysyłanie pliku do backendu:", audioFile);
        try {
            const response = await axios.post(`${backendURL}/transcribe`, formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            const result = response.data.text;
            setTranscription(typeof result === "object" ? JSON.stringify(result, null, 2) : result);
        } catch (error) {
            console.error("❌ Błąd transkrypcji:", error);
            alert("Wystąpił problem z transkrypcją pliku.");
        }
    };

    const handleAnalyzeTranscription = async () => {
        if (!transcription) {
            alert("❌ Brak transkrypcji do analizy!");
            return;
        }
        try {
            const response = await axios.post(`${backendURL}/analyze`, { text: transcription });
            setAnalysis(response.data.analysis);
        } catch (error) {
            console.error("❌ Błąd analizy transkrypcji:", error);
            alert("Wystąpił problem z analizą transkrypcji.");
        }
    };

    const handleDownloadPDF = () => {
        if (!transcription) return;
        const doc = new jsPDF();
        doc.setFont("helvetica");
        doc.setFontSize(14);
        doc.text(`Transkrypcja pliku: ${audioFile?.name || "recording.wav"}`, 10, 10);
        doc.text(transcription, 10, 20, { maxWidth: 180 });
        doc.save("transkrypcja.pdf");
    };

    // === NOWE: Funkcja do parsowania transkrypcji ===
    // Przyjmujemy, że transcription to ciąg znaków, np.:
    // SPEAKER_00: ...\nSPEAKER_01: ...
    // Dzielimy na linie, a potem każdą linię dzielimy na [speaker, text].
    const parseTranscription = (text) => {
        // Dzielimy po liniach
        const lines = text.split("\n").filter((line) => line.trim() !== "");

        // Mapujemy na obiekty { speaker, content }
        return lines.map((line) => {
            const indexOfColon = line.indexOf(":");
            if (indexOfColon !== -1) {
                const speaker = line.slice(0, indexOfColon).trim();
                const content = line.slice(indexOfColon + 1).trim();
                return { speaker, content };
            } else {
                // Linia nie zawiera dwukropka, zwracamy jako "inne"
                return { speaker: "UNKNOWN", content: line.trim() };
            }
        });
    };

    // Przygotowujemy listę segmentów
    let segments = [];
    if (transcription) {
        segments = parseTranscription(transcription);
    }

    return (
        <>
            <div className="app-container">
                <header className="header">🎙️ authentic.me</header>
                <p>Status nagrywania: <strong>{status}</strong></p>
                {isRecording && <p className="recording-time">⏳ Czas nagrania: {formatTime(recordingTime)}</p>}
                <div>
                    <button onClick={handleStartRecording} disabled={isRecording}>
                        🎤 Start Recording
                    </button>
                    <button onClick={handleStopRecording} disabled={!isRecording}>
                        🛑 Stop Recording
                    </button>
                </div>
                <div>
                    <label className="input-button">
                        Wybierz plik
                        <input
                            type="file"
                            accept="audio/*"
                            onChange={(e) => setAudioFile(e.target.files[0])}
                            className="hidden-input"
                        />
                        {audioFile && <span style={{ marginLeft: "10px" }}>✅</span>}
                    </label>
                </div>
                <button onClick={handleTranscribe}>📤 Wyślij i transkrybuj</button>
            </div>

            {transcription && (
                <div className="transcription-container">
                    <h3>📄 Transkrypcja</h3>
                    {/*
            Zamiast jednego <pre> z całym tekstem, rozbijamy na segmenty
          */}
                    <div className="transcription-segments">
                        {segments.map((seg, idx) => {
                            // Możesz zrobić np. warunek speaker === "SPEAKER_00" => klasa lewa, speaker === "SPEAKER_01" => klasa prawa
                            // Ale na razie zrobimy po prostu zwykły styl

                            // Przykład logiki stylu
                            const bubbleClass =
                                seg.speaker.includes("SPEAKER_00") ? "bubble-left" :
                                    seg.speaker.includes("SPEAKER_01") ? "bubble-right" : "bubble-other";

                            return (
                                <div key={idx} className={`segment-line ${bubbleClass}`}>
                                    <strong className="segment-speaker">{seg.speaker}:</strong>
                                    <span className="segment-content">{seg.content}</span>
                                </div>
                            );
                        })}
                    </div>

                    <button onClick={handleAnalyzeTranscription}>🤖 Analizuj transkrypcję</button>
                </div>
            )}

            {analysis && (
                <div className="analysis-container">
                    <div className="analysis-header">
                        <h3>📊 Analiza treści</h3>
                        <button onClick={handleDownloadPDF} className="download-button">📥 Pobierz PDF</button>
                    </div>
                    <pre className="analysis-text">{analysis}</pre>
                </div>
            )}
        </>
    );
};

export default App;
