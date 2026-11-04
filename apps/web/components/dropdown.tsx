"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export function Dropdown({
  label,
  icon,
  disabled = false,
  actions,
  className,
  triggerClassName,
  panelClassName,
}: {
  label: string;
  icon: ReactNode;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  panelClassName?: string;
  actions: readonly {
    label: string;
    icon?: ReactNode;
    onSelect: () => void | Promise<void>;
    disabled?: boolean;
  }[];
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div className={className} ref={root}>
      <button
        className={triggerClassName}
        ref={trigger}
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
      >
        {icon}
      </button>
      {open && (
        <div className={panelClassName} id={panelId}>
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              disabled={action.disabled}
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
                void action.onSelect();
              }}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
