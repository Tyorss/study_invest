"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ChainData = unknown;

type EditorProps = {
  initialData?: unknown;
  onChange?: (data: unknown) => void;
};

const SAVE_DEBOUNCE_MS = 1200;

export function PersistedChain({
  sessionId,
  initialData,
  Editor,
}: {
  sessionId: number;
  initialData: ChainData;
  Editor: React.ComponentType<EditorProps>;
}) {
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<ChainData>(null as ChainData);
  const firstRun = useRef(true);

  // On unmount, flush pending save
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const flush = useCallback(async () => {
    const body = pending.current;
    if (!body) return;
    setSaving("saving");
    setErrMsg(null);
    try {
      const res = await fetch(`/api/home/sessions/${sessionId}/value-chain`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "save failed");
      }
      setSaving("saved");
      setTimeout(() => setSaving("idle"), 1800);
    } catch (e) {
      setSaving("error");
      setErrMsg(e instanceof Error ? e.message : "저장 실패");
    }
  }, [sessionId]);

  const handleChange = useCallback(
    (next: ChainData) => {
      // Skip the very first onChange that fires right after mount with initial data.
      if (firstRun.current) {
        firstRun.current = false;
        return;
      }
      pending.current = next;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
    },
    [flush],
  );

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          position: "absolute",
          top: 8,
          right: 12,
          zIndex: 50,
          fontSize: "0.7rem",
          color:
            saving === "error" ? "#991b1b" : saving === "saved" ? "#166534" : saving === "saving" ? "#737373" : "#a3a3a3",
          background: "rgba(255,255,255,0.85)",
          padding: "3px 8px",
          borderRadius: 2,
          pointerEvents: "none",
          letterSpacing: "0.05em",
        }}
      >
        {saving === "saving" && "저장 중…"}
        {saving === "saved" && "저장됨"}
        {saving === "error" && (errMsg ? `오류: ${errMsg}` : "저장 실패")}
        {saving === "idle" && ""}
      </div>
      <Editor initialData={initialData} onChange={handleChange} />
    </div>
  );
}
