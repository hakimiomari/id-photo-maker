import { defineConfig, devices } from "@playwright/test";
import { FAKE_CAMERA_FILE } from "../../e2e/fake-camera.paths";

const PORT = 3111;

export default defineConfig({
  testDir: "../../e2e",
  // Builds the fake webcam feed (Y4M of the sample portrait) before any test.
  globalSetup: "../../e2e/fake-camera.setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    permissions: ["camera"],
    // Fake webcam for the camera-capture test: Chromium replays the generated
    // Y4M as the "user" camera and auto-grants access. Inert for other tests.
    launchOptions: {
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        `--use-file-for-fake-video-capture=${FAKE_CAMERA_FILE}`,
      ],
    },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // PW_CHANNEL=chrome runs on the system browser — handy on machines
        // that have not downloaded Playwright's own Chromium.
        ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
      },
    },
  ],
  webServer: {
    command: `pnpm start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
