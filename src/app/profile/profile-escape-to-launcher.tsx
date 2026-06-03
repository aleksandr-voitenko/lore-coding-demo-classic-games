"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.closest("input, textarea, select") !== null
  );
}

export function ProfileEscapeToLauncher() {
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      event.preventDefault();
      router.push("/");
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  return null;
}
