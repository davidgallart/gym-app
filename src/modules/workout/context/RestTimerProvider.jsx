import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { playRestEndBell } from "../lib/restTimerSound";

const RestTimerContext = createContext(null);

export function RestTimerProvider({ children }) {
  const [restRemaining, setRestRemaining] = useState(null);
  const restEndAtRef = useRef(null);
  const restTimerRef = useRef(null);

  const stopTimer = useCallback(() => {
    if (restTimerRef.current) {
      clearInterval(restTimerRef.current);
      restTimerRef.current = null;
    }
    restEndAtRef.current = null;
  }, []);

  const cancelRest = useCallback(() => {
    stopTimer();
    setRestRemaining(null);
  }, [stopTimer]);

  const startRest = useCallback(
    (durationSeconds) => {
      stopTimer();

      restEndAtRef.current = Date.now() + durationSeconds * 1000;
      setRestRemaining(durationSeconds);

      restTimerRef.current = window.setInterval(() => {
        const remaining = Math.max(0, Math.ceil((restEndAtRef.current - Date.now()) / 1000));

        if (remaining <= 0) {
          stopTimer();
          setRestRemaining(null);
          playRestEndBell();
          return;
        }

        setRestRemaining(remaining);
      }, 250);
    },
    [stopTimer]
  );

  useEffect(() => () => stopTimer(), [stopTimer]);

  const value = useMemo(
    () => ({ restRemaining, startRest, cancelRest }),
    [restRemaining, startRest, cancelRest]
  );

  return <RestTimerContext.Provider value={value}>{children}</RestTimerContext.Provider>;
}

export function useRestTimer() {
  const context = useContext(RestTimerContext);

  if (!context) {
    throw new Error("useRestTimer debe usarse dentro de RestTimerProvider");
  }

  return context;
}