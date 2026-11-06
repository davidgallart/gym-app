import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App.jsx";
import ErrorBoundary from "./app/ErrorBoundary.jsx";
import { ToastProvider } from "./shared/components/ToastProvider.jsx";
import "./styles/global.css";
import "./styles/app/shell.css";
import "./styles/app/auth.css";
import "./styles/shared/layout.css";
import "./styles/shared/forms.css";
import "./styles/shared/feedback.css";
import "./styles/shared/charts.css";
import "./styles/shared/dialog.css";
import { registerServiceWorker } from "./app/registerServiceWorker";

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
