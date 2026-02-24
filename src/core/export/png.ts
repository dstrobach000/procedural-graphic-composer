export function flipPixels(pixels: Uint8Array, width: number, height: number): Uint8Array {
  const rowSize = width * 4;
  const output = new Uint8Array(pixels.length);

  for (let y = 0; y < height; y += 1) {
    const from = y * rowSize;
    const to = (height - y - 1) * rowSize;
    output.set(pixels.subarray(from, from + rowSize), to);
  }

  return output;
}

export async function pixelsToPNGBytes(
  pixels: Uint8Array,
  width: number,
  height: number,
): Promise<Uint8Array> {
  const flipped = flipPixels(pixels, width, height);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('2D canvas context is unavailable');
  }

  const imageData = new ImageData(new Uint8ClampedArray(flipped), width, height);
  context.putImageData(imageData, 0, 0);

  const blob = await canvasToBlob(canvas);
  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to encode PNG blob'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}
