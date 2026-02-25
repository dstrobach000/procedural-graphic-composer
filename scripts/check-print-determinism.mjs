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
      const { resolveLayoutExportTarget } = await import('/src/core/export/layoutExport.ts');
      const store = useProjectStore;

      const waitForEngine = async () => {
        const start = performance.now();
        while (performance.now() - start < 10000) {
          if (store.getState().engine) {
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        throw new Error('Engine did not initialize within timeout');
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
          throw new Error('2D context unavailable');
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

      const hashActiveLayoutExport = async () => {
        const state = store.getState();
        if (!state.engine) {
          throw new Error('Engine unavailable');
        }

        const activeLayout = state.project.layouts[state.project.activeLayoutId];
        if (!activeLayout) {
          throw new Error(`Active layout not found: ${state.project.activeLayoutId}`);
        }

        const target = resolveLayoutExportTarget(activeLayout);
        await state.engine.syncProject(state.project);
        const pixels = await state.engine.renderToImage(target.exportWidth, target.exportHeight, {
          cameraBounds: target.cameraBounds,
        });

        const hash = await hashPixelsToPNG(pixels, target.exportWidth, target.exportHeight);

        return {
          hash,
          layoutId: state.project.activeLayoutId,
          trimWidth: activeLayout.width,
          trimHeight: activeLayout.height,
          exportWidth: target.exportWidth,
          exportHeight: target.exportHeight,
          bleedPx: target.bleedPx,
        };
      };

      const clone = (value) => JSON.parse(JSON.stringify(value));

      const runBatchA3Hashes = async (snapshotIds) => {
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
            const layout = snapshotProject.layouts.a3_300dpi;
            if (!layout) {
              continue;
            }

            snapshotProject.activeLayoutId = 'a3_300dpi';
            snapshotProject.canvas = {
              width: layout.width,
              height: layout.height,
            };

            await state.engine.syncProject(snapshotProject);
            const target = resolveLayoutExportTarget(layout);
            const pixels = await state.engine.renderToImage(target.exportWidth, target.exportHeight, {
              cameraBounds: target.cameraBounds,
            });

            const hash = await hashPixelsToPNG(pixels, target.exportWidth, target.exportHeight);
            hashes.push({ snapshotId, layoutId: 'a3_300dpi', hash });
          }
        } finally {
          await state.engine.syncProject(originalProject);
        }

        return hashes;
      };

      store.getState().newProject();
      await waitForEngine();

      store.getState().setActiveLayout('a3_300dpi');
      await new Promise((resolve) => setTimeout(resolve, 100));

      const a3_first = await hashActiveLayoutExport();
      const a3_second = await hashActiveLayoutExport();

      store.getState().setActiveLayout('instagramPortrait');
      await new Promise((resolve) => setTimeout(resolve, 100));
      store.getState().setActiveLayout('a3_300dpi');
      await new Promise((resolve) => setTimeout(resolve, 100));

      const a3_after_switch = await hashActiveLayoutExport();

      store.getState().createSnapshot();
      store.getState().variation();
      store.getState().createSnapshot();
      await new Promise((resolve) => setTimeout(resolve, 60));

      const snapshotIds = store.getState().project.snapshots.slice(0, 2).map((snapshot) => snapshot.id);

      const batch_run_1 = await runBatchA3Hashes(snapshotIds);
      await new Promise((resolve) => setTimeout(resolve, 40));
      const batch_run_2 = await runBatchA3Hashes(snapshotIds);

      return {
        checks: {
          a3_repeat_identical: a3_first.hash === a3_second.hash,
          a3_switch_roundtrip_identical: a3_first.hash === a3_after_switch.hash,
          batch_two_snapshots_a3_repeat_identical:
            JSON.stringify(batch_run_1) === JSON.stringify(batch_run_2),
        },
        a3_first,
        a3_second,
        a3_after_switch,
        batch_run_1,
        batch_run_2,
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
