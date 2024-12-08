import { useCallback } from "react";
import { type ChangeEvent, useState } from "react";
import { useClipboardPaste } from "./use-clipboard-paste";

const parseSvgFile = (content: string, fileName: string) => {
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(content, "image/svg+xml");
  const svgElement = svgDoc.documentElement;
  const width = parseInt(svgElement.getAttribute("width") ?? "300");
  const height = parseInt(svgElement.getAttribute("height") ?? "150");

  // Convert SVG content to a data URL
  const svgBlob = new Blob([content], { type: "image/svg+xml" });
  const svgUrl = URL.createObjectURL(svgBlob);

  return {
    content: svgUrl,
    metadata: {
      width,
      height,
      name: fileName,
    },
  };
};

const parseImageFile = (
  content: string,
  fileName: string,
): Promise<{
  content: string;
  metadata: { width: number; height: number; name: string };
}> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        content,
        metadata: {
          width: img.width,
          height: img.height,
          name: fileName,
        },
      });
    };
    img.src = content;
  });
};

export type FileUploadItem = {
  imageContent: string;
  rawContent: string;
  imageMetadata: {
    width: number;
    height: number;
    name: string;
  };
};

export type FileUploaderResult = {
  files: FileUploadItem[];
  handleFileUpload: (files: File[]) => Promise<void>;
  handleFileUploadEvent: (event: ChangeEvent<HTMLInputElement>) => void;
  cancel: () => void;
  removeFile: (index: number) => void;
  debug: boolean;
};

/**
 * A hook for handling file uploads, particularly images and SVGs
 * @returns {FileUploaderResult} An object containing:
 * - files: Array of processed image content as data URLs (for regular images) or object URLs (for SVGs)
 * - handleFileUpload: Function to handle file input change events
 * - cancel: Function to reset the upload state
 * - removeFile: Function to remove a file from the upload list
 * - debug: Boolean flag to enable debug mode
 */
export const useFileUploader = (debug = false): FileUploaderResult => {
  const [files, setFiles] = useState<FileUploadItem[]>([]);

  const processFile = async (file: File): Promise<FileUploadItem> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as string;

        if (file.type === "image/svg+xml") {
          const { content: svgContent, metadata } = parseSvgFile(content, file.name);
          resolve({
            imageContent: svgContent,
            rawContent: content,
            imageMetadata: metadata,
          });
        } else {
          const { content: imgContent, metadata } = await parseImageFile(content, file.name);
          resolve({
            imageContent: imgContent,
            rawContent: content,
            imageMetadata: metadata,
          });
        }
      };

      if (file.type === "image/svg+xml") {
        reader.readAsText(file);
      } else {
        reader.readAsDataURL(file);
      }
    });
  };

  const handleFileUpload = useCallback(async (newFiles: File[]) => {
    const processedFiles = await Promise.all(
      newFiles.slice(0, 10 - files.length).map(processFile)
    );
    setFiles((current) => [...current, ...processedFiles].slice(0, 10));
  }, [files.length]);

  const handleFileUploadEvent = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(event.target.files ?? []);
    if (fileList.length > 0) {
      void handleFileUpload(fileList);
    }
  }, [handleFileUpload]);

  const handleFilePaste = useCallback((files: File[]) => {
    void handleFileUpload(files);
  }, [handleFileUpload]);

  useClipboardPaste({
    onPaste: handleFilePaste,
    acceptedFileTypes: ["image/*", ".jpg", ".jpeg", ".png", ".webp", ".svg"],
  });

  const cancel = useCallback(() => {
    setFiles([]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((current) => current.filter((_, i) => i !== index));
  }, []);

  return {
    files,
    handleFileUpload,
    handleFileUploadEvent,
    cancel,
    removeFile,
    debug,
  };
};
