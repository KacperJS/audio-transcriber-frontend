// DynalistView.js
import React, { useState, useRef, useEffect } from "react";
import "./Dynalist.css";

function DynalistView({ items, setItems }) {
    // Optional: do wyszukiwania, command palette itp.
    const [filter, setFilter] = useState("");
    const inputRefs = useRef({});

    // Dla uproszczenia, część logiki z Twojego "App.js" z Dynalist:
    // Poniżej jest minimalna wersja, która:
    //  - renderuje bullet-list
    //  - obsługuje wcięcia (Tab, Shift+Tab)
    //  - Enter tworzy nowy element

    // Sprawdza, czy element ma dzieci (czy kolejny item ma większy indent)
    const hasChildren = (index, localItems) => {
        if (index >= localItems.length - 1) return false;
        return localItems[index + 1].indent > localItems[index].indent;
    };

    // Czy item jest widoczny (rodzic nie jest złożony)?
    // -> Można pominąć w minimalnej wersji, albo dodać collapsed do items.
    const isItemVisible = (index, localItems) => {
        return true; // uproszczenie, by pominąć logikę collapsed
    };

    // Handler zmiany tekstu
    const handleChange = (e, index) => {
        const newText = e.target.value;
        const newItems = [...items];
        newItems[index].text = newText;
        setItems(newItems);
    };

    // Znajdujemy początek i koniec "grupy" (rodzic i potomkowie)
    const getGroupIndices = (index, localItems) => {
        let start = index;
        let end = index;
        const baseIndent = localItems[index].indent;
        for (let i = index + 1; i < localItems.length; i++) {
            if (localItems[i].indent > baseIndent) {
                end = i;
            } else {
                break;
            }
        }
        return [start, end];
    };

    // Kiedy naciśniesz Enter, stwórz nowy item pod spodem
    const handleKeyDown = (e, index, item) => {
        if (e.key === "Enter") {
            e.preventDefault();
            // Wstaw nowy item pod spodem
            const newId = Date.now();
            const newItem = { id: newId, text: "", indent: item.indent };
            const [start, end] = getGroupIndices(index, items);
            const insertionIndex = end + 1; // wstawiamy za grupą
            const newList = [...items];
            newList.splice(insertionIndex, 0, newItem);
            setItems(newList);

            // Skup się na nowym polu
            setTimeout(() => {
                if (inputRefs.current[newId]) {
                    inputRefs.current[newId].focus();
                }
            }, 0);
        } else if (e.key === "Tab") {
            e.preventDefault();
            // Shift+Tab => indent--
            if (e.shiftKey) {
                if (item.indent > 0) {
                    const newList = [...items];
                    newList[index].indent -= 1;
                    setItems(newList);
                }
            } else {
                // Tab => indent++
                const newList = [...items];
                newList[index].indent += 1;
                setItems(newList);
            }
        } else if (e.key === "Backspace" && item.text === "") {
            // Usuwanie pustego itemu
            e.preventDefault();
            if (items.length > 1) {
                const newList = items.filter((_, i) => i !== index);
                setItems(newList);
            }
        }
    };

    return (
        <div>
            {/* Pasek wyszukiwania (opcjonalny) */}
            <input
                type="text"
                placeholder="Szukaj..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                style={{
                    width: "100%",
                    marginBottom: 10,
                    padding: 8,
                    background: "#2a2a2a",
                    color: "white",
                    border: "1px solid #444",
                    borderRadius: 4,
                }}
            />

            <div className="bullet-list">
                {items.map((item, index) => {
                    // Filtr
                    const matchesFilter =
                        filter === "" || item.text.toLowerCase().includes(filter.toLowerCase());
                    const visible = isItemVisible(index, items) && matchesFilter;

                    return (
                        <div
                            key={item.id}
                            className="bullet-item"
                            style={{
                                marginLeft: item.indent * 20 + "px",
                                display: visible ? "flex" : "none",
                            }}
                        >
                            {/* Możesz wstawić tu np. strzałkę fold/unfold, jeżeli item ma dzieci */}
                            <span className="fold-toggle-placeholder"></span>

                            <input
                                type="text"
                                className="bullet-input"
                                value={item.text}
                                onChange={(e) => handleChange(e, index)}
                                onKeyDown={(e) => handleKeyDown(e, index, item)}
                                ref={(el) => (inputRefs.current[item.id] = el)}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default DynalistView;
