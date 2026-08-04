import { useRef, useState } from "react";
import { SimpleMathKeyboard } from "./SimpleMathKeyboard";
import { MathText } from "./MathText";
function MathEditor({
  value = "",
  onChange,
  placeholder = "Nh\u1EADp n\u1ED9i dung...",
  rows = 2,
  variant = "outlined",
  size = "medium",
  showPreview = true,
  className = "",
  style = {},
  toolbar = null,
  onImagePaste = null,
  bgColor,
  onBgColor
}) {
  const inputRef = useRef(null);
  const previewRef = useRef(null);
  const [showSimpleKeyboard, setShowSimpleKeyboard] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [isLivePreviewEnabled, setIsLivePreviewEnabled] = useState(false);
  const sizeConfig = {
    small: {
      padding: "8px 10px",
      fontSize: "0.875rem",
      minHeight: "36px",
      buttonPadding: "4px 8px",
      buttonFontSize: "12px"
    },
    medium: {
      padding: "10px 12px",
      fontSize: "1rem",
      minHeight: "44px",
      buttonPadding: "6px 12px",
      buttonFontSize: "13px"
    },
    large: {
      padding: "12px 14px",
      fontSize: "1.1rem",
      minHeight: "52px",
      buttonPadding: "8px 14px",
      buttonFontSize: "14px"
    }
  };
  const config = sizeConfig[size] || sizeConfig.medium;
  const handleInsertFormula = (latex) => {
    if (inputRef.current) {
      const input = inputRef.current;
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const before = value.substring(0, start);
      const after = value.substring(end);
      const newValue = `${before}${latex}${after}`;
      onChange(newValue);
      setTimeout(() => {
        const newCursorPos = start + latex.length;
        input.focus();
        input.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
    setShowSimpleKeyboard(false);
  };
  const wrapSelection = (marker) => {
    if (!inputRef.current) return;
    const input = inputRef.current;
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const selected = value.substring(start, end);
    const before = value.substring(0, start);
    const after = value.substring(end);
    let newValue, newStart, newEnd;
    if (selected) {
      const markerLen = marker.length;
      const isWrapped = before.endsWith(marker) && after.startsWith(marker);
      if (isWrapped) {
        newValue = before.slice(0, -markerLen) + selected + after.slice(markerLen);
        newStart = start - markerLen;
        newEnd = end - markerLen;
      } else {
        newValue = `${before}${marker}${selected}${marker}${after}`;
        newStart = start + markerLen;
        newEnd = end + markerLen;
      }
    } else {
      newValue = `${before}${marker}${marker}${after}`;
      newStart = start + marker.length;
      newEnd = newStart;
    }
    onChange(newValue);
    setTimeout(() => {
      input.focus();
      input.setSelectionRange(newStart, newEnd);
    }, 0);
  };
  const applyColor = (color) => {
    setShowColorPicker(false);
    if (!inputRef.current) return;
    const input = inputRef.current;
    let start = input.selectionStart || 0;
    let end = input.selectionEnd || 0;
    if (start === end) {
      start = 0;
      end = value.length;
    }
    const selected = value.substring(start, end);
    const before = value.substring(0, start);
    const after = value.substring(end);
    const wrapped = `[color=${color}]${selected}[/color]`;
    const newValue = `${before}${wrapped}${after}`;
    onChange(newValue);
    setTimeout(() => {
      input.focus();
      const newCursor = start + wrapped.length - selected.length - "[/color]".length;
      input.setSelectionRange(newCursor, newCursor + selected.length);
    }, 0);
  };
  const getVariantStyles = () => {
    const base = {
      width: "100%",
      padding: config.padding,
      fontSize: config.fontSize,
      fontFamily: '"Segoe UI", sans-serif',
      borderRadius: "6px",
      boxSizing: "border-box",
      transition: "border-color 0.2s, box-shadow 0.2s",
      resize: rows > 1 ? "vertical" : "none"
    };
    switch (variant) {
      case "minimal":
        return {
          ...base,
          border: "none",
          borderBottom: isFocused ? "2px solid #667eea" : "2px solid #ddd",
          borderRadius: 0,
          backgroundColor: "transparent"
        };
      case "mui":
        return {
          ...base,
          border: "1px solid",
          borderColor: isFocused ? "#667eea" : "rgba(0, 0, 0, 0.23)",
          backgroundColor: "#fff",
          boxShadow: isFocused ? "0 0 0 2px rgba(102, 126, 234, 0.2)" : "none"
        };
      case "outlined":
      default:
        return {
          ...base,
          border: isFocused ? "2px solid #667eea" : "2px solid #ddd",
          backgroundColor: "#fff"
        };
    }
  };
  const InputComponent = rows > 1 ? "textarea" : "input";
  return <div className={className} style={{ width: "100%", ...style }}>
      {
    /* Formula button & Formatting buttons & Custom Toolbar */
  }
      <div style={{ marginBottom: "4px", display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
        <button
    type="button"
    onClick={() => setShowSimpleKeyboard(true)}
    title="Chèn công thức toán học"
    style={{
      padding: "4px 8px",
      fontSize: "16px",
      fontWeight: "500",
      border: "1px solid #667eea",
      borderRadius: "4px",
      backgroundColor: "rgba(102, 126, 234, 0.08)",
      color: "#667eea",
      cursor: "pointer",
      transition: "all 0.2s",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minWidth: "32px",
      height: "32px"
    }}
    onMouseOver={(e) => {
      e.currentTarget.style.backgroundColor = "rgba(102, 126, 234, 0.2)";
    }}
    onMouseOut={(e) => {
      e.currentTarget.style.backgroundColor = "rgba(102, 126, 234, 0.08)";
    }}
  >
          √
        </button>


        {
    /* Color picker */
  }
        <div style={{ position: "relative" }}>
          <button
    type="button"
    title="Đổi màu chữ"
    onMouseDown={(e) => {
      e.preventDefault();
      setShowColorPicker((v) => !v);
    }}
    style={{
      padding: "4px 8px",
      fontSize: "13px",
      border: "1px solid #ccc",
      borderRadius: "4px",
      backgroundColor: "#f5f5f5",
      color: "#333",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minWidth: "32px",
      height: "32px",
      gap: "3px"
    }}
    onMouseOver={(e) => {
      e.currentTarget.style.backgroundColor = "#e0e0e0";
    }}
    onMouseOut={(e) => {
      e.currentTarget.style.backgroundColor = "#f5f5f5";
    }}
  >
            <span style={{ fontSize: "15px", lineHeight: 1 }}>A</span>
            <span style={{ fontSize: "9px" }}>▼</span>
          </button>
          {showColorPicker && <div style={{
    position: "absolute",
    top: "36px",
    left: 0,
    zIndex: 100,
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: "6px",
    padding: "8px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    display: "flex",
    flexWrap: "wrap",
    gap: "4px",
    width: "152px"
  }}>
              {[
    { color: "#000000", label: "\u0110en" },
    { color: "#e53935", label: "\u0110\u1ECF" },
    { color: "#1e88e5", label: "Xanh d\u01B0\u01A1ng" },
    { color: "#43a047", label: "Xanh l\xE1" },
    { color: "#fb8c00", label: "Cam" },
    { color: "#8e24aa", label: "T\xEDm" },
    { color: "#e91e63", label: "H\u1ED3ng" },
    { color: "#00897b", label: "Ng\u1ECDc" },
    { color: "#f4511e", label: "\u0110\u1ECF cam" },
    { color: "#6d4c41", label: "N\xE2u" },
    { color: "#546e7a", label: "X\xE1m xanh" },
    { color: "#fdd835", label: "V\xE0ng" }
  ].map(({ color, label }) => <button
    key={color}
    type="button"
    title={label}
    onMouseDown={(e) => {
      e.preventDefault();
      applyColor(color);
    }}
    style={{
      width: "24px",
      height: "24px",
      borderRadius: "50%",
      backgroundColor: color,
      border: "2px solid #e0e0e0",
      cursor: "pointer",
      padding: 0
    }}
    onMouseOver={(e) => {
      e.currentTarget.style.border = "2px solid #333";
    }}
    onMouseOut={(e) => {
      e.currentTarget.style.border = "2px solid #e0e0e0";
    }}
  />)}
            </div>}
        </div>

        {
    /* Bg color picker */
  }
        {onBgColor !== void 0 && <div style={{ position: "relative" }}>
            <button
    type="button"
    title="Màu nền chữ"
    onMouseDown={(e) => {
      e.preventDefault();
      setShowBgPicker((v) => !v);
      setShowColorPicker(false);
    }}
    style={{
      padding: "4px 8px",
      fontSize: "13px",
      border: `1px solid ${bgColor ? "#1976d2" : "#ccc"}`,
      borderRadius: "4px",
      backgroundColor: bgColor || "#f5f5f5",
      color: bgColor ? "#1976d2" : "#333",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minWidth: "32px",
      height: "32px",
      gap: "3px"
    }}
    onMouseOver={(e) => {
      e.currentTarget.style.opacity = "0.85";
    }}
    onMouseOut={(e) => {
      e.currentTarget.style.opacity = "1";
    }}
  >
              <span style={{ fontSize: "15px", lineHeight: 1 }}>▭</span>
              <span style={{ fontSize: "9px" }}>▼</span>
            </button>
            {showBgPicker && <div style={{
    position: "absolute",
    top: "36px",
    left: 0,
    zIndex: 100,
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: "6px",
    padding: "8px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    display: "flex",
    flexWrap: "wrap",
    gap: "4px",
    width: "152px"
  }}>
                {
    /* Ô đầu: xóa màu nền */
  }
                <button
    type="button"
    title="Không màu"
    onMouseDown={(e) => {
      e.preventDefault();
      onBgColor("");
      setShowBgPicker(false);
    }}
    style={{
      width: "24px",
      height: "24px",
      borderRadius: "50%",
      background: "transparent",
      border: "2px dashed #bbb",
      cursor: "pointer",
      padding: 0,
      fontSize: "12px",
      color: "#bbb",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }}
  >∅</button>
                {[
    { color: "#fff9c4", label: "V\xE0ng nh\u1EA1t" },
    { color: "#e3f2fd", label: "Xanh nh\u1EA1t" },
    { color: "#e8f5e9", label: "Xanh l\xE1 nh\u1EA1t" },
    { color: "#fce4ec", label: "H\u1ED3ng nh\u1EA1t" },
    { color: "#ede7f6", label: "T\xEDm nh\u1EA1t" },
    { color: "#fff3e0", label: "Cam nh\u1EA1t" },
    { color: "#f1f8e9", label: "Xanh mint" },
    { color: "#e0f7fa", label: "Ng\u1ECDc nh\u1EA1t" },
    { color: "#fafafa", label: "Tr\u1EAFng x\xE1m" },
    { color: "#fff", label: "Tr\u1EAFng" },
    { color: "#1a1a2e", label: "\u0110en" }
  ].map(({ color, label }) => <button
    key={color}
    type="button"
    title={label}
    onMouseDown={(e) => {
      e.preventDefault();
      onBgColor(color);
      setShowBgPicker(false);
    }}
    style={{
      width: "24px",
      height: "24px",
      borderRadius: "50%",
      backgroundColor: color,
      border: bgColor === color ? "2px solid #1976d2" : "2px solid #e0e0e0",
      cursor: "pointer",
      padding: 0
    }}
    onMouseOver={(e) => {
      e.currentTarget.style.border = "2px solid #333";
    }}
    onMouseOut={(e) => {
      e.currentTarget.style.border = bgColor === color ? "2px solid #1976d2" : "2px solid #e0e0e0";
    }}
  />)}
                {
    /* Custom color */
  }
                <label
    title="Chọn màu khác"
    style={{
      width: "24px",
      height: "24px",
      borderRadius: "50%",
      background: "linear-gradient(135deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f)",
      border: "2px solid #e0e0e0",
      cursor: "pointer",
      padding: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      overflow: "hidden",
      flexShrink: 0
    }}
  >
                  <input
    type="color"
    value={bgColor || "#ffffff"}
    style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }}
    onChange={(e) => {
      onBgColor(e.target.value);
    }}
    onBlur={() => setShowBgPicker(false)}
  />
                </label>
              </div>}
          </div>}

        {
    /* Toggle Live Preview button */
  }
        {showPreview && <button
    type="button"
    title={isLivePreviewEnabled ? "\u1EA8n xem tr\u01B0\u1EDBc" : "B\u1EADt xem tr\u01B0\u1EDBc"}
    onClick={(e) => {
      e.preventDefault();
      setIsLivePreviewEnabled(!isLivePreviewEnabled);
    }}
    style={{
      padding: "4px 8px",
      fontSize: "14px",
      border: isLivePreviewEnabled ? "1px solid #667eea" : "1px solid #ccc",
      borderRadius: "4px",
      backgroundColor: isLivePreviewEnabled ? "rgba(102, 126, 234, 0.1)" : "#f5f5f5",
      color: isLivePreviewEnabled ? "#667eea" : "#333",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minWidth: "32px",
      height: "32px",
      marginLeft: "4px",
      transition: "all 0.2s"
    }}
  >
            👁️
          </button>}

        {toolbar && <div style={{ display: "flex", alignItems: "center", marginLeft: "4px" }}>
            {toolbar}
          </div>}
      </div>

      {
    /* Input container */
  }
      <div style={{ position: "relative", width: "100%" }}>
        <InputComponent
    ref={inputRef}
    type={rows > 1 ? void 0 : "text"}
    rows={rows > 1 ? rows : void 0}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    onFocus={() => setIsFocused(true)}
    onBlur={() => setIsFocused(false)}
    onPaste={(e) => {
      if (onImagePaste && e.clipboardData && e.clipboardData.items) {
        for (let i = 0; i < e.clipboardData.items.length; i++) {
          if (e.clipboardData.items[i].type.indexOf("image") !== -1) {
            const file = e.clipboardData.items[i].getAsFile();
            if (file) {
              onImagePaste(file);
            }
            e.preventDefault();
            return;
          }
        }
      }
    }}
    placeholder={placeholder}
    style={{
      ...getVariantStyles(),
      position: "relative",
      zIndex: 2,
      backgroundColor: "#fff",
      color: "#333",
      caretColor: "#333",
      minHeight: rows > 1 ? `${rows * 24 + 20}px` : config.minHeight
    }}
  />
      </div>

      {
    /* Live Preview layer (shown below editor to avoid overlapping messy text) */
  }
      {showPreview && isLivePreviewEnabled && value && <div style={{
    marginTop: "8px",
    padding: "8px 12px",
    backgroundColor: "#fafafa",
    border: "1px dashed #ccc",
    borderRadius: "6px",
    fontSize: config.fontSize
  }}>
          <div style={{ fontSize: "11px", color: "#888", marginBottom: "4px", fontWeight: "bold" }}>XEM TRƯỚC:</div>
          <MathText content={value} as="div" />
        </div>}

      {
    /* Simple Math Keyboard (lightweight) */
  }
      <SimpleMathKeyboard
    open={showSimpleKeyboard}
    onInsert={handleInsertFormula}
    onClose={() => setShowSimpleKeyboard(false)}
  />

      <style>{`
        .math-formula-inline .katex {
          font-size: 0.95em;
        }
      `}</style>
    </div>;
}
export {
  MathEditor
};
