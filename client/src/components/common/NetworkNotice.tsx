import { useEffect, useState } from "react";
export function NetworkNotice() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    const network = (event: Event) =>
      setMessage((event as CustomEvent<string>).detail);
    const offline = () =>
      setMessage("You are offline. Changes cannot be saved.");
    const online = () =>
      setMessage("Connection restored. Retry loading your records.");
    window.addEventListener("viora:network", network);
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("viora:network", network);
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, []);
  return message ? (
    <div
      role="status"
      className="fixed bottom-4 left-4 right-4 z-[100] rounded-xl bg-slate-900 text-white p-4 shadow-xl flex justify-between gap-4"
    >
      <span>{message}</span>
      <button
        aria-label="Dismiss connection notice"
        onClick={() => setMessage("")}
      >
        Dismiss
      </button>
    </div>
  ) : null;
}
