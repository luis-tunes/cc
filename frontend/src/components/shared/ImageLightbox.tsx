import { useEffect, useCallback, useState, useRef } from "react";
import { X, ZoomIn, ZoomOut, RotateCw, Download, Maximize2 } from "lucide-react";

interface ImageLightboxProps {
  src: string;
  alt: string;
  open: boolean;
  onClose: () => void;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.3;

export function ImageLightbox({ src, alt, open, onClose }: ImageLightboxProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });

  const reset = useCallback(() => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  }, []);

  const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "+":
        case "=":
          setZoom((z) => clampZoom(z + ZOOM_STEP));
          break;
        case "-":
          setZoom((z) => clampZoom(z - ZOOM_STEP));
          break;
        case "ArrowLeft":
          setPan((p) => ({ ...p, x: p.x + 50 }));
          break;
        case "ArrowRight":
          setPan((p) => ({ ...p, x: p.x - 50 }));
          break;
        case "ArrowUp":
          setPan((p) => ({ ...p, y: p.y + 50 }));
          break;
        case "ArrowDown":
          setPan((p) => ({ ...p, y: p.y - 50 }));
          break;
        case "r":
          setRotation((r) => r + 90);
          break;
        case "0":
          reset();
          break;
      }
    },
    [onClose, reset]
  );

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom((z) => clampZoom(z + delta));
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (zoom <= 1) return;
      e.preventDefault();
      setDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY };
      panStart.current = { ...pan };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [zoom, pan]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      setPan({
        x: panStart.current.x + (e.clientX - dragStart.current.x),
        y: panStart.current.y + (e.clientY - dragStart.current.y),
      });
    },
    [dragging]
  );

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  const handleDownload = useCallback(() => {
    const a = document.createElement("a");
    a.href = src;
    a.download = alt || "document";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [src, alt]);

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  // Reset state when opening
  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  if (!open) return null;

  const zoomPercent = Math.round(zoom * 100);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Toolbar */}
      <div
        className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-xl bg-black/60 backdrop-blur-md px-2 py-1.5 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <ToolbarButton
          icon={ZoomOut}
          label="Diminuir zoom"
          onClick={() => setZoom((z) => clampZoom(z - ZOOM_STEP))}
          disabled={zoom <= MIN_ZOOM}
        />
        <span className="min-w-[3rem] text-center text-xs font-medium text-white/70 tabular-nums">
          {zoomPercent}%
        </span>
        <ToolbarButton
          icon={ZoomIn}
          label="Aumentar zoom"
          onClick={() => setZoom((z) => clampZoom(z + ZOOM_STEP))}
          disabled={zoom >= MAX_ZOOM}
        />
        <div className="mx-1 h-4 w-px bg-white/20" />
        <ToolbarButton
          icon={RotateCw}
          label="Rodar 90°"
          onClick={() => setRotation((r) => r + 90)}
        />
        <ToolbarButton
          icon={Maximize2}
          label="Repor tamanho"
          onClick={reset}
        />
        <div className="mx-1 h-4 w-px bg-white/20" />
        <ToolbarButton
          icon={Download}
          label="Transferir"
          onClick={handleDownload}
        />
        <ToolbarButton icon={X} label="Fechar" onClick={onClose} />
      </div>

      {/* Image */}
      <div
        className="flex items-center justify-center"
        style={{ width: "90vw", height: "90vh" }}
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-h-[90vh] max-w-[90vw] object-contain select-none transition-transform duration-150 ease-out"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
            cursor: zoom > 1 ? (dragging ? "grabbing" : "grab") : "default",
          }}
        />
      </div>
    </div>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: typeof X;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:pointer-events-none"
      aria-label={label}
      title={label}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
