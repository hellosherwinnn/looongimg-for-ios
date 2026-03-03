import React, { useState, useRef, useEffect } from 'react';
import { Upload, Scissors, Download, RefreshCw, Play, CheckCircle2, AlertCircle, ChevronRight, Layout, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

// --- Types ---
interface StitchResult {
  imageUrl: string;
  width: number;
  height: number;
}

// --- Constants ---
const FRAME_INTERVAL = 0.1;
const SEARCH_RANGE = 0.8;
const MAX_CANVAS_HEIGHT = 25000;
const HEADER_RATIO = 0.15;
const FOOTER_RATIO = 0.15;
const MATCH_STRIP_HEIGHT = 30;
const SCROLLBAR_WIDTH_RATIO = 0.12; // Mask right 12% to ignore scrollbar

export default function App() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<StitchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);



  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
      setResult(null);
      setError(null);
      setProgress(0);
    } else {
      setError('请选择有效的视频文件');
    }
  };

  const reset = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (result?.imageUrl) URL.revokeObjectURL(result.imageUrl);
    setVideoFile(null);
    setVideoUrl(null);
    setResult(null);
    setError(null);
    setProgress(0);
  };

  const startStitching = async () => {
    if (!videoRef.current || !videoUrl) return;

    setIsProcessing(true);
    setProgress(0);
    setError(null);

    try {
      const video = videoRef.current;
      const duration = video.duration;
      const width = video.videoWidth;
      const height = video.videoHeight;

      const headerH = Math.floor(height * HEADER_RATIO);
      const footerH = Math.floor(height * FOOTER_RATIO);
      const contentH = height - headerH - footerH;
      const maskW = Math.floor(width * (1 - SCROLLBAR_WIDTH_RATIO));

      const frames: ImageData[] = [];
      const captureCanvas = document.createElement('canvas');
      captureCanvas.width = width;
      captureCanvas.height = height;
      const cCtx = captureCanvas.getContext('2d', { willReadFrequently: true });
      if (!cCtx) throw new Error('Canvas Error');

      // 1. Extract Frames
      for (let t = 0; t < duration; t += FRAME_INTERVAL) {
        video.currentTime = t;
        await new Promise((resolve) => {
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked);
            resolve(null);
          };
          video.addEventListener('seeked', onSeeked);
        });

        cCtx.drawImage(video, 0, 0);
        frames.push(cCtx.getImageData(0, headerH, width, contentH));
        setProgress(Math.round((t / duration) * 30));
      }

      // 2. Overlap Stitching
      const stitchedCanvas = document.createElement('canvas');
      stitchedCanvas.width = width;
      stitchedCanvas.height = MAX_CANVAS_HEIGHT;
      const sCtx = stitchedCanvas.getContext('2d');
      if (!sCtx) throw new Error('Canvas Error');

      // Draw the first frame completely
      const firstFrame = frames[0];
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = contentH;
      const tCtx = tempCanvas.getContext('2d')!;

      tCtx.putImageData(firstFrame, 0, 0);
      sCtx.drawImage(tempCanvas, 0, 0);

      let currentY = contentH;

      console.log(`[STITCH] Duration: ${duration}s, width: ${width}, height: ${height}`);
      for (let i = 1; i < frames.length; i++) {
        const prev = frames[i - 1];
        const curr = frames[i];

        const shift = calculateShift(prev, curr, maskW);

        console.log(`[STITCH] Frame ${i}/${frames.length}: Shift = ${shift}px`);
        if (shift > 0) {
          const newH = shift;
          if (currentY + newH <= MAX_CANVAS_HEIGHT - footerH) {
            tCtx.putImageData(curr, 0, 0);

            // Draw ONLY the newly revealed bottom part of the current frame
            const sourceY = contentH - newH;
            sCtx.drawImage(
              tempCanvas,
              0, sourceY, width, newH,
              0, currentY, width, newH
            );
            currentY += newH;
          }
        } else if (shift < 0) {
          // Bounce back handling! Rewind the Y pointer to effectively erase overscrolled garbage
          currentY += shift;
          if (currentY < contentH) currentY = contentH;
        }

        setProgress(30 + Math.round((i / frames.length) * 60));
      }

      // Finalize: Add the footer back, but ONLY what was newly scrolled
      video.currentTime = duration;
      await new Promise(r => video.onseeked = r);
      cCtx.drawImage(video, 0, 0); // Correctly draw to capture canvas, NOT stitched canvas!

      const finalImageData = cCtx.getImageData(0, headerH, width, contentH);
      const lastScannedFrame = frames[frames.length - 1];

      // Calculate how much the very last frame moved compared to our last scanned frame
      const finalShift = calculateShift(lastScannedFrame, finalImageData, maskW);
      console.log(`[STITCH] Final Frame Shift = ${finalShift}px`);

      if (finalShift > 0 && currentY + finalShift <= MAX_CANVAS_HEIGHT - footerH) {
        tCtx.putImageData(finalImageData, 0, 0);
        const sourceY = contentH - finalShift;
        sCtx.drawImage(
          tempCanvas,
          0, sourceY, width, finalShift,
          0, currentY, width, finalShift
        );
        currentY += finalShift;
      } else if (finalShift < 0) {
        currentY += finalShift;
        if (currentY < contentH) currentY = contentH;
      }

      // Finally append the literal footer from the very last frame
      const finalFooterY = currentY;
      sCtx.drawImage(video, 0, height - footerH, width, footerH, 0, finalFooterY, width, footerH);
      currentY += footerH;

      // Ensure we add the header at the very top of the final output
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = width;
      finalCanvas.height = currentY + headerH;
      const fCtx = finalCanvas.getContext('2d')!;

      // Draw Header at the absolute top (0 to headerH)
      video.currentTime = 0;
      await new Promise(r => video.onseeked = r);
      fCtx.drawImage(video, 0, 0, width, headerH, 0, 0, width, headerH);

      // Draw Stitched Content exactly below the header
      fCtx.drawImage(stitchedCanvas, 0, 0, width, currentY, 0, headerH, width, currentY);

      const blob = await new Promise<Blob | null>(resolve => finalCanvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Export Error');

      setResult({ imageUrl: URL.createObjectURL(blob), width, height: currentY + headerH });
      setProgress(100);
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Calculates the exact pixel upward shift from prev to curr.
   */
  const calculateShift = (prev: ImageData, curr: ImageData, maskW: number): number => {
    const w = prev.width;
    const h = prev.height;
    const pData = prev.data;
    const cData = curr.data;

    // Template from the BOTTOM half of curr (avoids floating headers)
    const yStart = Math.floor(h * 0.55);
    const templateH = Math.floor(h * 0.35);

    let minDiff = Infinity;
    let bestShift = 0;

    // Max shift shouldn't exceed the template start Y
    const maxShift = Math.floor(h * 0.45);
    const minShift = -Math.floor(h * 0.2); // allow up to 20% negative shift for bounce

    for (let shift = minShift; shift <= maxShift; shift += 4) {
      let diff = 0;
      let count = 0;

      for (let y = 0; y < templateH; y += 2) {
        const cY = yStart + y;
        const pY = yStart + y + shift;

        if (pY < 0 || pY >= h) continue;

        for (let x = 0; x < maskW; x += 8) {
          const cIdx = (cY * w + x) * 4;
          const pIdx = (pY * w + x) * 4;

          diff += Math.abs(cData[cIdx] - pData[pIdx]) +
            Math.abs(cData[cIdx + 1] - pData[pIdx + 1]) +
            Math.abs(cData[cIdx + 2] - pData[pIdx + 2]);
          count++;
        }
      }
      if (count === 0) continue;
      const avg = diff / count;
      const penalizedAvg = avg + (Math.abs(shift) * 0.05);

      if (penalizedAvg < minDiff) {
        minDiff = penalizedAvg;
        bestShift = shift;
      }
    }

    // Refine pixel-perfect match
    let refineMinDiff = Infinity;
    let refinedShift = bestShift;

    const searchStart = Math.max(minShift, bestShift - 4);
    const searchEnd = Math.min(maxShift, bestShift + 4);

    for (let shift = searchStart; shift <= searchEnd; shift += 1) {
      let diff = 0;
      let count = 0;

      for (let y = 0; y < templateH; y += 2) {
        const cY = yStart + y;
        const pY = yStart + y + shift;

        if (pY < 0 || pY >= h) continue;

        for (let x = 0; x < maskW; x += 8) {
          const cIdx = (cY * w + x) * 4;
          const pIdx = (pY * w + x) * 4;

          diff += Math.abs(cData[cIdx] - pData[pIdx]) +
            Math.abs(cData[cIdx + 1] - pData[pIdx + 1]) +
            Math.abs(cData[cIdx + 2] - pData[pIdx + 2]);
          count++;
        }
      }
      if (count === 0) continue;
      const avg = diff / count;
      const penalizedAvg = avg + (Math.abs(shift) * 0.05);

      if (penalizedAvg < refineMinDiff) {
        refineMinDiff = penalizedAvg;
        refinedShift = shift;
      }
    }

    // Ignore shifts if they don't meet the threshold (e.g. large UI changes)
    if (refineMinDiff > 40) return 0;
    return refinedShift;
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-black/5 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Scissors className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">LooongImg</h1>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Auto Long Screenshot</p>
            </div>
          </div>

          {videoFile && (
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  const modal = document.getElementById('dev-note-modal');
                  if (modal) modal.classList.remove('hidden');
                }}
                className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1"
              >
                <AlertCircle className="w-4 h-4" />
                技术实现
              </button>
              <button
                onClick={reset}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1"
              >
                <RefreshCw className="w-4 h-4" />
                重新开始
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Dev Note Modal */}
      <div id="dev-note-modal" className="hidden fixed inset-0 z-[100] flex items-center justify-center p-6">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => document.getElementById('dev-note-modal')?.classList.add('hidden')} />
        <div className="relative bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl p-8 overflow-y-auto max-h-[80vh]">
          <h3 className="text-2xl font-bold mb-6">iOS 开发者实现指南</h3>
          <div className="space-y-6 text-gray-600 leading-relaxed">
            <section>
              <h4 className="font-bold text-black mb-2">1. 录屏采集 (ReplayKit)</h4>
              <p>在 iOS 中，我们使用 <code>RPScreenRecorder</code> 来启动录屏。你可以通过 <code>startCapture</code> 实时获取 <code>CMSampleBuffer</code>，或者录制成文件后处理。</p>
            </section>
            <section>
              <h4 className="font-bold text-black mb-2">2. 帧提取与对齐 (AVFoundation)</h4>
              <p>使用 <code>AVAssetReader</code> 提取视频帧。为了实现“自动拼接”，我们需要计算相邻两帧之间的垂直位移 (Vertical Offset)。</p>
            </section>
            <section>
              <h4 className="font-bold text-black mb-2">3. 图像拼接算法 (Vision / Core Image)</h4>
              <p>核心算法通常是 <strong>Feature Matching</strong> (特征匹配) 或 <strong>Phase Correlation</strong> (相位相关)。iOS 的 <code>Vision</code> 框架提供了 <code>VNTranslationalImageRegistrationRequest</code>，可以非常方便地计算两张图之间的平移向量。</p>
            </section>
            <section>
              <h4 className="font-bold text-black mb-2">4. 内存管理</h4>
              <p>长截图非常消耗内存。建议使用 <code>CATiledLayer</code> 或将大图切片存储，避免 App 崩溃。</p>
            </section>
          </div>
          <button
            onClick={() => document.getElementById('dev-note-modal')?.classList.add('hidden')}
            className="mt-8 w-full bg-blue-600 text-white py-4 rounded-2xl font-semibold"
          >
            了解了
          </button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto p-6 md:p-12">
        <AnimatePresence mode="wait">
          {!videoFile ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center min-h-[60vh]"
            >
              <div className="text-center mb-12">
                <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">让长截图变得简单</h2>
                <p className="text-xl text-gray-500 max-w-lg mx-auto">
                  只需上传你的屏幕录制视频，我们将自动为你拼接成一张完美的长截图。
                </p>
              </div>

              <label className="group relative cursor-pointer">
                <input type="file" className="hidden" accept="video/*" onChange={handleFileChange} />
                <div className="w-72 h-72 bg-white rounded-[3rem] shadow-2xl shadow-black/5 border border-black/5 flex flex-col items-center justify-center gap-6 transition-all duration-500 group-hover:scale-105 group-hover:shadow-blue-500/10 group-active:scale-95">
                  <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                    <Upload className="w-10 h-10 text-blue-600" />
                  </div>
                  <div className="text-center">
                    <span className="block text-lg font-semibold">选择录屏视频</span>
                    <span className="text-sm text-gray-400">支持 MP4, MOV 格式</span>
                  </div>
                </div>
              </label>

              <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
                {[
                  { icon: Smartphone, title: "录制屏幕", desc: "在手机上开启录屏并缓慢滚动" },
                  { icon: Scissors, title: "自动拼接", desc: "智能识别重叠部分并无缝缝合" },
                  { icon: Layout, title: "高清导出", desc: "生成无损画质的长图文件" }
                ].map((item, i) => (
                  <div key={i} className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm">
                    <item.icon className="w-8 h-8 text-blue-600 mb-4" />
                    <h3 className="font-semibold mb-2">{item.title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="process"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start"
            >
              {/* Left: Video Preview */}
              <div className="space-y-6">
                <div className="bg-white rounded-[2.5rem] p-4 shadow-xl border border-black/5 overflow-hidden">
                  <div className="aspect-[9/16] bg-black rounded-[1.5rem] relative overflow-hidden group">
                    <video
                      ref={videoRef}
                      src={videoUrl!}
                      className="w-full h-full object-contain"
                      playsInline
                      muted
                    />
                    {!isProcessing && !result && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-16 h-16 text-white fill-white" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">文件信息</span>
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full font-bold">READY</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center">
                      <Smartphone className="w-6 h-6 text-gray-400" />
                    </div>
                    <div>
                      <p className="font-semibold truncate max-w-[200px]">{videoFile.name}</p>
                      <p className="text-xs text-gray-400">{(videoFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Controls & Result */}
              <div className="space-y-8">
                <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-black/5">
                  <h3 className="text-2xl font-bold mb-6 tracking-tight">
                    {result ? '拼接完成' : isProcessing ? '正在拼命中...' : '准备就绪'}
                  </h3>

                  {!result && !isProcessing && (
                    <button
                      onClick={startStitching}
                      className="w-full bg-[#1D1D1F] text-white py-5 rounded-2xl font-semibold text-lg flex items-center justify-center gap-3 hover:bg-black transition-all active:scale-[0.98] shadow-lg shadow-black/10"
                    >
                      <Scissors className="w-6 h-6" />
                      开始自动拼接
                    </button>
                  )}

                  {isProcessing && (
                    <div className="space-y-6">
                      <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-blue-600"
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-sm font-medium">
                        <span className="text-gray-500">处理进度</span>
                        <span className="text-blue-600">{progress}%</span>
                      </div>
                      <p className="text-center text-gray-400 text-sm animate-pulse">
                        正在分析视频帧并计算重叠区域...
                      </p>
                    </div>
                  )}

                  {error && (
                    <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-2xl flex items-center gap-3 border border-red-100">
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      <p className="text-sm font-medium">{error}</p>
                    </div>
                  )}

                  {result && (
                    <div className="space-y-6">
                      <div className="p-4 bg-green-50 text-green-700 rounded-2xl flex items-center gap-3 border border-green-100">
                        <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                        <p className="text-sm font-medium">拼接成功！已生成长截图。</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-4 rounded-2xl border border-black/5">
                          <p className="text-xs text-gray-400 uppercase font-bold mb-1">宽度</p>
                          <p className="text-xl font-bold">{result.width}px</p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-2xl border border-black/5">
                          <p className="text-xs text-gray-400 uppercase font-bold mb-1">高度</p>
                          <p className="text-xl font-bold">{result.height}px</p>
                        </div>
                      </div>

                      <a
                        href={result.imageUrl}
                        download={`stitch-tailor-${Date.now()}.png`}
                        className="w-full bg-blue-600 text-white py-5 rounded-2xl font-semibold text-lg flex items-center justify-center gap-3 hover:bg-blue-700 transition-all active:scale-[0.98] shadow-lg shadow-blue-500/20"
                      >
                        <Download className="w-6 h-6" />
                        保存到相册
                      </a>
                    </div>
                  )}
                </div>

                {result && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-[2.5rem] p-4 shadow-xl border border-black/5 overflow-hidden"
                  >
                    <p className="text-sm font-medium text-gray-500 mb-4 px-4 uppercase tracking-wider">预览结果</p>
                    <div className="max-h-[500px] overflow-y-auto rounded-[1.5rem] border border-black/5 bg-gray-50 scrollbar-hide">
                      <img
                        src={result.imageUrl}
                        alt="Stitched Result"
                        className="w-full h-auto"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto p-12 text-center text-gray-400 text-sm">
        <p>© 2026 LooongImg. 由 hellosherwin 精心打造。</p>
        <div className="mt-4 flex items-center justify-center gap-6">
          <a href="#" className="hover:text-blue-600 transition-colors">隐私政策</a>
          <a href="#" className="hover:text-blue-600 transition-colors">使用条款</a>
          <a href="#" className="hover:text-blue-600 transition-colors">反馈建议</a>
        </div>
      </footer>
    </div>
  );
}
