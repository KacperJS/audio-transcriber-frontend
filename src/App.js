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
    const [outlineItems, setOutlineItems] = useState([]); // Nowy stan do przechowywania hierarchii
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

    // ... (pozostałe funkcje bez zmian)

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

            // Dodajemy nowy element do outline
            setOutlineItems(prevItems => [
                ...prevItems,
                {
                    id: Date.now(), // lub inna metoda generowania unikalnych id
                    content: `Transkrypcja z ${new Date().toLocaleString()}`,
                    children: [
                        { id: Date.now() + 1, content: result, children: [] }
                    ]
                }
            ]);
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
            const analysisResult = response.data.analysis;
            setAnalysis(analysisResult);

            // Dodajemy analizę jako dziecko do ostatniego elementu w outline
            setOutlineItems(prevItems => {
                if (prevItems.length > 0) {
                    const lastItem = { ...prevItems[prevItems.length - 1] };
                    lastItem.children.push({
                        id: Date.now(),
                        content: analysisResult,
                        children: []
                    });
                    return [...prevItems.slice(0, -1), lastItem];
                }
                return prevItems; // Jeśli nie ma elementów, nie dodajemy analizy
            });
        } catch (error) {
            console.error("❌ Błąd analizy transkrypcji:", error);
            alert("Wystąpił problem z analizą transkrypcji.");
        }
    };

    // Funkcja do renderowania zagnieżdżonych list
    const renderOutlineItem = (item) => (
        <li key={item.id} className="outline-item">
            <div className="item-content">
                {item.content}
            </div>
            {item.children && item.children.length > 0 && (
                <ul className="children-list">
                    {item.children.map(child => renderOutlineItem(child))}
                </ul>
            )}
        </li>
    );

    // Funkcja do dodawania nowych elementów do listy
    const addItem = (parentId = null) => {
        const newItem = { id: Date.now(), content: "Nowy element", children: [] };
        setOutlineItems(prevItems => {
            if (parentId === null) {
                // Dodajemy na poziomie głównym
                return [...prevItems, newItem];
            } else {
                // Dodajemy jako dziecko do określonego elementu
                return prevItems.map(item => {
                    if (item.id === parentId) {
                        return {
                            ...item,
                            children: [...item.children, newItem]
                        };
                    }
                    if (item.children) {
                        return {
                            ...item,
                            children: addItemToChildren(item.children, parentId, newItem)
                        };
                    }
                    return item;
                });
            }
        });
    };

    // Rekurencyjna funkcja do dodawania elementu do dzieci
    const addItemToChildren = (children, parentId, newItem) => {
        return children.map(child => {
            if (child.id === parentId) {
                return { ...child, children: [...child.children, newItem] };
            }
            if (child.children) {
                return {
                    ...child,
                    children: addItemToChildren(child.children, parentId, newItem)
                };
            }
            return child;
        });
    };

    // ... (pozostałe funkcje bez zmian)

    return (
        <>
            <div className="app-container">
                {/* ... istniejący kod interfejsu użytkownika */}
            </div>

            {transcription && (
                <div className="transcription-container">
                    <h3>📄 Transkrypcja</h3>
                    {/* ... istniejący kod transkrypcji */}
                    <button onClick={handleAnalyzeTranscription}>🤖 Analizuj transkrypcję</button>
                    <button onClick={() => addItem()}>➕ Dodaj nowy punkt</button>
                </div>
            )}

            {outlineItems.length > 0 && (
                <div className="outline-container">
                    <h3>📄 Hierarchia Notatek</h3>
                    <ul className="outline-list">{outlineItems.map(renderOutlineItem)}</ul>
                </div>
            )}

            {analysis && (
                <div className="analysis-container">
                    {/* ... istniejący kod analizy */}
                </div>
            )}
        </>
    );
};

export default App;