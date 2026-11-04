"use client";
import {
  ButtonHTMLAttributes,
  ComponentProps,
  InputHTMLAttributes,
  ReactNode,
  Ref,
  useId,
  useState,
} from "react";
import { ArrowRight, Eye, EyeOff, Inbox } from "lucide-react";
import { statusLabel } from "../lib/api";
export function Button({
  children,
  secondary = false,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  secondary?: boolean;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      {...props}
      className={["button", secondary && "secondary", className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </button>
  );
}
export function Input({
  label,
  type,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  ref?: Ref<HTMLInputElement>;
}) {
  const generatedId = useId();
  const [visible, setVisible] = useState(false);
  const fieldId = id ?? generatedId;
  return (
    <div className="field">
      <label htmlFor={fieldId}>{label}</label>
      <div className={type === "password" ? "password-field" : "input-wrap"}>
        <input
          {...props}
          id={fieldId}
          type={type === "password" && visible ? "text" : type}
        />
        {type === "password" && (
          <button
            type="button"
            className="password-toggle"
            aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={visible}
            onClick={() => setVisible(!visible)}
          >
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
    </div>
  );
}
export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea {...props} />;
}
export function Select(props: ComponentProps<"select">) {
  return <select {...props} />;
}
export function Checkbox(props: Omit<ComponentProps<"input">, "type">) {
  return <input {...props} type="checkbox" />;
}
export function DataTable({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={["table-wrap", className].filter(Boolean).join(" ")}>
      <table aria-label={label}>{children}</table>
    </div>
  );
}
export function SectionHeader({
  title,
  action,
  ...props
}: Omit<ComponentProps<"div">, "title" | "children"> & {
  title: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div {...props}>
      <h2>{title}</h2>
      {action}
    </div>
  );
}
export function Badge({ status }: { status: string }) {
  return (
    <span className="badge" data-status={status}>
      <i aria-hidden="true" /> {statusLabel[status] ?? status}
    </span>
  );
}
export function EmptyState({
  title,
  children,
  icon,
  action,
}: {
  title: string;
  children: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        {icon ?? <Inbox size={30} strokeWidth={1} />}
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function PageHeader({
  title,
  children,
  action,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {children && <p className="muted">{children}</p>}
      </div>
      {action}
    </header>
  );
}
export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className ? `card ${className}` : "card"}>
      {children}
    </section>
  );
}
export function Skeleton() {
  return (
    <div className="skeleton" role="status">
      <span className="sr-only">Cargando tu espacio de trabajo…</span>
      <div className="skeleton-line" />
      <div className="skeleton-line" />
      <div className="skeleton-line" />
    </div>
  );
}
export function TextLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" className="text-link" onClick={onClick}>
      {children}
      <ArrowRight size={16} />
    </button>
  );
}
