"use client";

/**
 * Platform PDF Canvas Component
 *
 * Renders a PDF page onto a <canvas> and draws an amber highlight box for
 * bounding boxes returned by the document extraction pipeline.
 * If the PDF fetch fails or returns 404, gracefully renders a clean
 * document preview canvas so the UI never breaks.
 */
import { useEffect, useRef, useState } from "react";
import type { RenderTask } from "pdfjs-dist";

export interface PdfCanvasBbox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PdfCanvasProps {
  url: string;
  page?: number;
  bbox?: PdfCanvasBbox | null;
  className?: string;
}

export function PdfCanvas({ url, page = 1, bbox, className }: PdfCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const highlightRef = useRef<HTMLCanvasElement>(null);
  const pageDims = useRef<{ width: number; height: number } | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "fallback">("idle");
  const [_errorMsg, setErrorMsg] = useState<string | null>(null);

  function paintHighlight(
    dims: { width: number; height: number } | null,
    canvasEl: HTMLCanvasElement,
    hlEl: HTMLCanvasElement,
    box: PdfCanvasBbox | null | undefined
  ) {
    hlEl.width = canvasEl.width;
    hlEl.height = canvasEl.height;
    const hc = hlEl.getContext("2d");
    if (!hc) return;
    hc.clearRect(0, 0, hlEl.width, hlEl.height);

    if (!box || !dims || box.width <= 0 || box.height <= 0) return;

    const pxPerUnit = canvasEl.width / dims.width;
    const sx = Math.floor(box.x * pxPerUnit);
    const sy = Math.floor((dims.height - box.y - box.height) * pxPerUnit);
    const sw = Math.ceil(box.width * pxPerUnit);
    const sh = Math.ceil(box.height * pxPerUnit);

    hc.fillStyle = "rgba(245, 158, 11, 0.25)";
    hc.fillRect(sx, sy, sw, sh);
    hc.strokeStyle = "#f59e0b";
    hc.lineWidth = 2;
    hc.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
  }

  function paintFallbackCanvas(canvas: HTMLCanvasElement, containerWidth: number) {
    const width = containerWidth || 640;
    const height = Math.floor(width * 0.7);
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(20, 20, width - 40, height - 40);

    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 15px Inter, sans-serif";
    ctx.fillText("DOCUMENT PREVIEW UNAVAILABLE", 40, 65);

    ctx.fillStyle = "#64748b";
    ctx.font = "12px Inter, sans-serif";
    ctx.fillText("The PDF document canvas preview could not be rendered directly.", 40, 95);
    ctx.fillText("Click 'Open Full View' in the top action bar to download or view the document.", 40, 118);

    pageDims.current = { width, height };
  }

  useEffect(() => {
    let cancelled = false;
    let renderTask: RenderTask | null = null;

    async function renderPage() {
      setStatus("loading");
      setErrorMsg(null);
      pageDims.current = null;

      try {
        const pdfjs = await import("pdfjs-dist");

        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = new URL(
            "pdfjs-dist/build/pdf.worker.min.mjs",
            import.meta.url
          ).toString();
        }

        const pdf = await pdfjs.getDocument({ url, withCredentials: true }).promise;
        if (cancelled) return;

        const pageNum = Math.max(1, Math.min(page, pdf.numPages));
        const pdfPage = await pdf.getPage(pageNum);
        if (cancelled) return;

        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const containerWidth = container.clientWidth || 720;
        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const scale = containerWidth / baseViewport.width;
        const viewport = pdfPage.getViewport({ scale });

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        renderTask = pdfPage.render({ canvas, viewport });
        await renderTask.promise;
        if (cancelled) return;

        pageDims.current = { width: baseViewport.width, height: baseViewport.height };

        const hl = highlightRef.current;
        if (hl) paintHighlight(pageDims.current, canvas, hl, bbox);

        setStatus("ready");
      } catch {
        if (!cancelled) {
          const canvas = canvasRef.current;
          const container = containerRef.current;
          if (canvas && container) {
            paintFallbackCanvas(canvas, container.clientWidth || 640);
            const hl = highlightRef.current;
            if (hl) paintHighlight(pageDims.current, canvas, hl, bbox);
            setStatus("fallback");
          }
        }
      }
    }

    renderPage();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
    // `bbox` is intentionally excluded: this effect does the expensive PDF
    // page fetch/render, while the effect below repaints just the highlight
    // canvas whenever `bbox` changes. Depending on `bbox` here would force a
    // full PDF re-render on every bbox update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, page]);

  useEffect(() => {
    if (status !== "ready" && status !== "fallback") return;
    const canvas = canvasRef.current;
    const hl = highlightRef.current;
    if (canvas && hl) paintHighlight(pageDims.current, canvas, hl, bbox);
  }, [bbox, status]);

  return (
    <div ref={containerRef} className={`relative overflow-auto bg-[#323639] ${className ?? ""}`}>
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#323639]/90 z-10 pointer-events-none">
          <span className="text-slate-400 text-xs animate-pulse font-medium">
            Rendering PDF page {page}…
          </span>
        </div>
      )}
      <div className="relative inline-block min-w-full">
        <canvas ref={canvasRef} className="block mx-auto shadow-md" />
        <canvas ref={highlightRef} className="absolute top-0 left-0 pointer-events-none" />
      </div>
    </div>
  );
}
