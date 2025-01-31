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

const normalizeText = (text: string, header: string) => {
  return text
    .replace(new RegExp(`.*?(\\s*${header})`), "$1\n")
    .replace(/(\s{1,}1\s{1,})/, "\n$1")
    .replace(/(\s{1,}2\s{1,})/, "\n$1")
    .replace(/(\s{1,}3\s{1,})/, "\n$1")
    .replace(/(\s{1,}4\s{1,})/, "\n$1")
    .replace(/(\s{1,}5\s{1,})/, "\n$1")
    .replace(/(\s{1,}6\s{1,})/, "\n$1");
};

function parseSpotifyText(
  leftText: string,
  rightText: string,
): SpotifyData | string {
  const cleanText = (text: string) => text.replace(/\s+/g, " ").trim();
  const cleanLeftText = cleanText(leftText);
  const cleanRightText = cleanText(rightText);

  if (
    !cleanLeftText.includes("Top Artists") ||
    !cleanRightText.includes("Top Songs")
  ) {
    return cleanLeftText + "\n\n" + cleanRightText;
  }

  try {

    const processLines = (text: string) => {
      return text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    };

    const normalizedLeftText = normalizeText(cleanLeftText, "Top Artists");
    const normalizedRightText = normalizeText(cleanRightText, "Top Songs");

    // console.log("cleanLeftText", cleanLeftText);
    // console.log("normalizedLeftText", normalizedLeftText);

    // console.log("cleanRightText", cleanRightText);
    // console.log("normalizedRightText", normalizedRightText);

    const leftLines = processLines(normalizedLeftText);
    const rightLines = processLines(normalizedRightText);

    const artists: string[] = [];
    const songs: string[] = [];

    const findStartIndex = (lines: string[], header: string) => {
      return lines.findIndex((line) => line.includes(header));
    };

    const artistStartIndex = findStartIndex(leftLines, "Top Artists");
    const songStartIndex = findStartIndex(rightLines, "Top Songs");

    if (artistStartIndex === -1 || songStartIndex === -1) {
      return cleanLeftText + " " + cleanRightText;
    }

    const extractItem = (line: string) => line?.replace(/^\d+\s*/, "").trim();

    for (let i = 1; i <= 5; i++) {
      const artistLine = leftLines[artistStartIndex + i];
      const songLine = rightLines[songStartIndex + i];

      if (artistLine) {
        artists.push(extractItem(artistLine));
      }

      if (songLine) {
        songs.push(extractItem(songLine));
      }
    }

    if (artists.length === 5 && songs.length === 5) {
      return {
        "Top Artists": artists,
        "Top Songs": songs,
      } as SpotifyData;
    }

    return cleanLeftText + " " + cleanRightText;
  } catch (error) {
    console.error("Error parsing Spotify text:", error);
    return leftText + " " + rightText;
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

function WrappedToolCore(props: { fileUploaderProps: FileUploaderResult }) {
  const {
    files: originalFiles,
    removeFile,
    handleFileUploadEvent,
    cancel,
    debug,
  } = props.fileUploaderProps;
  const [files, setFiles] = useState<FileWithOCR[]>([]);
  const [radius, setRadius] = useLocalStorage<Radius>("WrappedTool_radius", 32);
  const [isCustomRadius, setIsCustomRadius] = useState(false);
  const [background, setBackground] = useLocalStorage<BackgroundOption>(
    "WrappedTool_background",
    "transparent",
  );
  const [isAllOCRComplete, setIsAllOCRComplete] = useState(false);
  const [playlistId, setPlaylistId] = useState<string>("");
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(
    "Creating your playlist...",
  );
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);

  const loadingMessages = [
    "Creating your playlist...",
    "Finding your songs...",
    "Merging your tastes...",
    "Curating the perfect mix...",
    "Almost there...",
  ];

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
        const { createWorker } = Tesseract;
        const worker = await createWorker("eng");

        // Get image dimensions
        const img = new Image();
        img.src = file.imageContent;
        await new Promise((resolve) => (img.onload = resolve));

        const width = img.width;
        const height = img.height;
        const halfWidth = Math.floor(width / 2);

        // Process left half of top 75%
        const leftResult = (await worker.recognize(file.imageContent, {
          rectangle: { top: 0, left: 0, width: halfWidth, height: Math.floor(height * 0.75) },
        })) as TesseractResult;

        // Process right half of top 75%
        const rightResult = (await worker.recognize(file.imageContent, {
          rectangle: { top: 0, left: halfWidth, width: halfWidth, height: Math.floor(height * 0.75) },
        })) as TesseractResult;

        await worker.terminate();

        const parsedText = parseSpotifyText(
          leftResult.data.text,
          rightResult.data.text,
        );

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

  useEffect(() => {
    if (!isCreatingPlaylist) return;

    let currentIndex = 0;
    const interval = setInterval(() => {
      currentIndex = Math.min(currentIndex + 1, loadingMessages.length - 1);
      setLoadingMessage(loadingMessages[currentIndex]);
    }, 4500);

    return () => clearInterval(interval);
  }, [isCreatingPlaylist]);

  const handleCreatePlaylist = async () => {
    setPlaylistId("");
    setError(null);
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

        if (!response.ok) {
          const errorData = await response.json() as { error: string };
          throw new Error(errorData.error || 'Failed to create playlist');
        }

        const result = (await response.json()) as { playlistId: string };
        setPlaylistId(result.playlistId);
      }
    } catch (error) {
      console.error("Failed to create playlist:", error);
      setError({
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        code: undefined
      });
    } finally {
      setIsCreatingPlaylist(false);
      setLoadingMessage(loadingMessages[0] ?? "");
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
        title="Add your friends' Spotify Wrapped images (with their top artists and songs) and a playlist will be generated. Quick and easy."
        subtitle="Upload up to 5 images at once. Allows pasting images from clipboard"
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
          <p className="transition-opacity duration-300">{loadingMessage}</p>
        </div>
      ) : error ? (
        <div className="mx-auto max-w-[500px] space-y-4 rounded-lg border border-red-500/50 bg-red-500/10 p-6 text-center">
          <h3 className="text-lg font-semibold text-red-400">Failed to Create Playlist</h3>
          <p className="text-red-300">{error.message}</p>
          {error.code && (
            <p className="text-sm text-red-300/70">Error Code: {error.code}</p>
          )}
          <button
            onClick={() => setError(null)}
            className="mt-4 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/30"
          >
            Dismiss
          </button>
        </div>
      ) : playlistId && (
        <div className="mx-auto max-w-[500px] space-y-4">
          <iframe
            style={{ borderRadius: "12px" }}
            src={`https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator&theme=0`}
            width="100%"
            height="500"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          ></iframe>
          <p className="text-center text-sm text-red-500">
            This playlist may be deleted in the future. Please make a copy for
            yourself if you&apos;d like to keep it.
          </p>
        </div>
      )}

      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-3">
          <button
            onClick={() => {
              cancel();
              setPlaylistId("");
            }}
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

