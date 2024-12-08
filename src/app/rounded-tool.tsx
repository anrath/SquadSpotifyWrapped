"use client";
import { usePlausible } from "next-plausible";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { UploadBox } from "@/components/shared/upload-box";
// import { OptionSelector } from "@/components/shared/option-selector";
// import { BorderRadiusSelector } from "@/components/border-radius-selector";
import {
  useFileUploader,
  type FileUploaderResult,
} from "@/hooks/use-file-uploader";
import { FileDropzone } from "@/components/shared/file-dropzone";
import Tesseract from "tesseract.js";
import { Loader2 } from "lucide-react";

type Radius = number;

type BackgroundOption = "white" | "black" | "transparent";

type FileWithOCR = FileUploaderResult["files"][0] & {
  extractedText?: string;
  isProcessingOCR?: boolean;
};

type SpotifyData = {
  "Top Artists": string[];
  "Top Songs": string[];
} | null;

type TesseractResult = {
  data: {
    text: string;
  };
};

function parseSpotifyText(text: string): SpotifyData | string {
  const cleanText = text.replace(/\s+/g, " ").trim();

  if (!cleanText.includes("Top Artists Top Songs")) {
    return cleanText;
  }

  try {
    // Add newlines at key positions to normalize the text structure
    const normalizedText = cleanText
      .replace(/(\s*Top Artists Top Songs)/, "\n$1\n")
      .replace(/(\s*Minutes Listened)/, "\n$1")
      .replace(/(\s*1\s+[^\d]+\s+1\s+)/, "\n$1")
      .replace(/(\s*2\s+[^\d]+\s+2\s+)/, "\n$1")
      .replace(/(\s*3\s+[^\d]+\s+3\s+)/, "\n$1")
      .replace(/(\s*4\s+[^\d]+\s+4\s+)/, "\n$1")
      .replace(/(\s*5\s+[^\d]+\s+5\s+)/, "\n$1");

    const lines = normalizedText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const artists: string[] = [];
    const songs: string[] = [];

    const startIndex = lines.findIndex((line) =>
      line.includes("Top Artists Top Songs"),
    );
    if (startIndex === -1) return cleanText;

    for (let i = 1; i <= 5; i++) {
      const line = lines[startIndex + i];
      if (!line) continue;

      const parts = line.split(new RegExp(`${i}\\s+`)).filter(Boolean);
      if (parts?.[0] && parts?.[1]) {
        const artist = parts[0].replace(/^\d+\s*/, "").trim();
        const song = parts[1]
          .replace(/^\d+\s*/, "")
          .replace(/\.\.\.$/, "")
          .trim();

        artists.push(artist);
        songs.push(song);
      }
    }

    if (artists.length === 5 && songs.length === 5) {
      return {
        "Top Artists": artists,
        "Top Songs": songs,
      } as SpotifyData;
    }

    return cleanText;
  } catch (error) {
    console.error("Error parsing Spotify text:", error);
    return text;
  }
}

function useImageConverter(props: {
  canvas: HTMLCanvasElement | null;
  imageContent: string;
  radius: Radius;
  background: BackgroundOption;
  fileName?: string;
  imageMetadata: { width: number; height: number; name: string };
}) {
  const { width, height } = useMemo(() => {
    return {
      width: props.imageMetadata.width,
      height: props.imageMetadata.height,
    };
  }, [props.imageMetadata]);

  const convertToPng = async () => {
    const ctx = props.canvas?.getContext("2d");
    if (!ctx) throw new Error("Failed to get canvas context");

    const saveImage = () => {
      if (props.canvas) {
        const dataURL = props.canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = dataURL;
        const imageFileName = props.imageMetadata.name ?? "image_converted";
        link.download = `${imageFileName.replace(/\..+$/, "")}.png`;
        link.click();
      }
    };

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = props.background;
      ctx.fillRect(0, 0, width, height);
      ctx.beginPath();
      ctx.moveTo(props.radius, 0);
      ctx.lineTo(width - props.radius, 0);
      ctx.quadraticCurveTo(width, 0, width, props.radius);
      ctx.lineTo(width, height - props.radius);
      ctx.quadraticCurveTo(width, height, width - props.radius, height);
      ctx.lineTo(props.radius, height);
      ctx.quadraticCurveTo(0, height, 0, height - props.radius);
      ctx.lineTo(0, props.radius);
      ctx.quadraticCurveTo(0, 0, props.radius, 0);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, 0, 0, width, height);
      saveImage();
    };

    img.src = props.imageContent;
  };

  return {
    convertToPng,
    canvasProps: { width: width, height: height },
  };
}

interface ImageRendererProps {
  imageContent: string;
  radius: Radius;
  background: BackgroundOption;
  extractedText?: string | SpotifyData;
  isProcessingOCR?: boolean;
}

