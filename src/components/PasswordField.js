"use client";

import { useState } from "react";

// Kolom input password dengan tombol "lihat/sembunyikan" (ikon mata).
export default function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder = "••••••••",
  required = false,
  autoFocus = false,
  defaultShow = false,
}) {
  const [show, setShow] = useState(defaultShow);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password-wrap">
        <input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          autoFocus={autoFocus}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Sembunyikan password" : "Lihat password"}
          title={show ? "Sembunyikan password" : "Lihat password"}
        >
          {show ? "🙈" : "👁"}
        </button>
      </div>
    </div>
  );
}
