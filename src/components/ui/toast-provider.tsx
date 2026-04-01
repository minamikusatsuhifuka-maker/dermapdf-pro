"use client";

import { toast } from "sonner";

export function toastOk(message: string) {
  toast.success(message, { duration: 8000 });
}

export function toastError(message: string) {
  toast.error(message, { duration: Infinity });
}

export function toastInfo(message: string) {
  toast.info(message, { duration: Infinity });
}
