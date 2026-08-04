import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import katex from "katex";
import "katex/dist/katex.min.css";
const TEMPLATES = [
  {
    key: "frac",
    name: "Ph\xE2n s\u1ED1",
    icon: "\u25AB/\u25AB",
    slots: [
      { id: "num", label: "T\u1EED" },
      { id: "den", label: "M\u1EABu" }
    ],
    buildLatex: (v) => `\\frac{${v.num || "?"}}{${v.den || "?"}}`
  },
  {
    key: "pow",
    name: "L\u0169y th\u1EEBa",
    icon: "x\u207F",
    slots: [
      { id: "base", label: "C\u01A1 s\u1ED1" },
      { id: "exp", label: "M\u0169" }
    ],
    buildLatex: (v) => `{${v.base || "?"}}^{${v.exp || "?"}}`
  },
  {
    key: "sub",
    name: "Ch\u1EC9 s\u1ED1 d\u01B0\u1EDBi",
    icon: "x\u2099",
    slots: [
      { id: "base", label: "Bi\u1EC3u th\u1EE9c" },
      { id: "sub", label: "Ch\u1EC9 s\u1ED1" }
    ],
    buildLatex: (v) => `{${v.base || "?"}}_{${v.sub || "?"}}`
  },
  {
    key: "sqrt",
    name: "C\u0103n b\u1EADc hai",
    icon: "\u221A\u25AB",
    slots: [
      { id: "inner", label: "Bi\u1EC3u th\u1EE9c" }
    ],
    buildLatex: (v) => `\\sqrt{${v.inner || "?"}}`
  },
  {
    key: "nrt",
    name: "C\u0103n b\u1EADc n",
    icon: "\u207F\u221A\u25AB",
    slots: [
      { id: "n", label: "B\u1EADc" },
      { id: "inner", label: "Bi\u1EC3u th\u1EE9c" }
    ],
    buildLatex: (v) => `\\sqrt[${v.n || "?"}]{${v.inner || "?"}}`
  },
  {
    key: "lim",
    name: "Gi\u1EDBi h\u1EA1n",
    icon: "lim",
    slots: [
      { id: "var", label: "Bi\u1EBFn\u2192gi\xE1 tr\u1ECB" },
      { id: "expr", label: "Bi\u1EC3u th\u1EE9c" }
    ],
    buildLatex: (v) => `\\lim_{${v.var || "x \\to ?"}}{${v.expr || "?"}}`
  },
  {
    key: "sum",
    name: "T\u1ED5ng",
    icon: "\u03A3",
    slots: [
      { id: "from", label: "T\u1EEB" },
      { id: "to", label: "\u0110\u1EBFn" },
      { id: "expr", label: "BT" }
    ],
    buildLatex: (v) => `\\sum_{${v.from || "i=1"}}^{${v.to || "n"}}{${v.expr || "?"}}`
  },
  {
    key: "int",
    name: "T\xEDch ph\xE2n",
    icon: "\u222B",
    slots: [
      { id: "from", label: "D\u01B0\u1EDBi" },
      { id: "to", label: "Tr\xEAn" },
      { id: "expr", label: "BT" }
    ],
    buildLatex: (v) => `\\int_{${v.from || "?"}}^{${v.to || "?"}}{${v.expr || "?"}}\\,dx`
  }
];
const TEMPLATE_MAP = Object.fromEntries(TEMPLATES.map((t) => [t.key, t]));
const QUICK_OPS = [
  { label: "+", latex: " + " },
  { label: "\u2212", latex: " - " },
  { label: "\xD7", latex: " \\times " },
  { label: "\xF7", latex: " \\div " },
  { label: "=", latex: " = " },
  { label: "\u2260", latex: " \\neq " },
  { label: "<", latex: " < " },
  { label: ">", latex: " > " },
  { label: "\u2264", latex: " \\leq " },
  { label: "\u2265", latex: " \\geq " }
];
const SYMBOL_GROUPS = [
  {
    name: "C\u01A1 b\u1EA3n",
    symbols: [
      { label: "\xB1", latex: "\\pm", title: "C\u1ED9ng tr\u1EEB" },
      { label: "\xD7", latex: "\\times", title: "Nh\xE2n" },
      { label: "\xF7", latex: "\\div", title: "Chia" },
      { label: "\u2260", latex: "\\neq", title: "Kh\xE1c" },
      { label: "\u2248", latex: "\\approx", title: "X\u1EA5p x\u1EC9" },
      { label: "\u2264", latex: "\\leq", title: "Nh\u1ECF h\u01A1n ho\u1EB7c b\u1EB1ng" },
      { label: "\u2265", latex: "\\geq", title: "L\u1EDBn h\u01A1n ho\u1EB7c b\u1EB1ng" },
      { label: "\u221E", latex: "\\infty", title: "V\xF4 c\u1EF1c" },
      { label: "\u03C0", latex: "\\pi", title: "Pi" },
      { label: "\xB0", latex: "^{\\circ}", title: "\u0110\u1ED9" }
    ]
  },
  {
    name: "H\xECnh h\u1ECDc",
    symbols: [
      { label: "\u2220", latex: "\\angle", title: "G\xF3c" },
      { label: "\u25B3", latex: "\\triangle", title: "Tam gi\xE1c" },
      { label: "\u22A5", latex: "\\perp", title: "Vu\xF4ng g\xF3c" },
      { label: "\u2225", latex: "\\parallel", title: "Song song" },
      { label: "\u2299", latex: "\\odot", title: "\u0110\u01B0\u1EDDng tr\xF2n" },
      { label: "\u2192", latex: "\\overrightarrow{AB}", title: "Vect\u01A1" }
    ]
  },
  {
    name: "T\u1EADp h\u1EE3p",
    symbols: [
      { label: "\u2208", latex: "\\in", title: "Thu\u1ED9c" },
      { label: "\u2209", latex: "\\notin", title: "Kh\xF4ng thu\u1ED9c" },
      { label: "\u2282", latex: "\\subset", title: "T\u1EADp con" },
      { label: "\u222A", latex: "\\cup", title: "H\u1EE3p" },
      { label: "\u2229", latex: "\\cap", title: "Giao" },
      { label: "\u2205", latex: "\\emptyset", title: "T\u1EADp r\u1ED7ng" },
      { label: "\u211D", latex: "\\mathbb{R}", title: "T\u1EADp s\u1ED1 th\u1EF1c" },
      { label: "\u2124", latex: "\\mathbb{Z}", title: "T\u1EADp s\u1ED1 nguy\xEAn" },
      { label: "\u2115", latex: "\\mathbb{N}", title: "T\u1EADp s\u1ED1 t\u1EF1 nhi\xEAn" }
    ]
  },
  {
    name: "M\u0169i t\xEAn & Logic",
    symbols: [
      { label: "\u2192", latex: "\\rightarrow", title: "Suy ra" },
      { label: "\u21D2", latex: "\\Rightarrow", title: "K\xE9o theo" },
      { label: "\u21D4", latex: "\\Leftrightarrow", title: "T\u01B0\u01A1ng \u0111\u01B0\u01A1ng" },
      { label: "\u2200", latex: "\\forall", title: "V\u1EDBi m\u1ECDi" },
      { label: "\u2203", latex: "\\exists", title: "T\u1ED3n t\u1EA1i" }
    ]
  },
  {
    name: "Hy L\u1EA1p",
    symbols: [
      { label: "\u03B1", latex: "\\alpha" },
      { label: "\u03B2", latex: "\\beta" },
      { label: "\u03B3", latex: "\\gamma" },
      { label: "\u03B4", latex: "\\delta" },
      { label: "\u03B8", latex: "\\theta" },
      { label: "\u03BB", latex: "\\lambda" },
      { label: "\u03BC", latex: "\\mu" },
      { label: "\u03C3", latex: "\\sigma" },
      { label: "\u03C6", latex: "\\varphi" },
      { label: "\u03C9", latex: "\\omega" },
      { label: "\u0394", latex: "\\Delta" },
      { label: "\u03A3", latex: "\\Sigma" }
    ]
  }
];
function renderKatex(latex) {
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      displayMode: true,
      output: "html"
    });
  } catch {
    return `<span style="color:red">${latex}</span>`;
  }
}
let _segId = 0;
function nextSegId() {
  return `seg_${++_segId}_${Date.now()}`;
}
function SimpleMathKeyboard({ open, onInsert, onClose }) {
  const [mode, setMode] = useState("symbols");
  const [activeGroup, setActiveGroup] = useState(0);
  const [rawLatex, setRawLatex] = useState("");
  const [segments, setSegments] = useState([]);
  const [activeSegIdx, setActiveSegIdx] = useState(0);
  const [activeSlotId, setActiveSlotId] = useState(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [insertAtIndex, setInsertAtIndex] = useState(-1);
  const slotInputRefs = useRef({});
  const textInputRefs = useRef({});
  useEffect(() => {
    if (open) {
      setMode("symbols");
      setSegments([]);
      setActiveSegIdx(0);
      setActiveSlotId(null);
      setRawLatex("");
      setShowTemplatePicker(false);
      setInsertAtIndex(-1);
    }
  }, [open]);
  useEffect(() => {
    if (activeSlotId && slotInputRefs.current[activeSlotId]) {
      setTimeout(() => slotInputRefs.current[activeSlotId]?.focus(), 30);
    }
  }, [activeSlotId]);
  const createSegmentFromTemplate = useCallback((tmpl) => {
    return {
      id: nextSegId(),
      type: "template",
      templateKey: tmpl.key,
      slots: tmpl.slots.map((s) => ({ ...s, value: "" }))
    };
  }, []);
  const createTextSegment = useCallback((text = "") => {
    return {
      id: nextSegId(),
      type: "text",
      slots: [],
      textValue: text
    };
  }, []);
  const addSegment = useCallback((seg, atIndex) => {
    setSegments((prev) => {
      const newSegs = [...prev];
      const idx = atIndex !== void 0 && atIndex >= 0 ? atIndex : newSegs.length;
      newSegs.splice(idx, 0, seg);
      return newSegs;
    });
    setShowTemplatePicker(false);
  }, []);
  const removeSegment = useCallback((idx) => {
    setSegments((prev) => prev.filter((_, i) => i !== idx));
  }, []);
  const updateSegmentSlot = useCallback((segIdx, slotId, value) => {
    setSegments((prev) => prev.map(
      (seg, i) => i === segIdx ? { ...seg, slots: seg.slots.map((s) => s.id === slotId ? { ...s, value } : s) } : seg
    ));
  }, []);
  const updateSegmentText = useCallback((segIdx, value) => {
    setSegments((prev) => prev.map(
      (seg, i) => i === segIdx ? { ...seg, textValue: value } : seg
    ));
  }, []);
  const getFullLatex = useCallback(() => {
    return segments.map((seg) => {
      if (seg.type === "text") {
        return seg.textValue || "";
      }
      const tmpl = TEMPLATE_MAP[seg.templateKey];
      if (!tmpl) return "";
      const values = {};
      seg.slots.forEach((s) => {
        values[s.id] = s.value;
      });
      return tmpl.buildLatex(values);
    }).join("");
  }, [segments]);
  const handleInsertExpression = useCallback(() => {
    const latex = getFullLatex();
    if (latex) {
      onInsert(`$${latex}$`);
      setSegments([]);
    }
  }, [getFullLatex, onInsert]);
  const handleInsertSymbol = useCallback((latex) => {
    onInsert(`$${latex}$`);
  }, [onInsert]);
  const handleInsertRawLatex = useCallback(() => {
    if (rawLatex.trim()) {
      onInsert(`$${rawLatex}$`);
      setRawLatex("");
    }
  }, [rawLatex, onInsert]);
  const handleSlotKeyDown = useCallback((e, segIdx, slotId) => {
    const seg = segments[segIdx];
    if (!seg) return;
    if (e.key === "Tab") {
      e.preventDefault();
      const slotIdx = seg.slots.findIndex((s) => s.id === slotId);
      if (e.shiftKey) {
        if (slotIdx > 0) {
          setActiveSlotId(seg.slots[slotIdx - 1].id);
        } else if (segIdx > 0) {
          setActiveSegIdx(segIdx - 1);
          const prevSeg = segments[segIdx - 1];
          if (prevSeg.type === "text") {
            setTimeout(() => textInputRefs.current[prevSeg.id]?.focus(), 30);
          } else if (prevSeg.slots.length) {
            setActiveSlotId(prevSeg.slots[prevSeg.slots.length - 1].id);
          }
        }
      } else {
        if (slotIdx < seg.slots.length - 1) {
          setActiveSlotId(seg.slots[slotIdx + 1].id);
        } else if (segIdx < segments.length - 1) {
          setActiveSegIdx(segIdx + 1);
          const nextSeg = segments[segIdx + 1];
          if (nextSeg.type === "text") {
            setTimeout(() => textInputRefs.current[nextSeg.id]?.focus(), 30);
          } else if (nextSeg.slots.length) {
            setActiveSlotId(nextSeg.slots[0].id);
          }
        }
      }
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleInsertExpression();
    }
  }, [segments, handleInsertExpression]);
  const handleTextKeyDown = useCallback((e, segIdx) => {
    if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) {
        if (segIdx > 0) {
          setActiveSegIdx(segIdx - 1);
          const prevSeg = segments[segIdx - 1];
          if (prevSeg.type === "text") {
            setTimeout(() => textInputRefs.current[prevSeg.id]?.focus(), 30);
          } else if (prevSeg.slots.length) {
            setActiveSlotId(prevSeg.slots[prevSeg.slots.length - 1].id);
          }
        }
      } else {
        if (segIdx < segments.length - 1) {
          setActiveSegIdx(segIdx + 1);
          const nextSeg = segments[segIdx + 1];
          if (nextSeg.type === "text") {
            setTimeout(() => textInputRefs.current[nextSeg.id]?.focus(), 30);
          } else if (nextSeg.slots.length) {
            setActiveSlotId(nextSeg.slots[0].id);
          }
        }
      }
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleInsertExpression();
    }
  }, [segments, handleInsertExpression]);
  const openPickerAt = useCallback((idx) => {
    setInsertAtIndex(idx);
    setShowTemplatePicker(true);
  }, []);
  const pickTemplate = useCallback((tmpl) => {
    const seg = createSegmentFromTemplate(tmpl);
    addSegment(seg, insertAtIndex);
    setActiveSegIdx(insertAtIndex >= 0 ? insertAtIndex : segments.length);
    setActiveSlotId(seg.slots[0]?.id || null);
    setShowTemplatePicker(false);
  }, [createSegmentFromTemplate, addSegment, insertAtIndex, segments.length]);
  const pickTextSegment = useCallback(() => {
    const seg = createTextSegment("");
    addSegment(seg, insertAtIndex);
    setActiveSegIdx(insertAtIndex >= 0 ? insertAtIndex : segments.length);
    setShowTemplatePicker(false);
    setTimeout(() => textInputRefs.current[seg.id]?.focus(), 50);
  }, [createTextSegment, addSegment, insertAtIndex, segments.length]);
  const insertQuickOp = useCallback((latex, afterIdx) => {
    const seg = createTextSegment(latex);
    addSegment(seg, afterIdx + 1);
  }, [createTextSegment, addSegment]);
  if (!open) return null;
  const fullLatex = getFullLatex();
  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.3)",
        zIndex: 99990,
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
      onClick={onClose}
    >
      <div
      style={{
        backgroundColor: "#fff",
        borderRadius: "14px",
        padding: "16px",
        maxWidth: mode === "template" ? "700px" : "520px",
        width: "96%",
        boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
        zIndex: 99991,
        maxHeight: "90vh",
        overflowY: "auto",
        position: "relative",
        transition: "max-width 0.3s ease"
      }}
      onClick={(e) => e.stopPropagation()}
    >
        {
      /* Header */
    }
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "#333" }}>
            Chèn công thức
          </h3>
          <button
      type="button"
      onClick={onClose}
      style={{
        background: "none",
        border: "none",
        fontSize: "20px",
        cursor: "pointer",
        color: "#999",
        padding: "4px 8px",
        lineHeight: 1
      }}
    >
            ✕
          </button>
        </div>

        {
      /* Mode tabs */
    }
        <div style={{ display: "flex", gap: "4px", marginBottom: "12px", borderBottom: "1px solid #eee", paddingBottom: "8px" }}>
          {[
      { key: "symbols", label: "K\xFD hi\u1EC7u" },
      { key: "template", label: "\u{1F9E9} Bi\u1EC3u th\u1EE9c" },
      { key: "latex", label: "LaTeX" }
    ].map((tab) => <button
      key={tab.key}
      type="button"
      onClick={() => {
        setMode(tab.key);
        setShowTemplatePicker(false);
      }}
      style={{
        padding: "6px 14px",
        fontSize: "13px",
        fontWeight: mode === tab.key ? 600 : 400,
        border: "none",
        borderBottom: mode === tab.key ? "2px solid #667eea" : "2px solid transparent",
        backgroundColor: "transparent",
        color: mode === tab.key ? "#667eea" : "#666",
        cursor: "pointer",
        transition: "all 0.2s"
      }}
    >
              {tab.label}
            </button>)}
        </div>

        {
      /* ═══ Symbols mode ═══ */
    }
        {mode === "symbols" && <div>
            <div style={{ display: "flex", gap: "4px", marginBottom: "10px", flexWrap: "wrap" }}>
              {SYMBOL_GROUPS.map((g, i) => <button
      key={g.name}
      type="button"
      onClick={() => setActiveGroup(i)}
      style={{
        padding: "4px 10px",
        fontSize: "12px",
        border: "1px solid",
        borderColor: activeGroup === i ? "#667eea" : "#ddd",
        borderRadius: "14px",
        backgroundColor: activeGroup === i ? "rgba(102,126,234,0.1)" : "#fafafa",
        color: activeGroup === i ? "#667eea" : "#555",
        cursor: "pointer"
      }}
    >
                  {g.name}
                </button>)}
            </div>
            <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(48px, 1fr))",
      gap: "6px"
    }}>
              {SYMBOL_GROUPS[activeGroup].symbols.map((sym) => <button
      key={sym.latex}
      type="button"
      title={sym.title || sym.label}
      onClick={() => handleInsertSymbol(sym.latex)}
      style={{
        padding: "8px 4px",
        fontSize: "18px",
        border: "1px solid #e0e0e0",
        borderRadius: "6px",
        backgroundColor: "#fff",
        cursor: "pointer",
        transition: "all 0.15s",
        minHeight: "40px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.backgroundColor = "#f0f0ff";
        e.currentTarget.style.borderColor = "#667eea";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.backgroundColor = "#fff";
        e.currentTarget.style.borderColor = "#e0e0e0";
      }}
    >
                  {sym.label}
                </button>)}
            </div>
          </div>}

        {
      /* ═══ Expression Builder mode ═══ */
    }
        {mode === "template" && <div>
            {
      /* Live KaTeX preview */
    }
            <div style={{
      padding: "12px 16px",
      backgroundColor: "#fafafa",
      border: "1px solid #e8e8e8",
      borderRadius: "10px",
      marginBottom: "12px",
      minHeight: "52px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }}>
              {fullLatex ? <div
      dangerouslySetInnerHTML={{ __html: renderKatex(fullLatex) }}
      style={{ fontSize: "1.5rem" }}
    /> : <span style={{ color: "#bbb", fontSize: "14px", fontStyle: "italic" }}>
                  Bấm nút bên dưới để bắt đầu xây biểu thức...
                </span>}
            </div>

            {
      /* Segments row — each segment is a column */
    }
            {segments.length > 0 && <div style={{
      display: "flex",
      gap: "4px",
      alignItems: "stretch",
      overflowX: "auto",
      paddingBottom: "8px",
      marginBottom: "8px"
    }}>
                {segments.map((seg, sIdx) => <div key={seg.id} style={{ display: "flex", alignItems: "stretch", gap: "4px" }}>
                    {
      /* The segment card */
    }
                    <div
      onClick={() => setActiveSegIdx(sIdx)}
      style={{
        border: "2px solid",
        borderColor: activeSegIdx === sIdx ? "#667eea" : "#e0e0e0",
        borderRadius: "10px",
        padding: "8px",
        backgroundColor: activeSegIdx === sIdx ? "rgba(102,126,234,0.04)" : "#fff",
        minWidth: seg.type === "template" ? "100px" : "60px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        position: "relative",
        cursor: "pointer",
        transition: "all 0.2s"
      }}
    >
                      {
      /* Segment header */
    }
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "4px" }}>
                        <span style={{
      fontSize: "10px",
      fontWeight: 700,
      color: seg.type === "template" ? "#667eea" : "#888",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      whiteSpace: "nowrap"
    }}>
                          {seg.type === "template" ? TEMPLATE_MAP[seg.templateKey]?.name || "Template" : "V\u0103n b\u1EA3n"}
                        </span>
                        <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        removeSegment(sIdx);
      }}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        color: "#ccc",
        fontSize: "14px",
        padding: "0 2px",
        lineHeight: 1
      }}
      onMouseOver={(e) => e.currentTarget.style.color = "#f44336"}
      onMouseOut={(e) => e.currentTarget.style.color = "#ccc"}
      title="Xóa"
    >
                          ×
                        </button>
                      </div>

                      {
      /* Template slots */
    }
                      {seg.type === "template" && seg.slots.map((slot) => <div key={slot.id} style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                          <label style={{
      fontSize: "10px",
      fontWeight: 600,
      color: activeSlotId === slot.id ? "#667eea" : "#999"
    }}>
                            {slot.label}
                          </label>
                          <input
      ref={(el) => {
        slotInputRefs.current[slot.id] = el;
      }}
      type="text"
      value={slot.value}
      onChange={(e) => updateSegmentSlot(sIdx, slot.id, e.target.value)}
      onFocus={() => {
        setActiveSegIdx(sIdx);
        setActiveSlotId(slot.id);
      }}
      onKeyDown={(e) => handleSlotKeyDown(e, sIdx, slot.id)}
      placeholder="..."
      style={{
        border: "1px solid",
        borderColor: activeSlotId === slot.id ? "#667eea" : "#e8e8e8",
        borderRadius: "5px",
        padding: "4px 6px",
        fontSize: "14px",
        fontFamily: 'Cambria Math, "Segoe UI", serif',
        outline: "none",
        width: "100%",
        boxSizing: "border-box",
        backgroundColor: activeSlotId === slot.id ? "#fff" : "#fafafa",
        transition: "all 0.15s"
      }}
    />
                        </div>)}

                      {
      /* Text segment input */
    }
                      {seg.type === "text" && <input
      ref={(el) => {
        textInputRefs.current[seg.id] = el;
      }}
      type="text"
      value={seg.textValue || ""}
      onChange={(e) => updateSegmentText(sIdx, e.target.value)}
      onFocus={() => setActiveSegIdx(sIdx)}
      onKeyDown={(e) => handleTextKeyDown(e, sIdx)}
      placeholder="VD: + , = , ..."
      style={{
        border: "1px solid",
        borderColor: activeSegIdx === sIdx ? "#667eea" : "#e8e8e8",
        borderRadius: "5px",
        padding: "4px 6px",
        fontSize: "14px",
        fontFamily: 'Cambria Math, "Segoe UI", serif',
        outline: "none",
        width: "100%",
        minWidth: "50px",
        boxSizing: "border-box",
        textAlign: "center",
        backgroundColor: "#fff",
        transition: "all 0.15s"
      }}
    />}
                    </div>

                    {
      /* Quick operator between segments */
    }
                    {sIdx < segments.length - 1 && <div style={{
      display: "flex",
      alignItems: "center"
    }}>
                        <button
      type="button"
      onClick={() => openPickerAt(sIdx + 1)}
      title="Thêm phần tử"
      style={{
        width: "20px",
        height: "20px",
        border: "1px dashed #ccc",
        borderRadius: "50%",
        backgroundColor: "transparent",
        color: "#bbb",
        cursor: "pointer",
        fontSize: "14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        lineHeight: 1,
        transition: "all 0.15s"
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.borderColor = "#667eea";
        e.currentTarget.style.color = "#667eea";
        e.currentTarget.style.backgroundColor = "rgba(102,126,234,0.06)";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.borderColor = "#ccc";
        e.currentTarget.style.color = "#bbb";
        e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
                          +
                        </button>
                      </div>}
                  </div>)}
              </div>}

            {
      /* Quick operators row — show when at least one segment exists */
    }
            {segments.length > 0 && <div style={{
      display: "flex",
      gap: "4px",
      marginBottom: "10px",
      flexWrap: "wrap",
      padding: "6px 0",
      borderTop: "1px solid #f0f0f0"
    }}>
                <span style={{ fontSize: "11px", color: "#999", alignSelf: "center", marginRight: "4px" }}>
                  Chèn nhanh:
                </span>
                {QUICK_OPS.map((op) => <button
      key={op.label}
      type="button"
      onClick={() => insertQuickOp(op.latex, segments.length - 1)}
      style={{
        padding: "3px 10px",
        fontSize: "14px",
        border: "1px solid #e0e0e0",
        borderRadius: "6px",
        backgroundColor: "#fff",
        cursor: "pointer",
        fontWeight: 500,
        transition: "all 0.15s"
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.backgroundColor = "#f0f0ff";
        e.currentTarget.style.borderColor = "#667eea";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.backgroundColor = "#fff";
        e.currentTarget.style.borderColor = "#e0e0e0";
      }}
    >
                    {op.label}
                  </button>)}
              </div>}

            {
      /* Template picker (show when adding new segment or no segments yet) */
    }
            {(showTemplatePicker || segments.length === 0) && <div style={{ marginBottom: "10px" }}>
                {segments.length > 0 && <div style={{
      fontSize: "12px",
      color: "#888",
      marginBottom: "6px",
      fontWeight: 500
    }}>
                    Chọn loại phần tử để thêm:
                  </div>}
                <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))",
      gap: "6px"
    }}>
                  {TEMPLATES.map((tmpl) => <button
      key={tmpl.key}
      type="button"
      onClick={() => pickTemplate(tmpl)}
      style={{
        padding: "10px 6px",
        border: "1px solid #e0e0e0",
        borderRadius: "8px",
        backgroundColor: "#fff",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "4px",
        transition: "all 0.15s"
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.backgroundColor = "#f0f0ff";
        e.currentTarget.style.borderColor = "#667eea";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.backgroundColor = "#fff";
        e.currentTarget.style.borderColor = "#e0e0e0";
      }}
    >
                      <span style={{ fontSize: "16px", fontFamily: "Cambria Math, serif", fontWeight: 500 }}>
                        {tmpl.icon}
                      </span>
                      <span style={{ fontSize: "10px", color: "#666" }}>{tmpl.name}</span>
                    </button>)}
                  {
      /* Plain text segment */
    }
                  <button
      type="button"
      onClick={pickTextSegment}
      style={{
        padding: "10px 6px",
        border: "1px dashed #ccc",
        borderRadius: "8px",
        backgroundColor: "#fafafa",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "4px",
        transition: "all 0.15s"
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.backgroundColor = "#f0f0ff";
        e.currentTarget.style.borderColor = "#667eea";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.backgroundColor = "#fafafa";
        e.currentTarget.style.borderColor = "#ccc";
      }}
    >
                    <span style={{ fontSize: "16px" }}>Aa</span>
                    <span style={{ fontSize: "10px", color: "#666" }}>Văn bản</span>
                  </button>
                </div>
              </div>}

            {
      /* Add more segment button — show when template picker is not open */
    }
            {segments.length > 0 && !showTemplatePicker && <div style={{ display: "flex", justifyContent: "center", marginBottom: "10px" }}>
                <button
      type="button"
      onClick={() => openPickerAt(segments.length)}
      style={{
        padding: "6px 16px",
        fontSize: "12px",
        fontWeight: 600,
        border: "1px dashed #667eea",
        borderRadius: "18px",
        backgroundColor: "rgba(102,126,234,0.04)",
        color: "#667eea",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "4px",
        transition: "all 0.15s"
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.backgroundColor = "rgba(102,126,234,0.12)";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.backgroundColor = "rgba(102,126,234,0.04)";
      }}
    >
                  ＋ Thêm phần tử
                </button>
              </div>}

            {
      /* Hint */
    }
            <div style={{ fontSize: "11px", color: "#999", marginBottom: "10px" }}>
              Tab để chuyển ô · Ctrl+Enter để chèn · Hỗ trợ LaTeX trong ô (ví dụ: x+1, \alpha)
            </div>

            {
      /* Actions */
    }
            {segments.length > 0 && <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <button
      type="button"
      onClick={() => {
        setSegments([]);
        setShowTemplatePicker(false);
      }}
      style={{
        padding: "8px 16px",
        borderRadius: "6px",
        border: "1px solid #ddd",
        backgroundColor: "#fff",
        cursor: "pointer",
        fontSize: "13px",
        color: "#666"
      }}
    >
                  Xóa hết
                </button>
                <button
      type="button"
      onClick={handleInsertExpression}
      disabled={!fullLatex}
      style={{
        padding: "8px 20px",
        borderRadius: "6px",
        border: "none",
        background: fullLatex ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" : "#e0e0e0",
        color: fullLatex ? "#fff" : "#999",
        cursor: fullLatex ? "pointer" : "not-allowed",
        fontSize: "13px",
        fontWeight: 600
      }}
    >
                  Chèn công thức
                </button>
              </div>}
          </div>}

        {
      /* ═══ Raw LaTeX mode ═══ */
    }
        {mode === "latex" && <div>
            <textarea
      value={rawLatex}
      onChange={(e) => setRawLatex(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          handleInsertRawLatex();
        }
      }}
      placeholder="Nhập LaTeX trực tiếp, ví dụ: \frac{a}{b} + \sqrt{c}"
      autoFocus
      style={{
        width: "100%",
        minHeight: "60px",
        padding: "10px 12px",
        fontSize: "14px",
        fontFamily: 'Consolas, "Courier New", monospace',
        border: "2px solid #667eea",
        borderRadius: "8px",
        resize: "vertical",
        boxSizing: "border-box",
        outline: "none"
      }}
    />

            {rawLatex.trim() && <div style={{
      padding: "12px 16px",
      backgroundColor: "#fafafa",
      border: "1px solid #e8e8e8",
      borderRadius: "8px",
      marginTop: "10px",
      minHeight: "40px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }}>
                <div
      dangerouslySetInnerHTML={{ __html: renderKatex(rawLatex) }}
      style={{ fontSize: "1.3rem" }}
    />
              </div>}

            <div style={{ fontSize: "11px", color: "#999", marginTop: "8px" }}>
              Ctrl+Enter để chèn
            </div>

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "10px" }}>
              <button
      type="button"
      onClick={onClose}
      style={{
        padding: "8px 16px",
        borderRadius: "6px",
        border: "1px solid #ddd",
        backgroundColor: "#fff",
        cursor: "pointer",
        fontSize: "13px",
        color: "#666"
      }}
    >
                Hủy
              </button>
              <button
      type="button"
      onClick={handleInsertRawLatex}
      style={{
        padding: "8px 16px",
        borderRadius: "6px",
        border: "none",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        color: "#fff",
        cursor: "pointer",
        fontSize: "13px",
        fontWeight: 500
      }}
    >
                Chèn công thức
              </button>
            </div>
          </div>}
      </div>
    </div>,
    document.body
  );
}
export {
  SimpleMathKeyboard
};
