import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import { ToastProvider } from "./components/ToastProvider.jsx";
import "./styles/global.css";
import { registerServiceWorker } from "./registerServiceWorker";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

registerServiceWorker();
