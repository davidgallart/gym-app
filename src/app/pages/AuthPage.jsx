import React from "react";
import { useState } from "react";
import { Dumbbell } from "lucide-react";
import { login, register } from "../services/authService";
import { useToast } from "../components/ToastProvider";

export default function AuthPage() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
        showToast("Sesión iniciada", "success");
      } else {
        await register(email, password);
        showToast("Cuenta creada. Si Supabase pide confirmación, revisa tu correo.", "success");
      }
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo"><Dumbbell size={30} /></div>
        <h1>{mode === "login" ? "Entrar" : "Crear cuenta"}</h1>
        <p>Guarda tus marcas de gimnasio y consulta tu progreso.</p>

        <form onSubmit={handleSubmit} className="form">
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>

          <label>
            Contraseña
            <input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>

          <button className="primary-button" disabled={loading}>
            {loading ? "Cargando..." : mode === "login" ? "Iniciar sesión" : "Registrarme"}
          </button>
        </form>


        <button className="link-button" onClick={() => setMode(mode === "login" ? "register" : "login")}> 
          {mode === "login" ? "No tengo cuenta" : "Ya tengo cuenta"}
        </button>
      </div>
    </div>
  );
}
