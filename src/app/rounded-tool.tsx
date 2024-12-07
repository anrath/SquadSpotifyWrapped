"use client";
import { usePlausible } from "next-plausible";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { UploadBox } from "@/components/shared/upload-box";
import { OptionSelector } from "@/components/shared/option-selector";
import { BorderRadiusSelector } from "@/components/border-radius-selector";
import {
  useFileUploader,
  type FileUploaderResult,
} from "@/hooks/use-file-uploader";
import { FileDropzone } from "@/components/shared/file-dropzone";
import Tesseract from 'tesseract.js';

type Radius = number;

type BackgroundOption = "white" | "black" | "transparent";

type FileWithOCR = FileUploaderResult['files'][0] & {
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
  const cleanText = text.replace(/\s+/g, ' ').trim();

  if (!cleanText.includes('Top Artists Top Songs')) {
    return cleanText;
  }

  try {
    // Add newlines at key positions to normalize the text structure
    const normalizedText = cleanText
      .replace(/(\s*Top Artists Top Songs)/, '\n$1\n')
      .replace(/(\s*Minutes Listened)/, '\n$1')
      .replace(/(\s*1\s+[^\d]+\s+1\s+)/, '\n$1')
      .replace(/(\s*2\s+[^\d]+\s+2\s+)/, '\n$1')
      .replace(/(\s*3\s+[^\d]+\s+3\s+)/, '\n$1')
      .replace(/(\s*4\s+[^\d]+\s+4\s+)/, '\n$1')
      .replace(/(\s*5\s+[^\d]+\s+5\s+)/, '\n$1');

    const lines = normalizedText.split('\n').map(line => line.trim()).filter(Boolean);
    const artists: string[] = [];
    const songs: string[] = [];

    const startIndex = lines.findIndex(line => line.includes('Top Artists Top Songs'));
    if (startIndex === -1) return cleanText;

    for (let i = 1; i <= 5; i++) {
      const line = lines[startIndex + i];
      if (!line) continue;

      const parts = line.split(new RegExp(`${i}\\s+`)).filter(Boolean);
      if (parts?.[0] && parts?.[1]) {
        const artist = parts[0].replace(/^\d+\s*/, '').trim();
        const song = parts[1]
          .replace(/^\d+\s*/, '')
          .replace(/\.\.\.$/, '')
          .trim();

        artists.push(artist);
        songs.push(song);
      }
    }

    if (artists.length === 5 && songs.length === 5) {
      return {
        "Top Artists": artists,
        "Top Songs": songs
      } as SpotifyData;
    }

    return cleanText;
  } catch (error) {
    console.error('Error parsing Spotify text:', error);
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

    if (typeof extractedText === 'string') {
      return (
        <p className="text-white/70 text-sm whitespace-pre-wrap">{extractedText}</p>
      );
    }

    return (
      <div className="space-y-4">
        <div>
          <h4 className="text-white/90 font-medium mb-2">Top Artists</h4>
          <ol className="list-decimal list-inside text-white/70">
            {extractedText["Top Artists"].map((artist, i) => (
              <li key={i}>{artist}</li>
            ))}
          </ol>
        </div>
        <div>
          <h4 className="text-white/90 font-medium mb-2">Top Songs</h4>
          <ol className="list-decimal list-inside text-white/70">
            {extractedText["Top Songs"].map((song, i) => (
              <li key={i}>{song}</li>
            ))}
          </ol>
        </div>
      </div>
    );
  };

  return (
    <div ref={containerRef} className="flex flex-col gap-4 w-[500px]">
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
        <div className="text-white/70 text-sm">Extracting text...</div>
      )}
      
      {extractedText && (
        <div className="bg-white/10 rounded-lg p-4">
          <h3 className="text-white/80 text-sm font-medium mb-2">Extracted Text:</h3>
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
  const { files: originalFiles, removeFile, handleFileUploadEvent, cancel } = props.fileUploaderProps;
  const [files, setFiles] = useState<FileWithOCR[]>([]);
  const [radius, setRadius] = useLocalStorage<Radius>("roundedTool_radius", 2);
  const [isCustomRadius, setIsCustomRadius] = useState(false);
  const [background, setBackground] = useLocalStorage<BackgroundOption>(
    "roundedTool_background",
    "transparent",
  );

  useEffect(() => {
    setFiles(originalFiles.map(file => ({ ...file, extractedText: undefined, isProcessingOCR: false })));
  }, [originalFiles]);

  useEffect(() => {
    const processOCR = async (file: FileWithOCR, index: number) => {
      if (file.extractedText || file.isProcessingOCR) return;

      setFiles(prev => prev.map((f, i) => 
        i === index ? { ...f, isProcessingOCR: true } : f
      ));

      try {
        const result = await Tesseract.recognize(
          file.imageContent,
          'eng'
        ) as TesseractResult;

        if (result?.data?.text) {
          const parsedText = parseSpotifyText(result.data.text);
          
          setFiles(prev => prev.map((f, i) => 
            i === index ? { ...f, extractedText: parsedText, isProcessingOCR: false } : f
          ) as FileWithOCR[]);
        }
      } catch (error) {
        console.error('OCR failed:', error);
        setFiles(prev => prev.map((f, i) => 
          i === index ? { ...f, isProcessingOCR: false } : f
        ) as FileWithOCR[]);
      }
    };

    files.forEach((file, index) => {
      void processOCR(file, index);
    });
  }, [files.length]);

  const handleRadiusChange = (value: number | "custom") => {
    if (value === "custom") {
      setIsCustomRadius(true);
    } else {
      setRadius(value);
      setIsCustomRadius(false);
    }
  };

  if (files.length === 0) {
    return (
      <UploadBox
        title="Add rounded borders to your images. Quick and easy."
        subtitle="Upload up to 10 images at once. Allows pasting images from clipboard"
        description="Upload Images"
        accept="image/*"
        multiple
        onChange={handleFileUploadEvent}
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-6 p-6">
      {files.map((file, index) => (
        <div key={file.imageMetadata.name + index} className="relative w-full">
          <div className="flex w-full flex-col items-center gap-4 rounded-xl p-6">
            <ImageRenderer
              imageContent={file.imageContent}
              radius={radius}
              background={background}
              extractedText={file.extractedText}
              isProcessingOCR={file.isProcessingOCR}
            />
            <div className="flex items-center gap-2">
              <p className="text-lg font-medium text-white/80">
                {file.imageMetadata.name}
              </p>
              <button
                onClick={() => removeFile(index)}
                className="rounded-full bg-red-700 w-6 h-6 flex items-center justify-center text-white/90 hover:bg-red-800"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      ))}

      <div className="flex flex-col items-center rounded-lg bg-white/5 p-3">
        <span className="text-sm text-white/60">Original Size</span>
        <span className="font-medium text-white">
          {files[0]?.imageMetadata.width} × {files[0]?.imageMetadata.height}
        </span>
      </div>

      <BorderRadiusSelector
        title="Border Radius"
        options={[2, 4, 8, 16, 32, 64]}
        selected={isCustomRadius ? "custom" : radius}
        onChange={handleRadiusChange}
        customValue={radius}
        onCustomValueChange={setRadius}
      />

      <OptionSelector
        title="Background"
        options={["white", "black", "transparent"]}
        selected={background}
        onChange={setBackground}
        formatOption={(option) =>
          option.charAt(0).toUpperCase() + option.slice(1)
        }
      />

      <div className="flex gap-3">
        <button
          onClick={cancel}
          className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-red-800"
        >
          Cancel
        </button>
        {files.map((file, index) => (
          <SaveAsPngButton
            key={file.imageMetadata.name + index}
            imageContent={file.imageContent}
            radius={radius}
            background={background}
            imageMetadata={file.imageMetadata}
          />
        ))}
      </div>
    </div>
  );
}

export function RoundedTool() {
  const fileUploaderProps = useFileUploader();

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