const ImageRenderer = ({
  imageContent,
  radius,
  background,
  extractedText,
  isProcessingOCR,
}: ImageRendererProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      const imgElement = containerRef.current.querySelector("img");
      if (imgElement) {
        imgElement.style.borderRadius = `${radius}px`;
      }
    }
  }, [imageContent, radius]);

  const renderExtractedText = () => {
    if (!extractedText) return null;

    if (typeof extractedText === "string") {
      return (
        <p className="whitespace-pre-wrap text-sm text-white/70">
          {extractedText}
        </p>
      );
    }

    return (
      <div className="space-y-4">
        <div>
          <h4 className="mb-2 font-medium text-white/90">Top Artists</h4>
          <ol className="list-inside list-decimal text-white/70">
            {extractedText["Top Artists"].map((artist, i) => (
              <li key={i}>{artist}</li>
            ))}
          </ol>
        </div>
        <div>
          <h4 className="mb-2 font-medium text-white/90">Top Songs</h4>
          <ol className="list-inside list-decimal text-white/70">
            {extractedText["Top Songs"].map((song, i) => (
              <li key={i}>{song}</li>
            ))}
          </ol>
        </div>
      </div>
    );
  };

  return (
    <div ref={containerRef} className="flex w-full flex-col gap-4">
      <div className="relative">
        <div
          className="absolute inset-0"
          style={{ backgroundColor: background, borderRadius: 0 }}
        />
        <img
          src={imageContent}
          alt="Preview"
          className="relative rounded-lg"
          style={{ width: "100%", height: "auto", objectFit: "contain" }}
        />
      </div>

      {isProcessingOCR && (
        <div className="text-sm text-white/70">Extracting text...</div>
      )}

      {extractedText && (
        <div className="rounded-lg bg-white/10 p-4">
          <h3 className="mb-2 text-sm font-medium text-white/80">
            Extracted Text:
          </h3>
          {renderExtractedText()}
        </div>
      )}
    </div>
  );
};

function SaveAsPngButton({
  imageContent,
  radius,
  background,
  imageMetadata,
}: {
  imageContent: string;
  radius: Radius;
  background: BackgroundOption;
  imageMetadata: { width: number; height: number; name: string };
}) {
  const [canvasRef, setCanvasRef] = useState<HTMLCanvasElement | null>(null);
  const { convertToPng, canvasProps } = useImageConverter({
    canvas: canvasRef,
    imageContent,
    radius,
    background,
    imageMetadata,
  });

  const plausible = usePlausible();

  return (
    <div>
      <canvas ref={setCanvasRef} {...canvasProps} hidden />
      <button
        onClick={() => {
          plausible("convert-image-to-png");
          void convertToPng();
        }}
        className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white shadow-md transition-colors duration-200 hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75"
      >
        Save as PNG
      </button>
    </div>
  );
}

