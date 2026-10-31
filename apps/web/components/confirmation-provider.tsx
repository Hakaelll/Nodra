"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { Button } from "./ui";

type Confirmation = {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
};
type Confirm = (options: Confirmation) => Promise<boolean>;
const ConfirmationContext = createContext<Confirm | null>(null);

export function useConfirm() {
  const confirm = useContext(ConfirmationContext);
  if (!confirm) throw new Error("ConfirmationProvider is required");
  return confirm;
}

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<Confirmation | null>(null);
  const resolver = useRef<((answer: boolean) => void) | null>(null);
  const request = useCallback<Confirm>((options) => new Promise((resolve) => {
    resolver.current?.(false);
    resolver.current = resolve;
    setActive(options);
  }), []);
  const finish = useCallback((answer: boolean) => {
    resolver.current?.(answer);
    resolver.current = null;
    setActive(null);
  }, []);
  useEffect(() => () => { resolver.current?.(false); }, []);
  return (
    <ConfirmationContext.Provider value={request}>
      {children}
      {active && <ConfirmationModal options={active} onAnswer={finish} />}
    </ConfirmationContext.Provider>
  );
}

function ConfirmationModal({
  options,
  onAnswer,
}: {
  options: Confirmation;
  onAnswer: (answer: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const current = dialog.current;
    current?.showModal();
    return () => {
      if (current?.open) current.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="confirm-dialog"
      aria-labelledby="action-confirm-title"
      aria-describedby="action-confirm-description"
      onCancel={(event) => { event.preventDefault(); onAnswer(false); }}
      onClick={(event) => { if (event.target === dialog.current) onAnswer(false); }}
    >
      <div className="confirm-dialog-body">
        <span className={`confirm-dialog-icon${options.destructive ? " is-danger" : ""}`}>
          <CircleAlert size={22} strokeWidth={1.7} />
        </span>
        <h2 id="action-confirm-title">{options.title}</h2>
        <p id="action-confirm-description">{options.description}</p>
        <div className="confirm-dialog-actions">
          <Button type="button" secondary onClick={() => onAnswer(false)}>Seguir aquí</Button>
          <Button type="button" className={options.destructive ? "destructive" : undefined} onClick={() => onAnswer(true)}>{options.confirmLabel}</Button>
        </div>
      </div>
    </dialog>
  );
}
