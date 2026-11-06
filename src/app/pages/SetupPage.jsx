import React from "react";
import { AlertTriangle } from "lucide-react";

export default function SetupPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo warning-logo"><AlertTriangle size={30} /></div>
        <h1>Falta configurar Supabase</h1>
        <p>
          La app se queda en blanco si no existe el archivo <strong>.env</strong> o si las claves de Supabase siguen con los valores de ejemplo.
        </p>

        <div className="setup-box">
          <p>Crea un archivo llamado <strong>.env</strong> en la raíz del proyecto:</p>
          <pre>{`VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_PUBLIC_KEY`}</pre>
        </div>

        <div className="setup-box">
          <p>Después reinicia Vite:</p>
          <pre>{`npm run dev`}</pre>
        </div>

        <p className="message">
          Las claves están en Supabase → Project Settings → API.
        </p>
      </div>
    </div>
  );
}
