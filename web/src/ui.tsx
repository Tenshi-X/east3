import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { icons } from "./icons";
import { invalidateData } from "./api";
export type IconName = keyof typeof icons;
export function Icon({ name }: { name: IconName }) {
  return (
    <span
      className="icon"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: icons[name] }}
    />
  );
}
export function Button({
  children,
  variant = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) {
  return (
    <button
      type="button"
      {...props}
      className={`btn ${variant} ${props.className || ""}`}
    >
      {children}
    </button>
  );
}
export function IconButton({
  icon,
  label,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: IconName;
  label: string;
}) {
  return (
    <button
      type="button"
      {...props}
      className={`icon-button ${props.className || ""}`}
      aria-label={label}
    >
      <Icon name={icon} />
    </button>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  if (!message) return null;
  return (
    <div className="error-state" role="alert">
      <span>{message}</span>
      {onRetry && (
        <Button variant="text" onClick={onRetry}>
          Coba lagi
        </Button>
      )}
    </div>
  );
}
export function EmptyState({
  title,
  children,
  icon = "check_circle",
}: {
  title: string;
  children?: ReactNode;
  icon?: IconName;
}) {
  return (
    <div className="empty-state">
      <Icon name={icon} />
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}
export function LoadingState() {
  return (
    <div className="skeletons" role="status" aria-label="Memuat">
      <div />
      <div />
      <div />
    </div>
  );
}
export function ProgressRing({
  value,
  total,
  label,
}: {
  value: number;
  total: number;
  label: string;
}) {
  const ratio = total > 0 ? Math.max(0, Math.min(1, value / total)) : 0;
  return (
    <div
      className="progress-ring"
      role="img"
      aria-label={`${label}: ${value} dari ${total}`}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="ring-track" cx="50" cy="50" r="42" />
        <circle
          className="ring-value"
          opacity={ratio > 0 ? 1 : 0}
          cx="50"
          cy="50"
          r="42"
          pathLength="100"
          strokeDasharray={`${ratio * 100} 100`}
        />
      </svg>
      <span aria-hidden="true">
        <strong>
          {value}
          <small>/{total}</small>
        </strong>
        <span>selesai</span>
      </span>
    </div>
  );
}
export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="section">
      <div className="section-heading">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Segments<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segments" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
const modalStack: HTMLDialogElement[] = [];
export function closeTopOverlay() {
  const dialog = modalStack[modalStack.length - 1];
  if (!dialog) return false;
  dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
  return true;
}
export function Modal({
  open,
  title,
  onClose,
  children,
  full = false,
  busy = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  full?: boolean;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useId();
  useEffect(() => {
    const dialog = ref.current!;
    if (open) {
      dialog.showModal();
      modalStack.push(dialog);
    } else if (dialog.open) dialog.close();
    return () => {
      const index = modalStack.indexOf(dialog);
      if (index >= 0) modalStack.splice(index, 1);
      if (dialog.open) dialog.close();
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`modal ${full ? "editor" : "sheet"}`}
      aria-labelledby={heading}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="modal-surface">
        <header className="modal-header">
          <h2 id={heading}>{title}</h2>
          <IconButton
            icon="close"
            label="Tutup"
            onClick={onClose}
            disabled={busy}
          />
        </header>
        <div className="modal-content">{children}</div>
      </div>
    </dialog>
  );
}
export function useCreatePanel(path: string, value = "1") {
  const loc = useLocation();
  const [params, setParams] = useSearchParams();
  const open = loc.pathname === path && params.get("new") === value;
  const close = () => {
    const next = new URLSearchParams(params);
    next.delete("new");
    next.delete("kind");
    next.delete("type");
    setParams(next, { replace: true });
  };
  return { open, close };
}
type Feedback = {
  notify: (message: string) => void;
  confirm: (title: string) => Promise<boolean>;
};
const FeedbackContext = createContext<Feedback>({
  notify: () => {},
  confirm: async () => false,
});
export const useFeedback = () => useContext(FeedbackContext);
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState("");
  const [confirmation, setConfirmation] = useState<{
    title: string;
    resolve: (v: boolean) => void;
  } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timeout);
  }, [toast]);
  const finish = (result: boolean) => {
    confirmation?.resolve(result);
    setConfirmation(null);
  };
  return (
    <FeedbackContext.Provider
      value={{
        notify: setToast,
        confirm: (title) =>
          new Promise((resolve) => setConfirmation({ title, resolve })),
      }}
    >
      {children}
      <div
        className="snackbar"
        role="status"
        aria-live="polite"
        hidden={!toast}
      >
        {toast}
      </div>
      <Modal
        open={!!confirmation}
        title={confirmation?.title || "Konfirmasi"}
        onClose={() => finish(false)}
      >
        <p>Data yang dihapus tidak dapat dikembalikan.</p>
        <div className="form-actions">
          <Button variant="text" onClick={() => finish(false)}>
            Batal
          </Button>
          <Button variant="danger" onClick={() => finish(true)}>
            Hapus
          </Button>
        </div>
      </Modal>
    </FeedbackContext.Provider>
  );
}
export function Fab({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <div className="fab-dock">
      <button className="fab" type="button" onClick={onClick}>
        <Icon name="add" />
        <span>{label}</span>
      </button>
    </div>
  );
}
export function Form({
  onSubmit,
  children,
}: {
  onSubmit: () => void | Promise<void>;
  children: ReactNode;
}) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void onSubmit();
  };
  return (
    <form className="form" onSubmit={submit}>
      {children}
    </form>
  );
}
export const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : "Terjadi kesalahan. Coba lagi.";
export function changed() {
  invalidateData();
  window.dispatchEvent(new Event("atlas:data"));
}
export function usePageLoad(path: string, load: () => void | Promise<void>) {
  const loc = useLocation();
  useEffect(() => {
    // Visited pages stay mounted to preserve their UI, but only the visible page
    // refreshes. Returning to a hidden page fetches its current data then.
    if (loc.pathname !== path) return;
    let active = true;
    let running = false;
    let queued = false;
    const refresh = async () => {
      if (running) {
        queued = true;
        return;
      }
      running = true;
      try {
        do {
          queued = false;
          await load();
        } while (active && queued);
      } finally {
        running = false;
      }
    };
    const onChange = () => {
      void refresh();
    };
    window.addEventListener("atlas:data", onChange);
    void refresh();
    return () => {
      active = false;
      window.removeEventListener("atlas:data", onChange);
    };
  }, [loc.pathname, path, load]);
}
