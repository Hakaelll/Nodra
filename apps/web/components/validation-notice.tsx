"use client";

import { useTranslation } from "../lib/locale-provider";
import { useLocale } from "../lib/locale-provider";
import { defaultLocale, translate, type SupportedLocale } from "../lib/i18n";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CircleAlert } from "lucide-react";

type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function labelFor(control: FormControl) {
  return (
    control.getAttribute("aria-label") ||
    control.labels?.[0]?.textContent?.trim() ||
    control
      .closest(".field")
      ?.querySelector("label, span")
      ?.textContent?.trim() ||
    control.getAttribute("placeholder") ||
    "este campo"
  ).replace(/\s+/g, " ");
}

export function validationMessage(
  control: FormControl,
  locale: SupportedLocale = defaultLocale,
) {
  const sourceLabel = labelFor(control);
  const label =
    sourceLabel === "este campo" ? translate(locale, sourceLabel) : sourceLabel;
  const validity = control.validity;
  if (validity.valueMissing) return `Completa «${label}» para continuar.`;
  if (
    validity.typeMismatch &&
    control instanceof HTMLInputElement &&
    control.type === "email"
  )
    return "Escribe una dirección de correo válida.";
  if (validity.typeMismatch) return `Revisa el formato de «${label}».`;
  if (validity.tooShort && !(control instanceof HTMLSelectElement))
    return `«${label}» necesita al menos ${control.minLength} caracteres.`;
  if (validity.tooLong && !(control instanceof HTMLSelectElement))
    return `«${label}» admite hasta ${control.maxLength} caracteres.`;
  if (validity.rangeUnderflow)
    return `«${label}» debe ser mayor o igual que ${control.getAttribute("min")}.`;
  if (validity.rangeOverflow)
    return `«${label}» debe ser menor o igual que ${control.getAttribute("max")}.`;
  return `Revisa «${label}» antes de continuar.`;
}

export function ValidationNotice() {
  const t = useTranslation();
  const { locale } = useLocale();

  const [message, setMessage] = useState("");
  const [anchor, setAnchor] = useState<Element | null>(null);
  const target = useRef<FormControl | null>(null);
  useEffect(() => {
    if (target.current) setMessage(validationMessage(target.current, locale));
    let showingFirst = false;
    const invalid = (event: Event) => {
      const control = event.target;
      if (!(
        control instanceof HTMLInputElement ||
        control instanceof HTMLSelectElement ||
        control instanceof HTMLTextAreaElement
      ))
        return;
      event.preventDefault();
      if (showingFirst) return;
      showingFirst = true;
      queueMicrotask(() => {
        showingFirst = false;
      });
      if (target.current && target.current !== control) {
        target.current.removeAttribute("aria-invalid");
        target.current.removeAttribute("aria-errormessage");
      }
      target.current = control;
      control.setAttribute("aria-invalid", "true");
      control.setAttribute("aria-errormessage", "validation-notice-message");
      setAnchor(control.closest(".field") ?? control.parentElement);
      setMessage(validationMessage(control, locale));
      requestAnimationFrame(() => control.focus({ preventScroll: false }));
    };
    const changed = (event: Event) => {
      const active = target.current;
      if (event.target === active && active?.validity.valid) {
        active.removeAttribute("aria-invalid");
        active.removeAttribute("aria-errormessage");
        target.current = null;
        setAnchor(null);
        setMessage("");
      }
    };
    const submitted = () => {
      target.current?.removeAttribute("aria-invalid");
      target.current?.removeAttribute("aria-errormessage");
      target.current = null;
      setAnchor(null);
      setMessage("");
    };
    document.addEventListener("invalid", invalid, true);
    document.addEventListener("input", changed, true);
    document.addEventListener("change", changed, true);
    document.addEventListener("submit", submitted, true);
    return () => {
      document.removeEventListener("invalid", invalid, true);
      document.removeEventListener("input", changed, true);
      document.removeEventListener("change", changed, true);
      document.removeEventListener("submit", submitted, true);
    };
  }, [locale]);
  if (!message || !anchor?.isConnected) return null;
  return createPortal(
    <p className="field-error" id="validation-notice-message" role="alert">
      <CircleAlert size={16} aria-hidden="true" />
      <span>{t(message)}</span>
    </p>,
    anchor,
  );
}
