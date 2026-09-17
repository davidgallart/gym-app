import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Error de la app:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="center-screen setup-page">
          <div className="setup-card">
            <h1>Error al cargar la app</h1>
            <p>La app no ha podido arrancar. Abre la consola del navegador para ver el error completo.</p>
            <pre>{this.state.error.message}</pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
