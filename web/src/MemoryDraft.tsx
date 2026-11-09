import { useState } from "react";
import { api } from "./api";
import { Button, changed, ErrorState, messageOf } from "./ui";
export default function MemoryDraft({ draft }: { draft: any }) {
  const [content, setContent] = useState(draft.content),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="personal-stack">
      <label className="field">
        <span>Usulan memori</span>
        <textarea
          maxLength={2000}
          value={content}
          disabled={saved || busy}
          onChange={(e) => setContent(e.target.value)}
        />
      </label>
      <Button
        disabled={busy || saved || !content.trim()}
        onClick={async () => {
          setBusy(true);
          try {
            await api.personal("memory", { ...draft, content });
            setSaved(true);
            changed();
          } catch (e) {
            setError(messageOf(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {saved ? "Memori tersimpan" : busy ? "Menyimpan…" : "Simpan memori"}
      </Button>
      <ErrorState message={error} />
    </div>
  );
}
