const MAX_WIDTH = 1200;
const QUALITY = 0.9;

export interface ProcessedImage {
  base64: string;
  contentType: string;
  originalName?: string;
}

export interface ImageUtilsError extends Error {
  name: "ImageUtilsError";
}

function createError(message: string): ImageUtilsError {
  const err = new Error(message) as ImageUtilsError;
  err.name = "ImageUtilsError";
  return err;
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(createError("Failed to load image"));
    img.src = src;
  });
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(createError("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  const dataUrl = await fileToDataUrl(file);
  const img = await loadImage(dataUrl);
  return { width: img.width, height: img.height };
}

export function stripExif(dataUrl: string): string {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = dataUrl;
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL("image/jpeg", QUALITY);
}

export function compressImage(dataUrl: string): string {
  const img = new Image();
  img.src = dataUrl;

  const scale = Math.min(1, MAX_WIDTH / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  canvas.width = img.width * scale;
  canvas.height = img.height * scale;

  ctx.filter = "grayscale(100%) contrast(110%)";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL("image/jpeg", QUALITY);
}

export async function preprocessImage(file: File): Promise<string> {
  if (!isAllowedFileType(file.type)) {
    throw createError("File type not allowed. Supported: JPEG, PNG, HEIC");
  }

  const dataUrl = await fileToDataUrl(file);
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, MAX_WIDTH / Math.max(img.width, img.height));

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  canvas.width = img.width * scale;
  canvas.height = img.height * scale;

  ctx.filter = "grayscale(100%) contrast(110%)";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const base64 = canvas.toDataURL("image/jpeg", QUALITY);
  return base64.replace(/^data:image\/\w+;base64,/, "");
}

export function isAllowedFileType(type: string): boolean {
  return ["image/jpeg", "image/png", "image/heic"].includes(type);
}

export async function computeDHash(file: File): Promise<string> {
  if (!isAllowedFileType(file.type)) {
    throw createError("File type not allowed for dHash");
  }

  const dataUrl = await fileToDataUrl(file);
  const img = await loadImage(dataUrl);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  canvas.width = 9;
  canvas.height = 8;
  ctx.drawImage(img, 0, 0, 9, 8);

  const imageData = ctx.getImageData(0, 0, 9, 8);
  const pixels = imageData.data;

  const grayPixels: number[] = [];
  for (let i = 0; i < 9 * 8 * 4; i += 4) {
    const r = pixels[i]!;
    const g = pixels[i + 1]!;
    const b = pixels[i + 2]!;
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    grayPixels.push(gray);
  }

  const bits: boolean[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const left = grayPixels[row * 9 + col]!;
      const right = grayPixels[row * 9 + col + 1]!;
      bits.push(left > right);
    }
  }

  let hex = "";
  for (let i = 0; i < 64; i += 4) {
    let value = 0;
    if (bits[i]!) value |= 1;
    if (bits[i + 1]!) value |= 2;
    if (bits[i + 2]!) value |= 4;
    if (bits[i + 3]!) value |= 8;
    hex += value.toString(16);
  }

  return hex;
}