function RoundedToolCore(props: { fileUploaderProps: FileUploaderResult }) {
  const {
    files: originalFiles,
    removeFile,
    handleFileUploadEvent,
    cancel,
    debug,
  } = props.fileUploaderProps;
  const [files, setFiles] = useState<FileWithOCR[]>([]);
  const [radius, setRadius] = useLocalStorage<Radius>("roundedTool_radius", 32);
  const [isCustomRadius, setIsCustomRadius] = useState(false);
  const [background, setBackground] = useLocalStorage<BackgroundOption>(
    "roundedTool_background",
    "transparent",
  );
  const [isAllOCRComplete, setIsAllOCRComplete] = useState(false);
  const [playlistId, setPlaylistId] = useState<string>("");
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);

  useEffect(() => {
    setFiles(
      originalFiles.map((file) => ({
        ...file,
        extractedText: undefined,
        isProcessingOCR: false,
      })),
    );
  }, [originalFiles]);

  useEffect(() => {
    const processOCR = async (file: FileWithOCR, index: number) => {
      if (file.extractedText || file.isProcessingOCR) return;

      setFiles((prev) =>
        prev.map((f, i) => (i === index ? { ...f, isProcessingOCR: true } : f)),
      );

      try {
        const result = (await Tesseract.recognize(
          file.imageContent,
          "eng",
        )) as TesseractResult;

        if (result?.data?.text) {
          const parsedText = parseSpotifyText(result.data.text);

          setFiles((prev) =>
            prev.map((f, i) =>
              i === index
                ? {
                    ...f,
                    extractedText: parsedText,
                    isProcessingOCR: false,
                  }
                : f,
            ),
          );
        }
      } catch (error) {
        console.error("OCR failed:", error);
        setFiles((prev) =>
          prev.map((f, i) =>
            i === index ? { ...f, isProcessingOCR: false } : f,
          ),
        );
      }
    };

    const updateOCRStatus = () => {
      const allComplete = files.every(
        (file) => file.extractedText !== undefined && !file.isProcessingOCR,
      );
      setIsAllOCRComplete(allComplete);
    };

    files.forEach((file, index) => {
      void processOCR(file, index);
    });

    updateOCRStatus();
  }, [files]);

  const handleCreatePlaylist = async () => {
    setIsCreatingPlaylist(true);

    const spotifyData = files
      .map((file) => file.extractedText)
      .filter(
        (text): text is SpotifyData =>
          text !== undefined && typeof text === "object" && text !== null,
      );

    try {
      if (debug) {
        setPlaylistId("1GAY52k57voj0tyjYVGWaP");
      } else {
        const response = await fetch("/api/spotify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ data: spotifyData }),
        });
        const result = (await response.json()) as { playlistId: string };
        setPlaylistId(result.playlistId);
      }
    } catch (error) {
      console.error("Failed to create playlist:", error);
    } finally {
      setIsCreatingPlaylist(false);
    }
  };

  // const handleRadiusChange = (value: number | "custom") => {
  //   if (value === "custom") {
  //     setIsCustomRadius(true);
  //   } else {
  //     setRadius(value);
  //     setIsCustomRadius(false);
  //   }
  // };

  if (files.length === 0) {
    return (
      <UploadBox
        title="Add your friends' Spotify Wrapped images (with their top artists and songs) and a playlist will be generated in ~10 seconds. Quick and easy."
        subtitle="Upload up to 10 images at once. Allows pasting images from clipboard"
        description="Upload Images"
        accept="image/*"
        multiple
        onChange={handleFileUploadEvent}
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-[95vw] flex-col items-center justify-center gap-6 p-6">
      {isCreatingPlaylist ? (
        <div className="flex flex-col items-center gap-2 text-white/80">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p>Creating your playlist... This may take up to 15 seconds.</p>
        </div>
      ) : (
        playlistId && (
          <div className="w-full space-y-4">
            <iframe
              style={{ borderRadius: "12px" }}
              src={`https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator&theme=0`}
              width="100%"
              height="352"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
            ></iframe>
            <p className="text-center text-sm text-red-500">
              This playlist may be deleted in the future. Please make a copy for
              yourself if you&apos;d like to keep it.
            </p>
          </div>
        )
      )}

      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-3">
          <button
            onClick={cancel}
            className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-red-800"
          >
            Cancel
          </button>
          <button
            onClick={handleCreatePlaylist}
            disabled={
              files.length < 2 || !isAllOCRComplete || isCreatingPlaylist
            }
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Generate Playlist
          </button>
        </div>

        {files.length < 2 && (
          <p className="text-sm text-yellow-400">
            Please upload at least 2 images to generate a playlist
          </p>
        )}

        {files.length >= 2 && !isAllOCRComplete && (
          <div className="flex items-center gap-2 text-white/80">
            <Loader2 className="h-4 w-4 animate-spin" />
            <p className="text-sm">Processing images...</p>
          </div>
        )}
      </div>

      <div className="grid w-full place-items-center gap-4">
        <div
          className={`grid gap-4 ${
            files.length === 1
              ? "w-full min-w-[20rem] sm:w-1/2 md:w-1/3 lg:w-1/4"
              : files.length === 2
                ? "w-full grid-cols-1 sm:grid-cols-2 md:w-2/3 lg:w-1/2"
                : files.length === 3
                  ? "w-full grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:w-3/4"
                  : "w-full grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
          }`}
        >
          {files.map((file, index) => (
            <div
              key={file.imageMetadata.name + index}
              className="relative w-full"
            >
              <div className="flex w-full flex-col items-center gap-4 rounded-xl p-4">
                <ImageRenderer
                  imageContent={file.imageContent}
                  radius={radius}
                  background={background}
                  extractedText={file.extractedText}
                  isProcessingOCR={file.isProcessingOCR}
                />
                <div className="flex items-center gap-2">
                  <p className="max-w-[12rem] truncate text-sm font-medium text-white/80">
                    {file.imageMetadata.name}
                  </p>
                  <button
                    onClick={() => removeFile(index)}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-red-700 text-white/90 hover:bg-red-800"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function RoundedTool() {
  const fileUploaderProps = useFileUploader(false);

  return (
    <FileDropzone
      setCurrentFiles={fileUploaderProps.handleFileUpload}
      acceptedFileTypes={["image/*", ".jpg", ".jpeg", ".png", ".webp", ".svg"]}
      dropText="Drop image files"
      maxFiles={10}
    >
      <RoundedToolCore fileUploaderProps={fileUploaderProps} />
    </FileDropzone>
  );
}
