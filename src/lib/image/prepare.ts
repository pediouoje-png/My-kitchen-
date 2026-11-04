/**
 * 업로드 전 이미지 준비 (브라우저).
 * - iPhone HEIC도 Safari가 디코딩하므로 <img>로 읽어 JPEG로 다시 저장한다.
 * - AI는 긴 변 약 1,568px 안팎에서 글자를 가장 잘 읽는다. 세로로 긴 쿠팡 캡처는
 *   폭 1,000px로 맞춘 뒤 높이 1,500px 조각으로 겹쳐(200px) 나눈다 → 작은 글씨가 뭉개지지 않는다.
 */

export interface PreparedImage {
  data: string; // base64 (data: 접두어 없음)
  mediaType: "image/jpeg";
  width: number;
  height: number;
}

const MAX_WIDTH = 1000;
const TILE_HEIGHT = 1500;
const OVERLAP = 200;
const MAX_TILES_PER_IMAGE = 6;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 열 수 없어요. 다른 형식(JPG, PNG)으로 시도해 주세요."));
    };
    img.src = url;
  });
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): string {
  return canvas.toDataURL("image/jpeg", quality).split(",")[1] ?? "";
}

export async function prepareImage(file: File, quality = 0.85): Promise<PreparedImage[]> {
  const img = await loadImage(file);
  const w0 = img.naturalWidth;
  const h0 = img.naturalHeight;
  if (!w0 || !h0) throw new Error("이미지 크기를 읽을 수 없어요.");

  const longImage = h0 / w0 > TILE_HEIGHT / MAX_WIDTH + 0.2;
  // 일반 사진: 긴 변 1,568px 이하 / 긴 캡처: 폭 1,000px 이하
  const scale = longImage ? Math.min(1, MAX_WIDTH / w0) : Math.min(1, 1568 / Math.max(w0, h0));
  const w = Math.round(w0 * scale);
  const h = Math.round(h0 * scale);

  const tiles: { y: number; height: number }[] = [];
  if (!longImage) {
    tiles.push({ y: 0, height: h });
  } else {
    for (let y = 0; y < h && tiles.length < MAX_TILES_PER_IMAGE; y += TILE_HEIGHT - OVERLAP) {
      tiles.push({ y, height: Math.min(TILE_HEIGHT, h - y) });
      if (y + TILE_HEIGHT >= h) break;
    }
  }

  return tiles.map(({ y, height }) => {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("이미지를 처리할 수 없어요.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, height);
    // 원본 좌표로 잘라서 축소해 그린다
    ctx.drawImage(img, 0, y / scale, w0, height / scale, 0, 0, w, height);
    return { data: toJpeg(canvas, quality), mediaType: "image/jpeg" as const, width: w, height };
  });
}

/** 여러 파일 → 업로드용 조각 목록. 서버 한도(10장, 약 3MB)에 맞춰 품질을 낮춰 가며 맞춘다. */
export async function prepareImages(files: File[]): Promise<PreparedImage[]> {
  for (const quality of [0.85, 0.72, 0.6]) {
    const all: PreparedImage[] = [];
    for (const f of files) all.push(...(await prepareImage(f, quality)));
    const size = all.reduce((s, i) => s + i.data.length, 0);
    if (all.length > 10) throw new Error(`이미지가 너무 길거나 많아요 (${all.length}조각). 나눠서 분석해 주세요.`);
    if (size <= 3_800_000) return all;
  }
  throw new Error("이미지 용량이 너무 커요. 장수를 줄여서 다시 시도해 주세요.");
}
