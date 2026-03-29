export type ToastType = "error" | "success" | "info";

export function showToast(message: string, type: ToastType = "error") {
  window.dispatchEvent(
    new CustomEvent("show-toast", { detail: { message, type } })
  );
}
