import React from "react";
import { X } from "lucide-react";
import { useRestTimer } from "./RestTimerProvider";

export default function RestTimerOverlay() {
  const { restRemaining, cancelRest } = useRestTimer();

  if (restRemaining === null) return null;

  return (
    <div className="rest-timer-overlay">
      <div className="rest-timer-overlay-content">
        <span className="rest-timer-overlay-label">Descanso</span>
        <div
          className="rest-countdown"
          role="timer"
          aria-live="off"
          aria-label={`${restRemaining} segundos de descanso`}
        >
          <span className="rest-countdown-number">{restRemaining}</span>
          <span className="rest-countdown-unit">s</span>
        </div>
        <button
          type="button"
          className="rest-cancel-button"
          onClick={cancelRest}
          aria-label="Cancelar descanso"
          title="Cancelar descanso"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
