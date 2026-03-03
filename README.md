# LooongImg

![LooongImg](https://img.shields.io/badge/Status-Active-success)

LooongImg 是一款由 hellosherwin 独立开发的智能且流畅的自动长截图工具。它通过解析您的屏幕录像视频，自动识别聊天记录、商品列表的滚动路径，利用高精度像素匹配算法完美去除重复区域和首尾冗余信息，无缝拼接生成一张完美无瑕的超清长图。

## ✨ 特性

- **智能视频解析**：直接上传滚动截屏过程的录像文件（MP4等）。
- **无缝像素缝合**：高进度特征点比对算法，不会重复任何一条文字，也不会漏截任何一张图。
- **智能去重与防抖**：只保留真内容区拼接
- **纯本地运算**：长截图完全在浏览器前端由 Canvas 高速合成完成，安全、隐私不出本地。

## 🚀 运行方法

**环境需求:** Node.js

1. 下载依赖:
   ```bash
   npm install
   ```
2. 启动本地开发服务器:
   ```bash
   npm run dev
   ```
3. 在浏览器打开 `http://localhost:3000` 即可开始使用。

## 🛠 开发环境

- React 18
- TailwindCSS
- Vite
- Canvas API

---
© 2026 LooongImg. Crafted with ❤️ by hellosherwin.