export function WrappedTool( {debug = false} ) {
  const fileUploaderProps = useFileUploader(debug);
  const [testInput, setTestInput] = useState('');
  const [testHeader, setTestHeader] = useState('');
  const [testResult, setTestResult] = useState('');

  const handleTest = () => {
    const result = normalizeText(testInput, testHeader);
    setTestResult(result);
  };

  return (
    <div>
      <FileDropzone
        setCurrentFiles={fileUploaderProps.handleFileUpload}
        acceptedFileTypes={["image/*", ".jpg", ".jpeg", ".png", ".webp", ".svg"]}
        dropText="Drop image files"
        maxFiles={5}
      >
        <WrappedToolCore fileUploaderProps={fileUploaderProps} />
      </FileDropzone>
      
      {debug && <div className="mt-8 p-4 border rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Regex Tester</h3>
        <div className="space-y-4">
          <div>
            <label className="block mb-2">Header Text:</label>
            <input
              type="text"
              value={testHeader}
              onChange={(e) => setTestHeader(e.target.value)}
              className="w-full p-2 border rounded bg-black"
              placeholder="Enter header text"
            />
          </div>
          <div>
            <label className="block mb-2">Test Input:</label>
            <textarea
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              className="w-full p-2 border rounded h-32"
              placeholder="Enter text to test"
              style={{ backgroundColor: "black" }}
            />
          </div>
          <button
            onClick={handleTest}
            className="bg-blue-500 px-4 py-2 rounded hover:bg-blue-600"
          >
            Test Regex
          </button>
          {testResult && (
            <div>
              <label className="block mb-2">Result:</label>
              <pre className="w-full p-2 border rounded whitespace-pre-wrap">
                {testResult}
              </pre>
            </div>
          )}
        </div>
      </div>}
    </div>
  );
}
