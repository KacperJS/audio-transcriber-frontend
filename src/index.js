import React from "react";
import ReactDOM from "react-dom/client"; // Używamy nowego importu dla React 18
import App from "./App";
import "./index.css";

const root = ReactDOM.createRoot(document.getElementById("root")); // Tworzymy nowy root
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
