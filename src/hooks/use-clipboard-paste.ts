"use client";

import { useEffect, useCallback } from "react";

interface UseClipboardPasteProps {
  onPaste: (files: File[]) => void;
  acceptedFileTypes: string[];
}

export function useClipboardPaste({
  onPaste,
  acceptedFileTypes,
}: UseClipboardPasteProps) {
  const handlePaste = useCallback(
    async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      const pastedFiles: File[] = [];

      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (!file) continue;

          const isAcceptedType = acceptedFileTypes.some(
            (type) =>
              type === "image/*" ||
              type === item.type ||
              file.name.toLowerCase().endsWith(type.replace("*", "")),
          );

          if (isAcceptedType) {
            pastedFiles.push(file);
          }
        }
      }

      if (pastedFiles.length > 0) {
        event.preventDefault();
        onPaste(pastedFiles);
      }
    },
    [onPaste, acceptedFileTypes],
  );

  useEffect(() => {
    const handler = (event: ClipboardEvent) => {
      void handlePaste(event);
    };

    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, [handlePaste]);
}
