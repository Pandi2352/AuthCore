import { Maximize, Minimize, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';

import { Button, Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui';

export interface ImageCropDialogProps {
  /** The picked image (null = closed). */
  file: File | null;
  /** Width ÷ height of the result, e.g. 5 for a 5 : 1 logo, 1 for a square icon. */
  aspect: number;
  /** Size of the produced PNG in pixels. */
  outputWidth: number;
  outputHeight: number;
  title?: string;
  description?: string;
  onCancel: () => void;
  /** The cropped image as a PNG (transparent where the picture doesn't reach). */
  onConfirm: (cropped: File) => void;
}

interface View {
  /** Image scale relative to its natural size. */
  scale: number;
  /** Image centre offset from the frame centre, in frame pixels. */
  x: number;
  y: number;
}

const FRAME_MAX_WIDTH = 520;
const FRAME_MAX_HEIGHT = 300;
const MAX_ZOOM_OVER_FILL = 4;
const KEY_STEP = 10;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Crop an image to a fixed shape before uploading: drag to move, zoom with the slider /
 * wheel / + − keys, arrows to nudge. "Fit" shows the whole image (transparent padding),
 * "Fill" covers the frame. Output: PNG of outputWidth × outputHeight. No libraries.
 */
export function ImageCropDialog({
  file,
  aspect,
  outputWidth,
  outputHeight,
  title = 'Adjust the image',
  description = 'Drag to position, zoom to fit. The frame shows exactly what will be saved.',
  onCancel,
  onConfirm,
}: ImageCropDialogProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const drag = useRef<{ id: number; startX: number; startY: number; from: View } | null>(null);

  // Frame size on screen (same shape as the output).
  const frameWidth = Math.min(FRAME_MAX_WIDTH, FRAME_MAX_HEIGHT * aspect);
  const frameHeight = frameWidth / aspect;

  const fitScale = image ? Math.min(frameWidth / image.width, frameHeight / image.height) : 1;
  const fillScale = image ? Math.max(frameWidth / image.width, frameHeight / image.height) : 1;
  const minScale = Math.min(fitScale, fillScale) * 0.5;
  const maxScale = fillScale * MAX_ZOOM_OVER_FILL;

  // Load the picked file; start with the whole image visible.
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    let cancelled = false;
    img.addEventListener('load', () => {
      if (cancelled) return;
      setImage(img);
      setLoadError(false);
      setView({
        scale: Math.min(frameWidth / img.width, frameHeight / img.height),
        x: 0,
        y: 0,
      });
    });
    img.addEventListener('error', () => {
      if (!cancelled) setLoadError(true);
    });
    img.src = url;
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
      setImage(null);
    };
  }, [file, frameWidth, frameHeight]);

  /** Keep the image centre inside the frame (it can't be dragged away). */
  const settle = (next: View): View => {
    const scale = clamp(next.scale, minScale, maxScale);
    return {
      scale,
      x: clamp(next.x, -frameWidth / 2, frameWidth / 2),
      y: clamp(next.y, -frameHeight / 2, frameHeight / 2),
    };
  };

  const zoomTo = (scale: number) => setView((v) => settle({ ...v, scale }));

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      from: view,
    };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    setView(
      settle({
        ...d.from,
        x: d.from.x + event.clientX - d.startX,
        y: d.from.y + event.clientY - d.startY,
      }),
    );
  };
  const endDrag = () => {
    drag.current = null;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-KEY_STEP, 0],
      ArrowRight: [KEY_STEP, 0],
      ArrowUp: [0, -KEY_STEP],
      ArrowDown: [0, KEY_STEP],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      setView((v) => settle({ ...v, x: v.x + move[0], y: v.y + move[1] }));
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomTo(view.scale * 1.1);
    } else if (event.key === '-') {
      event.preventDefault();
      zoomTo(view.scale / 1.1);
    }
  };

  const confirm = async () => {
    if (!image || !file) return;
    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const ratio = outputWidth / frameWidth;
    const drawWidth = image.width * view.scale * ratio;
    const drawHeight = image.height * view.scale * ratio;
    const left = (frameWidth / 2 + view.x) * ratio - drawWidth / 2;
    const top = (frameHeight / 2 + view.y) * ratio - drawHeight / 2;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, left, top, drawWidth, drawHeight);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return;
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
    onConfirm(new File([blob], `${baseName}.png`, { type: 'image/png' }));
  };

  const imageWidth = image ? image.width * view.scale : 0;
  const imageHeight = image ? image.height * view.scale : 0;
  const zoomPercent = Math.round((view.scale / fillScale) * 100);

  return (
    <Dialog open={file !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent title={title} description={description} size="lg">
        <DialogBody className="space-y-4">
          {loadError ? (
            <p role="alert" className="text-sm text-danger">
              This image could not be opened. Choose a PNG, WebP or JPEG file.
            </p>
          ) : (
            <>
              <div className="flex justify-center">
                {/* oxlint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex -- custom crop widget: drag + arrow / +− keys, announced as an application with instructions; no native element does this */}
                <div
                  role="application"
                  aria-label="Crop area: drag or use the arrow keys to move, + and − to zoom"
                  tabIndex={0}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  onWheel={(e) => zoomTo(view.scale * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}
                  onKeyDown={onKeyDown}
                  className="relative cursor-grab touch-none overflow-hidden rounded-md border border-primary outline-offset-2 select-none [background:repeating-conic-gradient(var(--muted)_0_25%,var(--surface)_0_50%)_0_0/14px_14px] focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing"
                  style={{ width: frameWidth, height: frameHeight, maxWidth: '100%' }}
                >
                  {image && (
                    <img
                      src={image.src}
                      alt=""
                      draggable={false}
                      className="pointer-events-none absolute max-w-none"
                      style={{
                        width: imageWidth,
                        height: imageHeight,
                        left: frameWidth / 2 + view.x - imageWidth / 2,
                        top: frameHeight / 2 + view.y - imageHeight / 2,
                      }}
                    />
                  )}
                </div>
                {/* oxlint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Zoom out"
                  onClick={() => zoomTo(view.scale / 1.15)}
                >
                  <ZoomOut />
                </Button>
                <input
                  type="range"
                  min={minScale}
                  max={maxScale}
                  step={(maxScale - minScale) / 200}
                  value={view.scale}
                  onChange={(e) => zoomTo(Number(e.target.value))}
                  aria-label="Zoom"
                  aria-valuetext={`${zoomPercent}%`}
                  className="h-2 min-w-0 flex-1 cursor-pointer accent-primary"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Zoom in"
                  onClick={() => zoomTo(view.scale * 1.15)}
                >
                  <ZoomIn />
                </Button>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Minimize />}
                  onClick={() => setView({ scale: fitScale, x: 0, y: 0 })}
                >
                  Fit whole image
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Maximize />}
                  onClick={() => setView({ scale: fillScale, x: 0, y: 0 })}
                >
                  Fill the frame
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<RotateCcw />}
                  onClick={() => setView((v) => ({ ...v, x: 0, y: 0 }))}
                >
                  Center
                </Button>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Saved as {outputWidth} × {outputHeight} px PNG · empty areas stay transparent
              </p>
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button disabled={!image} onClick={() => void confirm()}>
            Use this image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
