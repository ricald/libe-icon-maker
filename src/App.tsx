import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Download, ZoomIn, ZoomOut, Image as ImageIcon } from 'lucide-react';
import { PREVIEW_SIZE, OUTPUT_PRESETS, inputError, outputFilename, drawExport, encodePng } from './icon-export';
import type { OutputTarget, OutputShape } from './icon-export';

const CANVAS_SIZE = PREVIEW_SIZE;

export default function App() {

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [minScale, setMinScale] = useState(0.1);
  const [maxScale, setMaxScale] = useState(5);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isDragOver, setIsDragOver] = useState(false);
  const [shape, setShape] = useState<OutputShape>('square');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const loadRequestRef = useRef(0);
  const exportInProgressRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateScaleAndPosition = useCallback((newScale: number) => {
    setStatus('');
    newScale = Math.max(minScale, Math.min(maxScale, newScale));
    if (newScale === scale) return;

    const cx = CANVAS_SIZE / 2;
    const cy = CANVAS_SIZE / 2;
    const dx = position.x - cx;
    const dy = position.y - cy;
    const ratio = newScale / scale;

    setPosition({ x: cx + dx * ratio, y: cy + dy * ratio });
    setScale(newScale);
  }, [minScale, maxScale, scale, position]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const patternSize = 10;
    for (let i = 0; i < CANVAS_SIZE / patternSize; i++) {
      for (let j = 0; j < CANVAS_SIZE / patternSize; j++) {
        ctx.fillStyle = shape === 'square' || (i + j) % 2 === 0 ? '#ffffff' : '#f3f4f6';
        ctx.fillRect(i * patternSize, j * patternSize, patternSize, patternSize);
      }
    }

    if (image) {
      ctx.drawImage(image, position.x, position.y, image.width * scale, image.height * scale);
    } else {
      ctx.fillStyle = '#e5e7eb';
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.fillStyle = '#9ca3af';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('画像が選択されていません', CANVAS_SIZE / 2, CANVAS_SIZE / 2);
    }

    if (image) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.beginPath();
      ctx.rect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2, 0, Math.PI * 2, true);
      ctx.fill();

      ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 0.5, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 1.5, 0, Math.PI * 2);
      ctx.stroke();

      const centerX = CANVAS_SIZE / 2;
      const centerY = CANVAS_SIZE / 2;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(CANVAS_SIZE, centerY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(centerX, 0);
      ctx.lineTo(centerX, CANVAS_SIZE);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [image, scale, position, shape]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      if (!image) return;
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.95 : 1.05;
      updateScaleAndPosition(scale * zoomFactor);
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [image, scale, updateScaleAndPosition]);

  const processFile = (file: File) => {
    const request = ++loadRequestRef.current;
    setStatus('');
    setError('');
    setIsDragging(false);
    setImage(null);
    const validationError = inputError(file);
    if (validationError) {
      setError(validationError);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (request !== loadRequestRef.current) return;
      const initScale = Math.max(CANVAS_SIZE / img.width, CANVAS_SIZE / img.height);
      setMinScale(initScale * 0.2);
      setMaxScale(initScale * 5);
      setScale(initScale);
      setPosition({
        x: (CANVAS_SIZE - img.width * initScale) / 2,
        y: (CANVAS_SIZE - img.height * initScale) / 2,
      });
      setImage(img);
      setIsLoading(false);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      if (request !== loadRequestRef.current) return;
      setIsLoading(false);
      setError('画像を読み込めませんでした。別のJPG・PNG・WebP画像を選んでください。');
    };
    img.src = url;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) processFile(e.target.files[0]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]);
  };

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const bounds = e.currentTarget.getBoundingClientRect();
    return {
      x: (e.clientX - bounds.left) * CANVAS_SIZE / bounds.width,
      y: (e.clientY - bounds.top) * CANVAS_SIZE / bounds.height,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!image || !e.isPrimary || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerIdRef.current = e.pointerId;
    setStatus('');
    setIsDragging(true);
    const coords = getCanvasCoords(e);
    setDragStart({ x: coords.x - position.x, y: coords.y - position.y });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging || !image || e.pointerId !== pointerIdRef.current) return;
    const coords = getCanvasCoords(e);
    setPosition({ x: coords.x - dragStart.x, y: coords.y - dragStart.y });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    pointerIdRef.current = null;
  };

  const resetPosition = () => {
    if (!image) return;
    const initialScale = Math.max(CANVAS_SIZE / image.width, CANVAS_SIZE / image.height);
    setScale(initialScale);
    setPosition({ x: (CANVAS_SIZE - image.width * initialScale) / 2,
      y: (CANVAS_SIZE - image.height * initialScale) / 2 });
    setStatus('');
  };

  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    updateScaleAndPosition(parseFloat(e.target.value));
  const zoomIn = () => updateScaleAndPosition(scale * 1.01);
  const zoomOut = () => updateScaleAndPosition(scale * 0.99);

  const downloadImage = async (target: OutputTarget) => {
    if (!image || isLoading || exportInProgressRef.current) return;
    exportInProgressRef.current = true;
    setIsExporting(true);
    setStatus('');
    setError('');
    const request = loadRequestRef.current;
    try {
      const size = OUTPUT_PRESETS[target].size;
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = size;
      exportCanvas.height = size;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) throw new Error('このブラウザでは画像を書き出せません。別のブラウザでお試しください。');
      drawExport(ctx, image, position, scale, size, shape);
      const blob = await encodePng(exportCanvas);
      if (request !== loadRequestRef.current) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = outputFilename(target);
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Leave time for browsers to consume the download URL.
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setStatus(`${OUTPUT_PRESETS[target].label}用 ${size}×${size}px・PNG・${(blob.size / 1000).toFixed(1)} KB。2 MB以下を確認し、保存を開始しました。`);
    } catch (reason) {
      if (request === loadRequestRef.current) {
        setError(reason instanceof Error ? reason.message : '画像の保存に失敗しました。もう一度お試しください。');
      }
    } finally {
      exportInProgressRef.current = false;
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4 font-sans">
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-xl w-full max-w-md border border-gray-100">

        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="bg-blue-100 p-1 sm:p-2 rounded-full text-blue-600 shrink-0">
            <ImageIcon size={24} />
          </div>
          <h1 className="text-lg sm:text-2xl whitespace-nowrap font-bold text-gray-800 tracking-tight">リベアイコンメーカー</h1>
        </div>

        <p className="text-center text-blue-700 font-semibold mb-2">リベシティ・oVice向け</p>
        <p className="text-sm text-gray-600 leading-relaxed text-center mb-6">
          リベシティとoViceで使うアイコンを、同じ画像から作れます。位置と大きさを調整して、2種類のPNGを保存できます。<br />
          画像は端末内で処理し、サーバーへ送信しません。
        </p>

        {/* ファイル選択・ドラッグ＆ドロップエリア */}
        <div className="mb-6">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/jpeg,image/png,image/webp"
            aria-label="アイコンに使う画像"
            onChange={handleFileSelect}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`w-full flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl py-8 cursor-pointer transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-50
              ${isDragOver
                ? 'bg-blue-100 border-blue-400 text-blue-700 scale-[1.02]'
                : 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100 hover:border-blue-300'}`}
          >
            <Upload size={28} className={`transition-transform duration-300 ${isDragOver ? '-translate-y-1' : ''}`} />
            <div className="text-center">
              <span className="font-medium block text-base">画像を選択するか、ここにドロップ</span>
            </div>
          </button>
          <p className="mt-2 text-xs text-gray-500">読み込み：JPG・PNG・WebP／このツールでは20 MBまで</p>
        </div>
        {isLoading && <p role="status" className="mb-4 text-sm text-gray-600">画像を読み込んでいます…</p>}
        {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {/* プレビューキャンバス */}
        <div className="flex justify-center mb-6">
          <div className="shadow-sm border border-gray-300 bg-white max-w-full">
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              aria-label="アイコンの位置調整プレビュー"
              className={`touch-none max-w-full h-auto ${image ? 'cursor-move' : 'cursor-default'}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onLostPointerCapture={handlePointerUp}
            />
          </div>
        </div>

        {/* スライダー */}
        {image && (
          <div className="mb-8 px-2 animate-fade-in">
            <div className="flex items-center gap-4 text-gray-400 mb-2">
              <button
                onClick={zoomOut}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                title="縮小 (微調整)"
              >
                <ZoomOut size={20} />
              </button>
              <input
                type="range"
                aria-label="画像の拡大率"
                min={minScale}
                max={maxScale}
                step={0.001}
                value={scale}
                onChange={handleZoomChange}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <button
                onClick={zoomIn}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                title="拡大 (微調整)"
              >
                <ZoomIn size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-600 text-center mt-3">
              画像をドラッグで移動、ホイールやスライダーで拡縮できます
            </p>
            <button type="button" onClick={resetPosition} className="block mx-auto mt-3 text-sm text-blue-700 underline underline-offset-4">位置と大きさをリセット</button>
          </div>
        )}

        <p className="text-xs text-gray-500 leading-relaxed mb-5">円と十字線は位置合わせ用で、保存画像には入りません。円の内側に顔や文字を収めてください。</p>
        <fieldset className="mb-5">
          <legend className="text-sm font-semibold text-gray-700 mb-2">保存する形（両サイズ共通）</legend>
          <div className="flex flex-col gap-2 text-sm text-gray-700">
            <label className="flex items-center gap-2">
              <input type="radio" name="shape" value="square" checked={shape === 'square'} onChange={() => { setShape('square'); setStatus(''); }} />
              四角・白背景（標準）
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="shape" value="round" checked={shape === 'round'} onChange={() => { setShape('round'); setStatus(''); }} />
              丸く切り抜き・背景透過
            </label>
          </div>
        </fieldset>
        <div className="flex flex-col gap-3">
          {(Object.keys(OUTPUT_PRESETS) as OutputTarget[]).map((target) => (
            <button
              key={target}
              type="button"
              onClick={() => void downloadImage(target)}
              disabled={!image || isLoading || isExporting}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-3 rounded-2xl bg-blue-600 text-white font-semibold transition-colors hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              <Download size={20} className="shrink-0" />
              <span>{OUTPUT_PRESETS[target].label}用を保存<br /><span className="text-xs font-normal">{OUTPUT_PRESETS[target].size}×{OUTPUT_PRESETS[target].size}px・PNG（{OUTPUT_PRESETS[target].suffix}）</span></span>
            </button>
          ))}
        </div>
        {status && <p role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">{status}</p>}
        <div className="mt-5 rounded-xl bg-blue-50 p-4 text-sm text-blue-900 leading-relaxed">
          <p className="font-semibold">リベシティ内のoViceでは、同じ画像を</p>
          <p className="mt-1">リベシティのプロフィールと同じ画像の設定が必須です。位置・大きさ・形を変えずに、両方のボタンから保存してください。</p>
        </div>
        <details className="mt-5 text-xs text-gray-600 leading-relaxed">
          <summary className="cursor-pointer text-sm font-medium">仕様と公式情報</summary>
          <ul className="mt-3 space-y-2 list-disc pl-4">
            <li>リベシティは500×500pxを公式推奨。<a className="text-blue-700 underline" href="https://faq.libecity.com/articles/32a97b4ea36723f32d29a76e5c57a06ca11a84d5" target="_blank" rel="noreferrer">公式FAQ</a></li>
            <li>oViceの公式仕様表は200×200px・JPG/PNG・2MB。200pxが必須かは明記されていません。<a className="text-blue-700 underline" href="https://help.ovice.com/hc/ja/articles/16134945119641" target="_blank" rel="noreferrer">公式仕様表</a></li>
            <li>リベシティ内のoViceではプロフィールと同じ画像が必須。<a className="text-blue-700 underline" href="https://faq.libecity.com/articles/426ddbe6ed773be04f54d203a33e9077940a1488" target="_blank" rel="noreferrer">利用ルール</a></li>
          </ul>
          <p className="mt-3">本ツールはどちらもPNGで出力し、保存前に実容量が2,000,000バイト以下か検査します。リベシティ側の対応形式・容量上限は、現在のプロフィール編集画面で未確認です。読み込み上限20 MBは本ツール独自の制限です。</p>
          <p className="mt-2">仕様確認：2026年11月7日。リベシティ・oViceの公式ツールではありません。</p>
        </details>

      </div>
    </div>
  );
}
