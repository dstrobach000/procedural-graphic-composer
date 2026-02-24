import { chromium } from 'playwright';

const APP_URL = process.env.APP_URL ?? 'http://127.0.0.1:1420';
const CHROME_PATH =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

    const report = await page.evaluate(async () => {
      const { useProjectStore } = await import('/src/store/useProjectStore.ts');
      const store = useProjectStore;

      const waitForEngine = async () => {
        const start = performance.now();
        while (performance.now() - start < 10000) {
          if (store.getState().engine) {
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        throw new Error('Engine did not initialize in time');
      };

      const hashProjectRender = async () => {
        const state = store.getState();
        if (!state.engine) {
          throw new Error('Engine unavailable');
        }
        await state.engine.syncProject(state.project);

        const width = state.project.canvas.width;
        const height = state.project.canvas.height;
        const pixels = await state.engine.renderToImage(width, height);
        return hashPixelsToPNG(pixels, width, height);
      };

      const hashPixelsToPNG = async (pixels, width, height) => {
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
          throw new Error('2D canvas context unavailable');
        }
        context.putImageData(new ImageData(new Uint8ClampedArray(flipped), width, height), 0, 0);

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
        return Array.from(new Uint8Array(digest))
          .map((n) => n.toString(16).padStart(2, '0'))
          .join('');
      };

      const clone = (value) => JSON.parse(JSON.stringify(value));

      const runBatchHashes = async (snapshotIds, layoutIds) => {
        const state = store.getState();
        if (!state.engine) {
          throw new Error('Engine unavailable');
        }

        const originalProject = clone(state.project);
        const hashes = [];

        try {
          for (const snapshotId of snapshotIds) {
            const snapshot = originalProject.snapshots.find((entry) => entry.id === snapshotId);
            if (!snapshot) {
              continue;
            }
            const snapshotProject = clone(snapshot.projectState);

            for (const layoutId of layoutIds) {
              const layout = snapshotProject.layouts[layoutId];
              if (!layout) {
                continue;
              }
              snapshotProject.activeLayoutId = layoutId;
              snapshotProject.canvas = { width: layout.width, height: layout.height };

              await state.engine.syncProject(snapshotProject);
              const pixels = await state.engine.renderToImage(layout.width, layout.height);
              const hash = await hashPixelsToPNG(pixels, layout.width, layout.height);
              hashes.push({
                snapshotId,
                layoutId,
                hash,
              });
            }
          }
        } finally {
          await state.engine.syncProject(originalProject);
        }

        return hashes;
      };

      store.getState().newProject();
      await waitForEngine();

      store.getState().addLayer('text');
      const textLayer = store.getState().project.layers.find((layer) => layer.type === 'text');
      if (!textLayer || textLayer.type !== 'text') {
        throw new Error('Failed to create text layer');
      }

      store.getState().updateLayer(textLayer.id, {
        name: 'Batch Headline',
        transform: {
          ...textLayer.transform,
          x: -420,
          y: -100,
        },
        params: {
          ...textLayer.params,
          text: 'DETERMINISTIC',
          fontPath: '/fonts/kenpixel.ttf',
          fontSize: 640,
          letterSpacing: 8,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 80));

      store.getState().createSnapshot();
      store.getState().variation();
      store.getState().createSnapshot();

      await new Promise((resolve) => setTimeout(resolve, 60));

      const beforeProjectJSON = JSON.stringify(store.getState().project);
      const beforeRenderHash = await hashProjectRender();

      const snapshotIds = store.getState().project.snapshots.map((snapshot) => snapshot.id);
      const layoutIds = ['instagramPortrait', 'square', 'a3_300dpi'];

      const firstRun = await runBatchHashes(snapshotIds, layoutIds);
      await new Promise((resolve) => setTimeout(resolve, 40));
      const secondRun = await runBatchHashes(snapshotIds, layoutIds);

      const afterProjectJSON = JSON.stringify(store.getState().project);
      const afterRenderHash = await hashProjectRender();

      const stableState = beforeProjectJSON === afterProjectJSON;
      const stableRender = beforeRenderHash === afterRenderHash;
      const deterministicRuns = JSON.stringify(firstRun) === JSON.stringify(secondRun);

      return {
        snapshotCount: snapshotIds.length,
        requestedLayoutCount: layoutIds.length,
        generatedCount: firstRun.length,
        stableState,
        stableRender,
        deterministicRuns,
        beforeRenderHash,
        afterRenderHash,
        firstRun,
        secondRun,
      };
    });

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await sleep(20);
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
