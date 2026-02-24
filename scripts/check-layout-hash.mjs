import { chromium } from 'playwright';

const APP_URL = process.env.APP_URL ?? 'http://127.0.0.1:1420';
const CHROME_PATH =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForEngine(page) {
  await page.evaluate(async () => {
    const mod = await import('/src/store/useProjectStore.ts');
    const store = mod.useProjectStore;
    const start = performance.now();

    while (performance.now() - start < 10000) {
      if (store.getState().engine) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    throw new Error('Engine did not initialize within timeout');
  });
}

async function hashCurrentLayout(page) {
  return page.evaluate(async () => {
    const mod = await import('/src/store/useProjectStore.ts');
    const store = mod.useProjectStore;
    const state = store.getState();
    if (!state.engine) {
      throw new Error('Engine unavailable');
    }

    await state.engine.syncProject(state.project);

    const width = state.project.canvas.width;
    const height = state.project.canvas.height;
        const pixels = await state.engine.renderToImage(width, height);

    const rowSize = width * 4;
    const flipped = new Uint8Array(pixels.length);
    for (let y = 0; y < height; y += 1) {
      const from = y * rowSize;
      const to = (height - y - 1) * rowSize;
      flipped.set(pixels.subarray(from, from + rowSize), to);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('2D context unavailable');
    }

    const imageData = new ImageData(new Uint8ClampedArray(flipped), width, height);
    context.putImageData(imageData, 0, 0);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((nextBlob) => {
        if (!nextBlob) {
          reject(new Error('PNG encode failed'));
          return;
        }
        resolve(nextBlob);
      }, 'image/png');
    });

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hashHex = Array.from(new Uint8Array(digest))
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('');

    return {
      hash: hashHex,
      width,
      height,
      seed: state.project.seed,
      layoutId: state.project.activeLayoutId,
    };
  });
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME_PATH,
    args: ['--use-angle=swiftshader', '--enable-webgl'],
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(APP_URL, { waitUntil: 'networkidle' });

    await page.evaluate(async () => {
      const mod = await import('/src/store/useProjectStore.ts');
      mod.useProjectStore.getState().newProject();
    });
    await waitForEngine(page);

    const first = await hashCurrentLayout(page);
    const second = await hashCurrentLayout(page);

    await page.evaluate(async () => {
      const mod = await import('/src/store/useProjectStore.ts');
      mod.useProjectStore.getState().setActiveLayout('square');
    });
    await sleep(100);

    await page.evaluate(async () => {
      const mod = await import('/src/store/useProjectStore.ts');
      mod.useProjectStore.getState().setActiveLayout('instagramPortrait');
    });
    await sleep(100);

    const third = await hashCurrentLayout(page);

    const report = {
      first,
      second,
      third,
      equal_first_second: first.hash === second.hash,
      equal_first_third: first.hash === third.hash,
    };

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
