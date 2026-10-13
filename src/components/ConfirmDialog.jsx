import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import "./ConfirmDialog.css";

export default function ConfirmDialog({
  open,
  onClose,
  title,
  message,
  actions = [],
}) {
  const dialogRef = useRef(null);
  const previousActiveElement = useRef(null);

  useEffect(() => {
    if (open) {
      previousActiveElement.current = document.activeElement;
      document.body.style.overflow = "hidden";
      // Focus first focusable element
      setTimeout(() => {
        const focusable = dialogRef.current?.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        focusable?.focus();
      }, 0);
    } else {
      document.body.style.overflow = "";
      previousActiveElement.current?.focus?.();
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        const cancelAction = actions.find((a) => a.variant === "ghost" || a.label.toLowerCase().includes("cancel"));
        cancelAction?.onClick?.();
        onClose();
      }
      if (e.key === "Tab") {
        trapFocus(e);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, actions, onClose]);

  function trapFocus(e) {
    const focusable = dialogRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  if (!open) return null;

  return (
    <div className="confirm-dialog-overlay" onClick={onClose} role="presentation">
      <div
        className="confirm-dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-dialog-header">
          <h3 id="confirm-dialog-title">{title}</h3>
          <button
            className="confirm-dialog-close"
            onClick={onClose}
            aria-label="Cerrar"
            type="button"
          >
            <X size={20} />
          </button>
        </div>
        <div className="confirm-dialog-body">
          <p>{message}</p>
        </div>
        <div className="confirm-dialog-footer">
          {actions.map((action, i) => {
            const variantClass = {
              success: "btn-success",
              danger: "btn-danger",
              warning: "btn-warning",
            }[action.variant] || "btn-primary";
            return (
              <button
                key={i}
                type="button"
                className={`btn ${variantClass}`}
                onClick={() => {
                  action.onClick?.();
                  onClose();
                }}
                disabled={action.disabled}
              >
                {action.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}