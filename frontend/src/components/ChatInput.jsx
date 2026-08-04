import { useEffect, useRef, useState } from "react";
import { ArrowUp, ChevronDown, Moon, Sun } from "lucide-react";

const LENGTH_OPTIONS = [
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "long", label: "Long" },
];

export default function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
  length,
  setLength,
  themePref,
  setThemePref,
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend?.();
    }
  };

  const currentLabel =
    LENGTH_OPTIONS.find((option) => option.value === length)?.label || "Medium";

  return (
    <div className="px-4 pb-4 md:px-6 lg:px-8">
      <div className="mx-auto max-w-[760px]">
        <div className="composer">
          <div className="length-dropdown hidden sm:block" ref={dropdownRef}>
            <button
              type="button"
              className="length-trigger"
              onClick={() => setDropdownOpen((open) => !open)}
              aria-haspopup="listbox"
              aria-expanded={dropdownOpen}
            >
              {currentLabel}
              <ChevronDown size={13} strokeWidth={2.5} />
            </button>

            {dropdownOpen ? (
              <ul className="length-menu" role="listbox">
                {LENGTH_OPTIONS.map((option) => (
                  <li
                    key={option.value}
                    role="option"
                    aria-selected={length === option.value}
                    className={`length-option ${length === option.value ? "selected" : ""}`}
                    onClick={() => {
                      setLength?.(option.value);
                      setDropdownOpen(false);
                    }}
                  >
                    {option.label}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <input
            type="text"
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything…"
            className="composer-input"
            aria-label="Message input"
          />

          <button
            type="button"
            className="theme-toggle-btn"
            onClick={() =>
              setThemePref?.(themePref === "dark" ? "light" : "dark")
            }
            aria-label="Toggle theme"
            title="Toggle theme"
          >
            {themePref === "dark" ? <Moon size={17} /> : <Sun size={17} />}
          </button>

          <button
            type="button"
            className="send-btn"
            onClick={() => onSend?.()}
            disabled={disabled}
            aria-label="Send message"
          >
            <ArrowUp size={16} strokeWidth={2.5} />
          </button>
        </div>
        <div className="mt-2 text-center text-xs dinova-muted hidden sm:block">
          Enter to send, Shift+Enter for a new line.
        </div>
      </div>
    </div>
  );
}
