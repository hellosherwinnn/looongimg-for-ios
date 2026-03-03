# LooongImg

![LooongImg](https://img.shields.io/badge/Status-Active-success)

LooongImg is an intelligent, smooth, and automatic long screenshot stitching tool independently developed by hellosherwin. It analyzes screen recording videos to automatically trace scrolling paths (like chat histories or product lists), uses a high-precision pixel matching algorithm to remove duplicate areas and redundant information, and seamlessly stitches them into a flawless, ultra-clear long image.

LooongImg 是一款由 hellosherwin 独立开发的智能且流畅的自动长截图工具。它通过解析您的屏幕录像视频，自动识别聊天记录、商品列表的滚动路径，利用高精度像素匹配算法完美去除重复区域和首尾冗余信息，无缝拼接生成一张完美无瑕的超清长图。

## ✨ Features / 特性

- **Smart Video Parsing / 智能视频解析**: Upload screen recording files (e.g., MP4) directly for long screenshots. (直接上传滚动截屏过程的录像文件（MP4等）。)
- **Seamless Pixel Stitching / 无缝像素缝合**: High-precision feature matching algorithm ensures no text is duplicated and no frame is missed. (高进度特征点比对算法，不会重复任何一条文字，也不会漏截任何一张图。)
- **Smart Deduplication & Anti-Shake / 智能去重与防抖**: Perfect frame alignment capturing only genuine content regions. (只保留真内容区拼接。)
- **Pure Local Processing / 纯本地运算**: Screenshots are rendered automatically and instantly via the Canvas API in the browser. Absolute privacy as no data leaves your device. (长截图完全在浏览器前端由 Canvas 高速合成完成，安全、隐私不出本地。)

## 🚀 How to Run / 运行方法

**Prerequisites / 环境需求:** Node.js

1. Install dependencies / 下载依赖:
   ```bash
   npm install
   ```
2. Start the local server / 启动本地开发服务器:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000` in your browser. / 在浏览器打开 `http://localhost:3000` 即可开始使用。

## 🛠 Tech Stack / 开发环境

- React 18
- TailwindCSS
- Vite
- Canvas API

---
© 2026 LooongImg. Crafted with ❤️ by hellosherwin.