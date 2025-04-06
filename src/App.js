import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useReactMediaRecorder } from "react-media-recorder";
import { jsPDF } from "jspdf";
import "./App.css";

const backendURL = "https://audio-transcriber-backend.onrender.com";

function App() {
    // Audio, PDF, transkrypcja oraz globalny kontekst
    const [audioFile, setAudioFile] = useState(null);
    const [pdfFile, setPdfFile] = useState(null);
    const [transcription, setTranscription] = useState("");
    const [pdfContext, setPdfContext] = useState("");
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [isProcessingPdf, setIsProcessingPdf] = useState(false);
    const intervalRef = useRef(null);

    // Dodany nowy stan dla ładowania odpowiedzi GPT
    const [isLoadingGptResponse, setIsLoadingGptResponse] = useState(false);

    // Lista notatek – każdy element posiada id, text, indent oraz collapsed (nowe pole)
    const [items, setItems] = useState([
        { id: "1", text: "Przykładowe notatki startowe", indent: 0, collapsed: false }
    ]);
    const inputRefs = useRef({});

    // Stan modala do zapytań do ChatGPT (Ctrl + D) – przechowujemy wybrany element jako indeks
    const [selectedItemIndex, setSelectedItemIndex] = useState(null);
    const [gptModalOpen, setGptModalOpen] = useState(false);
    const [gptQuestion, setGptQuestion] = useState("");

    const { startRecording, stopRecording, mediaBlobUrl, status } =
        useReactMediaRecorder({ audio: true });

    // -------------------------------
    // FUNKCJE OBSŁUGUJĄCE EDYCJĘ
    // -------------------------------
    function handleChangeItem(e, index) {
        const newText = e.target.value;
        setItems(prev => {
            const arr = [...prev];
            arr[index].text = newText;
            return arr;
        });
    }

    function hasChildren(index) {
        if (index >= items.length - 1) return false;
        return items[index + 1].indent > items[index].indent;
    }

    function getCursorPosition(element) {
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(element);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        return preCaretRange.toString().length;
    }

    function isAtEndOfLine(element) {
        const cursorPos = getCursorPosition(element);
        const textLength = element.textContent.length;
        return cursorPos === textLength;
    }

    function handleKeyDown(e, index) {
        const item = items[index];
        const element = e.target;

        if (e.ctrlKey && e.key.toLowerCase() === "d") {
            e.preventDefault();
            openGPTModal(index);
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (isAtEndOfLine(element)) {
                // Dodaj element na tym samym poziomie wcięcia co bieżący
                addItem(index, "", item.indent);
            } else {
                // Dodaj na bieżącej pozycji kursora (jak dawniej)
                const cursorPos = getCursorPosition(element);
                const textBefore = item.text.substring(0, cursorPos);
                const textAfter = item.text.substring(cursorPos);

                // Aktualizuj bieżący element, by zawierał tylko tekst przed kursorem
                setItems(prev => {
                    const arr = [...prev];
                    arr[index].text = textBefore;
                    return arr;
                });

                // Dodaj nowy element z tekstem po kursorze
                addItem(index, textAfter, item.indent);

                // Focus na nowym elemencie
                setTimeout(() => {
                    const newItemElement = document.querySelectorAll('.bullet-input')[index + 1];
                    if (newItemElement) {
                        newItemElement.focus();
                        // Ustaw kursor na początku nowego elementu
                        const range = document.createRange();
                        const sel = window.getSelection();
                        range.setStart(newItemElement.childNodes[0] || newItemElement, 0);
                        range.collapse(true);
                        sel.removeAllRanges();
                        sel.addRange(range);
                    }
                }, 0);
            }
        } else if (e.key === "Tab") {
            e.preventDefault();
            if (e.shiftKey) adjustIndent(index, -1);
            else adjustIndent(index, 1);
        } else if (e.key === "Backspace" && item.text === "") {
            e.preventDefault();
            removeItem(index);
        }
    }

    const openGPTModal = (index) => {
        setSelectedItemIndex(index);
        setGptQuestion("");
        setGptModalOpen(true);
    };

    const closeGPTModal = () => {
        setGptModalOpen(false);
        setSelectedItemIndex(null);
        setIsLoadingGptResponse(false); // Resetujemy stan ładowania przy zamknięciu
    };

    function adjustIndent(index, delta) {
        setItems(prev => {
            const arr = [...prev];
            arr[index].indent += delta;
            if (arr[index].indent < 0) arr[index].indent = 0;
            return arr;
        });
    }

    function removeItem(index) {
        if (items.length === 1) return;
        setItems(prev => {
            const arr = [...prev];
            arr.splice(index, 1);
            return arr;
        });
    }

    // Funkcja przełączająca stan zwinięcia dla elementu
    function toggleCollapse(index) {
        setItems(prev => {
            const arr = [...prev];
            arr[index].collapsed = !arr[index].collapsed;
            return arr;
        });
    }

    // Funkcja znajdująca wszystkie dzieci danego elementu (do ukrycia przy zwinięciu)
    function getChildrenIndices(index) {
        const parentIndent = items[index].indent;
        const childrenIndices = [];

        for (let i = index + 1; i < items.length; i++) {
            if (items[i].indent <= parentIndent) break;
            childrenIndices.push(i);
        }

        return childrenIndices;
    }

    // Sprawdza czy dany element powinien być widoczny (nie jest potomkiem zwiniętego elementu)
    function isVisible(index) {
        for (let i = 0; i < index; i++) {
            if (items[i].collapsed && getChildrenIndices(i).includes(index)) {
                return false;
            }
        }
        return true;
    }

    // -------------------------------
    // FUNKCJE DODAWANIA I RENDEROWANIA
    // -------------------------------
    const generateUniqueKey = () =>
        `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

    // Dodawanie elementu – parentIndex === null oznacza dodanie na końcu, inaczej wstawiamy bezpośrednio pod danym indeksem
    function addItem(parentIndex, text, indent) {
        if (parentIndex !== null && text === undefined) return;
        const newId = generateUniqueKey();
        const newItem = { id: newId, text: text || "", indent, collapsed: false };
        setItems(prev => {
            if (parentIndex === null) return [...prev, newItem];
            const arr = [...prev];
            arr.splice(parentIndex + 1, 0, newItem);
            return arr;
        });
    }

    // Renderowanie elementu jako listy (<ul> z <li>)
    function renderItem(item, index) {
        // Sprawdź czy element powinien być widoczny
        if (!isVisible(index)) return null;

        const hasChildrenNodes = hasChildren(index);

        return (
            <li key={item.id} className="bullet-item" style={{ marginLeft: item.indent * 20 }}>
                <div className="bullet-wrapper">
                    {/* Dodanie ikony zwijania/rozwijania jeśli element ma dzieci */}
                    {hasChildrenNodes && (
                        <span
                            className={`collapse-icon ${item.collapsed ? 'collapsed' : 'expanded'}`}
                            onClick={() => toggleCollapse(index)}
                        >
                            {item.collapsed ? '►' : '▼'}
                        </span>
                    )}
                    <div
                        className="bullet-input"
                        contentEditable
                        suppressContentEditableWarning
                        onInput={(e) =>
                            handleChangeItem({ target: { value: e.currentTarget.textContent } }, index)
                        }
                        onKeyDown={(e) => handleKeyDown(e, index)}
                    >
                        {item.text}
                    </div>
                </div>
            </li>
        );
    }

    // -------------------------------
    // FUNKCJE OBSŁUGUJĄCE INNE ENDPOINTY
    // -------------------------------
    useEffect(() => {
        if (mediaBlobUrl) {
            saveRecording();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mediaBlobUrl]);

    const handleStartRecording = () => {
        setIsRecording(true);
        setRecordingTime(0);
        startRecording();
        intervalRef.current = setInterval(() => {
            setRecordingTime(prev => prev + 1);
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

    const handleTranscribe = async () => {
        if (!audioFile) {
            alert("Najpierw nagraj lub wybierz plik audio!");
            return;
        }
        setIsTranscribing(true);
        const formData = new FormData();
        formData.append("file", audioFile, audioFile.name);
        try {
            const res = await axios.post(`${backendURL}/transcribe`, formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            const text = res.data.text;
            setTranscription(text);
            addItem(null, `Transkrypcja: ${audioFile.name}`, 0);
            const segments = parseTranscriptionFunc(text);
            segments.forEach(segment => {
                const content = `${segment.speaker}: ${segment.content}`;
                if (content.trim() !== "") addItem(null, content, 1);
            });
            alert("Transkrypcja zakończona i dodana do notatek");
        } catch (error) {
            alert("Błąd transkrypcji");
            console.error("Błąd transkrypcji:", error);
        } finally {
            setIsTranscribing(false);
        }
    };

    const handleAnalyzePDF = async () => {
        if (!pdfFile) {
            alert("Najpierw wybierz plik PDF!");
            return;
        }
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
            setPdfContext(fullText);
            // Generujemy spis treści przez GPT
            const tocReply = await axios.post(
                `${backendURL}/chat`,
                {
                    text: "Podaj spis treści dokumentu PDF w formie listy. Każda linia zaczyna się od '- '.",
                    context: fullText.slice(0, 10000)
                },
                { headers: { "Content-Type": "application/json" } }
            );
            console.log("Spis treści wygenerowany przez GPT:", tocReply.data.reply);
            let tocLines = tocReply.data.reply.split("\n").map(line => line.trim());
            tocLines = tocLines.filter(line => line.startsWith("- ") && line.length > 2);
            if (tocLines.length === 0) {
                alert("Nie udało się wygenerować spisu treści z PDF.");
            } else {
                tocLines.forEach(line => {
                    const content = line.slice(2).trim();
                    if (content !== "") addItem(null, content, 0);
                });
                alert("PDF przetworzony. Spis treści został dodany do notatek.");
            }
        } catch (error) {
            console.error("Błąd analizy PDF:", error);
            alert("Błąd analizy PDF");
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

    const parseTranscriptionFunc = (text) => {
        if (!text) return [];
        return text.split("\n")
            .filter(l => l.trim() !== "")
            .map(line => {
                const idx = line.indexOf(":");
                if (idx !== -1) {
                    const speaker = line.slice(0, idx).trim();
                    const content = line.slice(idx + 1).trim();
                    return { speaker, content };
                }
                return { speaker: "UNKNOWN", content: line.trim() };
            });
    };

    // -------------------------------
    // FUNKCJA WYSYŁAJĄCA ZAPYTANIE DO CHATGPT
    // -------------------------------
    const handleGPTQuery = async () => {
        if (!gptQuestion.trim() || selectedItemIndex === null) return;

        // Ustawiamy flagę ładowania
        setIsLoadingGptResponse(true);

        const index = selectedItemIndex;
        const localNode = items[index].text;
        const parentNode = getParentText(index);
        const siblings = getSiblingsText(index);
        const globalContext = transcription || pdfContext || "";
        const payload = {
            text: gptQuestion,
            context: `Globalny kontekst: ${globalContext}\n\nAktualny punkt: ${localNode}\nRodzic: ${parentNode}\nSąsiedzi: ${siblings.join(
                ", "
            )}\n\nOdpowiedz proszę w formie listy, wypisując maksymalnie 2-3 najważniejsze punkty, każda linia zaczyna się od '- '.`
        };
        try {
            const res = await axios.post(`${backendURL}/chat`, payload, {
                headers: { "Content-Type": "application/json" },
            });
            const reply = res.data.reply;
            console.log("Odpowiedź z ChatGPT:", reply);
            let lines = reply.split("\n").map(line => line.trim());
            let listLines = lines.filter(line => line.startsWith("- ") && line.length > 2);
            if (listLines.length === 0) {
                listLines = lines.filter(line => line !== "");
            }

            // Process all response lines first
            const contentToAdd = [];
            listLines.forEach(line => {
                const content = line.startsWith("- ") ? line.slice(2).trim() : line;
                if (content !== "") {
                    contentToAdd.push({
                        text: content,
                        indent: items[index].indent + 1
                    });
                }
            });

            // Then add all content at once, in reverse order
            // Adding in reverse ensures each item is inserted right after the selected item
            for (let i = contentToAdd.length - 1; i >= 0; i--) {
                const { text, indent } = contentToAdd[i];
                // Always insert directly after the selected item
                const newItem = { id: generateUniqueKey(), text, indent, collapsed: false };
                setItems(prev => {
                    const arr = [...prev];
                    arr.splice(index + 1, 0, newItem);
                    return arr;
                });
            }

            alert("Odpowiedź GPT została dodana jako rozwinięcie wybranego punktu.");
        } catch (error) {
            alert("Błąd podczas komunikacji z ChatGPT");
            console.error("Błąd w handleGPTQuery:", error);
        } finally {
            setIsLoadingGptResponse(false);
            closeGPTModal();
        }
    };

    const getParentText = (index) => {
        for (let i = index - 1; i >= 0; i--) {
            if (items[i].indent < items[index].indent) return items[i].text;
        }
        return "Brak";
    };

    const getSiblingsText = (index) => {
        const currentIndent = items[index].indent;
        const siblings = [];
        for (let i = index - 1; i >= 0; i--) {
            if (items[i].indent === currentIndent) siblings.unshift(items[i].text);
            else if (items[i].indent < currentIndent) break;
        }
        for (let i = index + 1; i < items.length; i++) {
            if (items[i].indent === currentIndent) siblings.push(items[i].text);
            else if (items[i].indent < currentIndent) break;
        }
        return siblings.filter(text => text !== items[index].text);
    };

    // -------------------------------
    // RENDERING
    // -------------------------------
    return (
        <div className="app-layout">
            <div className="app-container">
                <h2 className="header">🎙️ Audio + Dynalist + Rabbit Hole</h2>
                <p>Status nagrywania: <strong>{status}</strong></p>
                {isRecording && (
                    <p style={{ fontWeight: "bold", color: "#ff4b5c" }}>
                        ⏳ {formatTime(recordingTime)}
                    </p>
                )}
                <div className="controls">
                    <button onClick={handleStartRecording} disabled={isRecording}>
                        🎤 Start
                    </button>
                    <button onClick={handleStopRecording} disabled={!isRecording}>
                        🛑 Stop
                    </button>
                    <label className="input-button">
                        Wybierz plik audio
                        <input
                            type="file"
                            accept="audio/*"
                            className="hidden-input"
                            onChange={(e) => setAudioFile(e.target.files[0])}
                        />
                        {audioFile && <span className="file-indicator">✅</span>}
                    </label>
                    <label className="input-button">
                        Wybierz plik PDF
                        <input
                            type="file"
                            accept="application/pdf"
                            className="hidden-input"
                            onChange={(e) => setPdfFile(e.target.files[0])}
                        />
                        {pdfFile && <span className="file-indicator">✅</span>}
                    </label>
                    <button onClick={handleTranscribe} disabled={isTranscribing}>
                        {isTranscribing ? (
                            <>Transkrybowanie... <div className="spinner"></div></>
                        ) : (
                            "📤 Transkrybuj"
                        )}
                    </button>
                    {pdfFile && (
                        <button onClick={handleAnalyzePDF} disabled={isProcessingPdf}>
                            {isProcessingPdf ? (
                                <>Przetwarzanie PDF... <div className="spinner"></div></>
                            ) : (
                                "📄 Przetwórz PDF"
                            )}
                        </button>
                    )}
                    <button onClick={handleDownloadPDF}>📥 PDF</button>
                </div>
            </div>
            <div className="app-container dynalist-container">
                <h2>Dynalist Notatki</h2>
                <p>
                    <em>
                        Skróty: Enter (nowy), Tab/Shift+Tab (wcięcie), Backspace pusty (usuń), Ctrl + D (zapytanie GPT)
                    </em>
                </p>
                <ul className="bullet-list">
                    {items.map((item, idx) => renderItem(item, idx))}
                </ul>
            </div>
            {gptModalOpen && (
                <div className="gpt-modal-overlay">
                    <div className="gpt-modal">
                        <h3>Zapytaj GPT</h3>
                        {isLoadingGptResponse ? (
                            <div className="gpt-modal-content">
                                <div className="spinner spinner-large"></div>
                                <div className="gpt-loading-message">
                                    Przetwarzanie zapytania...<br />
                                    Proszę czekać na odpowiedź.
                                </div>
                            </div>
                        ) : (
                            <>
                                <textarea
                                    value={gptQuestion}
                                    onChange={(e) => setGptQuestion(e.target.value)}
                                    placeholder="Wpisz zapytanie..."
                                    rows="4"
                                />
                                <div style={{ marginTop: 10, textAlign: "right" }}>
                                    <button onClick={closeGPTModal} style={{ marginRight: 10 }}>
                                        Anuluj
                                    </button>
                                    <button onClick={handleGPTQuery}>Wyślij</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;