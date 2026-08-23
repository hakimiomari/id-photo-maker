import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  LM_EYE_A,
  LM_EYE_B,
  LM_FOREHEAD,
  LM_LIP_LOWER_INNER,
  LM_LIP_UPPER_INNER,
  LM_NOSE_TIP,
  measurePose,
} from "../src/compliance/pose";
import {
  measureBackground,
  measureFace,
  measureImage,
  measureSharpness,
  type PixelSource,
} from "../src/compliance/imageMetrics";
import {
  BACKGROUND_STD_MAX,
  backgroundColourMatches,
  evaluateCompliance,
  EYE_OPEN_MIN,
  FACE_LUMA_MAX,
  FACE_LUMA_MIN,
  LIGHTING_RATIO_MAX,
  MOUTH_OPEN_MAX,
  ROLL_WARN_DEG,
  SHARPNESS_MIN,
  YAW_WARN_DEG,
} from "../src/compliance/evaluate";
import { LM_IRIS_LEFT, LM_IRIS_RIGHT } from "../src/detect/headBounds";
import { solveCrop } from "../src/geometry/cropSolver";
import type {
  BackgroundStats,
  ImageMetrics,
  Landmark,
  PoseMetrics,
  Rect,
  Size,
} from "../src/types";
import { headBox, IMAGE_1000x1500, makeFormat, synthLandmarks } from "./fixtures";

// ---------------------------------------------------------------------------
// Pose

/** Neutral, frontal, open-eyed, closed-mouth synthetic face. */
function neutralFace(image: Size, overrides: Partial<Record<number, [number, number]>> = {}): Landmark[] {
  const landmarks = synthLandmarks({
    image,
    chinY: 900,
    meshTopY: 300,
    eyeY: 500,
    midlineX: 500,
    faceLeftX: 320,
    faceRightX: 680,
  });
  const set = (index: number, x: number, y: number) => {
    landmarks[index] = { x: x / image.width, y: y / image.height, z: 0 };
  };
  set(LM_FOREHEAD, 500, 300);
  set(LM_NOSE_TIP, 500, 620);
  // Silhouette extremes (synthLandmarks puts them on 1 and 2; keep them wide).
  set(1, 500, 620);
  set(2, 500, 650);
  set(234, 320, 600);
  set(454, 680, 600);
  // Eyes: 60 px wide, 18 px open (EAR 0.3).
  set(LM_EYE_A.outer, 390, 500);
  set(LM_EYE_A.inner, 450, 500);
  set(LM_EYE_A.upper, 420, 491);
  set(LM_EYE_A.lower, 420, 509);
  set(LM_EYE_B.outer, 610, 500);
  set(LM_EYE_B.inner, 550, 500);
  set(LM_EYE_B.upper, 580, 491);
  set(LM_EYE_B.lower, 580, 509);
  set(LM_IRIS_LEFT, 420, 500);
  set(LM_IRIS_RIGHT, 580, 500);
  // Lips closed.
  set(LM_LIP_UPPER_INNER, 500, 780);
  set(LM_LIP_LOWER_INNER, 500, 780);
  for (const [index, xy] of Object.entries(overrides)) {
    if (xy) set(Number(index), xy[0], xy[1]);
  }
  return landmarks;
}

describe("measurePose", () => {
  const image = IMAGE_1000x1500;

  it("reads a neutral frontal face as level, frontal, eyes open, mouth closed", () => {
    const pose = measurePose({ landmarks: neutralFace(image), image });
    expect(pose.rollDeg).toBeCloseTo(0, 6);
    expect(pose.yawDeg).toBeCloseTo(0, 6);
    expect(pose.eyeOpenness).toBeCloseTo(0.3, 6);
    expect(pose.mouthOpenRatio).toBe(0);
  });

  it("measures roll from the iris line in pixel space, not normalized space", () => {
    // Irises 160 px apart horizontally, right one 28 px lower: atan(28/160) ≈ 9.9°.
    const landmarks = neutralFace(image, { [LM_IRIS_RIGHT]: [580, 528] });
    const pose = measurePose({ landmarks, image });
    expect(pose.rollDeg).toBeCloseTo((Math.atan2(28, 160) * 180) / Math.PI, 6);
    // Swapping which iris is lower flips the sign.
    const other = measurePose({
      landmarks: neutralFace(image, { [LM_IRIS_LEFT]: [420, 528] }),
      image,
    });
    expect(other.rollDeg).toBeCloseTo(-pose.rollDeg, 6);
  });

  it("estimates yaw from where the nose tip sits between the silhouette edges", () => {
    // Nose tip 30% of the half-span towards the right edge → asymmetry 0.3 →
    // sin(yaw) = 0.3 / 1.2.
    const landmarks = neutralFace(image, { [LM_NOSE_TIP]: [554, 620] });
    const pose = measurePose({ landmarks, image });
    const expected = (Math.asin(((234 - 126) / 360) / 1.2) * 180) / Math.PI;
    expect(Math.abs(pose.yawDeg)).toBeCloseTo(expected, 4);
    expect(Math.abs(pose.yawDeg)).toBeGreaterThan(YAW_WARN_DEG);
  });

  it("drops eye openness when a lid closes", () => {
    const landmarks = neutralFace(image, {
      [LM_EYE_B.upper]: [580, 498],
      [LM_EYE_B.lower]: [580, 502],
    });
    const pose = measurePose({ landmarks, image });
    // The worse eye wins: 4 / 60.
    expect(pose.eyeOpenness).toBeCloseTo(4 / 60, 6);
    expect(pose.eyeOpenness).toBeLessThan(EYE_OPEN_MIN);
  });

  it("reports the mouth opening as a fraction of face height", () => {
    const landmarks = neutralFace(image, { [LM_LIP_LOWER_INNER]: [500, 810] });
    const pose = measurePose({ landmarks, image });
    expect(pose.mouthOpenRatio).toBeCloseTo(30 / 600, 6);
    expect(pose.mouthOpenRatio).toBeGreaterThan(MOUTH_OPEN_MAX);
  });

  it("rejects a short mesh like the head-bounds estimator", () => {
    expect(() =>
      measurePose({ landmarks: neutralFace(image).slice(0, 100), image }),
    ).toThrow(/468/);
  });
});

// ---------------------------------------------------------------------------
// Pixel metrics

function flat(width: number, height: number, rgb: [number, number, number]): PixelSource {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgb[0];
    data[i + 1] = rgb[1];
    data[i + 2] = rgb[2];
    data[i + 3] = 255;
  }
  return { data, width, height };
}

function paint(
  pixels: PixelSource,
  rect: Rect,
  colour: (x: number, y: number) => [number, number, number],
) {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      const [r, g, b] = colour(x, y);
      const i = (y * pixels.width + x) * 4;
      pixels.data[i] = r;
      pixels.data[i + 1] = g;
      pixels.data[i + 2] = b;
    }
  }
}

const FACE: Rect = { x: 40, y: 40, width: 120, height: 160 };

describe("measureFace", () => {
  it("averages luminance and splits the halves", () => {
    const pixels = flat(200, 300, [128, 128, 128]);
    // Left half of the face at 60, right half at 180.
    paint(pixels, FACE, (x) => (x < 100 ? [60, 60, 60] : [180, 180, 180]));
    const face = measureFace(pixels, FACE);
    expect(face.mean).toBeCloseTo(120, 0);
    expect(face.leftMean).toBeCloseTo(60, 6);
    expect(face.rightMean).toBeCloseTo(180, 6);
    expect(face.clipped).toBe(0);
    expect(face.samples).toBe(120 * 160);
  });

  it("counts clipped pixels", () => {
    const pixels = flat(200, 300, [255, 255, 255]);
    expect(measureFace(pixels, FACE).clipped).toBe(1);
  });

  it("handles an empty region without NaNs", () => {
    const pixels = flat(10, 10, [0, 0, 0]);
    const face = measureFace(pixels, { x: 20, y: 20, width: 5, height: 5 });
    expect(face.samples).toBe(0);
    expect(Number.isNaN(face.mean)).toBe(false);
  });
});

describe("measureSharpness", () => {
  it("is zero on a flat region and high on a fine checkerboard", () => {
    const flatPixels = flat(200, 300, [100, 100, 100]);
    expect(measureSharpness(flatPixels, FACE)).toBe(0);

    const checker = flat(200, 300, [100, 100, 100]);
    paint(checker, FACE, (x, y) => ((x + y) % 2 ? [255, 255, 255] : [0, 0, 0]));
    expect(measureSharpness(checker, FACE)).toBeGreaterThan(SHARPNESS_MIN * 10);
  });

  it("scores a smooth gradient as blurred", () => {
    const gradient = flat(200, 300, [0, 0, 0]);
    paint(gradient, FACE, (_x, y) => {
      const v = Math.round(((y - FACE.y) / FACE.height) * 255);
      return [v, v, v];
    });
    expect(measureSharpness(gradient, FACE)).toBeLessThan(SHARPNESS_MIN);
  });
});

describe("measureBackground", () => {
  const image: Size = { width: 400, height: 600 };
  const head = headBox({ yCrown: 100, yChin: 400, xLeft: 140, xRight: 260, xMidline: 200 });
  const rect: Rect = { x: 40, y: 40, width: 320, height: 480 };

  it("samples above the crown and beside the head, never the shoulders", () => {
    const pixels = flat(400, 600, [240, 240, 240]);
    // Paint the head (inside the padded span 110–290) dark and everything
    // below the chin dark too; only true background should remain light.
    paint(pixels, { x: 120, y: 90, width: 160, height: 310 }, () => [20, 20, 20]);
    paint(pixels, { x: 0, y: 400, width: 400, height: 200 }, () => [20, 20, 20]);
    const bg = measureBackground(pixels, { rect, head });
    expect(bg).not.toBeNull();
    expect(bg!.mean).toBeCloseTo(240, 6);
    expect(bg!.std).toBeCloseTo(0, 6);
  });

  it("uses the matte when one is given", () => {
    const pixels = flat(400, 600, [240, 240, 240]);
    // Whole image dark except a "background" block the matte marks as such.
    paint(pixels, { x: 0, y: 0, width: 400, height: 600 }, () => [20, 20, 20]);
    paint(pixels, { x: 300, y: 450, width: 60, height: 60 }, () => [200, 200, 200]);
    const mask = new Uint8Array(400 * 600).fill(255);
    for (let y = 450; y < 510; y++) for (let x = 300; x < 360; x++) mask[y * 400 + x] = 0;
    const bg = measureBackground(pixels, { rect, head, mask, maskSize: image });
    expect(bg!.mean).toBeCloseTo(200, 6);
    expect(bg!.samples).toBe(60 * 60);
  });

  it("returns null when nothing inside the crop is background", () => {
    const pixels = flat(400, 600, [240, 240, 240]);
    const tight: Rect = { x: 150, y: 150, width: 100, height: 200 };
    expect(measureBackground(pixels, { rect: tight, head })).toBeNull();
  });

  it("reports spread and chroma for a busy, coloured backdrop", () => {
    const pixels = flat(400, 600, [240, 240, 240]);
    paint(pixels, { x: 0, y: 0, width: 400, height: 600 }, (x) =>
      x % 2 ? [240, 200, 40] : [40, 40, 160],
    );
    const bg = measureBackground(pixels, { rect, head });
    expect(bg!.std).toBeGreaterThan(BACKGROUND_STD_MAX);
    expect(bg!.chroma).toBeGreaterThan(100);
  });
});

// ---------------------------------------------------------------------------
// Evaluator

const goodPose: PoseMetrics = { rollDeg: 1, yawDeg: 2, eyeOpenness: 0.3, mouthOpenRatio: 0 };
const goodBackground: BackgroundStats = {
  mean: 245, std: 3, chroma: 2, r: 245, g: 245, b: 245, samples: 1000,
};
const goodImage: ImageMetrics = {
  face: { mean: 140, std: 30, clipped: 0, leftMean: 142, rightMean: 138, samples: 1000 },
  sharpness: 800,
  background: goodBackground,
  hasMask: false,
};
const format = makeFormat();

function ids(report: ReturnType<typeof evaluateCompliance>, level: "warn" | "ok") {
  return report.checks.filter((c) => c.level === level).map((c) => c.id);
}

describe("evaluateCompliance", () => {
  it("passes a good photo on every check", () => {
    const report = evaluateCompliance({ pose: goodPose, image: goodImage, format, replacementFill: null });
    expect(report.level).toBe("ok");
    expect(ids(report, "ok")).toEqual([
      "pose-roll", "pose-yaw", "eyes-open", "expression",
      "exposure", "lighting", "sharpness", "background",
    ]);
  });

  it("only emits pose checks until the pixel scan has run", () => {
    const report = evaluateCompliance({ pose: goodPose, image: null, format, replacementFill: null });
    expect(report.checks.map((c) => c.id)).toEqual(["pose-roll", "pose-yaw", "eyes-open", "expression"]);
  });

  it("never escalates beyond warn, whatever is wrong", () => {
    const report = evaluateCompliance({
      pose: { rollDeg: 40, yawDeg: 45, eyeOpenness: 0, mouthOpenRatio: 0.2 },
      image: {
        face: { mean: 10, std: 1, clipped: 0, leftMean: 30, rightMean: 5, samples: 100 },
        sharpness: 0,
        background: { mean: 80, std: 90, chroma: 120, r: 200, g: 20, b: 20, samples: 100 },
        hasMask: false,
      },
      format,
      replacementFill: null,
    });
    expect(report.level).toBe("warn");
    expect(report.checks.every((c) => c.level !== "error")).toBe(true);
    expect(ids(report, "ok")).toEqual([]);
    // Every warning tells the user what to do about it.
    expect(report.checks.every((c) => c.hint && c.hint.length > 10)).toBe(true);
  });

  it("flags each pose threshold independently", () => {
    const at = (pose: Partial<PoseMetrics>) =>
      ids(evaluateCompliance({ pose: { ...goodPose, ...pose }, image: null, format, replacementFill: null }), "warn");
    expect(at({ rollDeg: -(ROLL_WARN_DEG + 0.5) })).toEqual(["pose-roll"]);
    expect(at({ yawDeg: YAW_WARN_DEG + 0.5 })).toEqual(["pose-yaw"]);
    expect(at({ eyeOpenness: EYE_OPEN_MIN - 0.01 })).toEqual(["eyes-open"]);
    expect(at({ mouthOpenRatio: MOUTH_OPEN_MAX + 0.01 })).toEqual(["expression"]);
  });

  it("flags exposure, lighting and sharpness thresholds", () => {
    const at = (image: Partial<ImageMetrics>, face: Partial<ImageMetrics["face"]> = {}) =>
      ids(
        evaluateCompliance({
          pose: goodPose,
          image: { ...goodImage, ...image, face: { ...goodImage.face, ...face } },
          format,
          replacementFill: null,
        }),
        "warn",
      );
    expect(at({}, { mean: FACE_LUMA_MIN - 1 })).toEqual(["exposure"]);
    expect(at({}, { mean: FACE_LUMA_MAX + 1 })).toEqual(["exposure"]);
    expect(at({}, { clipped: 0.2 })).toEqual(["exposure"]);
    expect(at({}, { leftMean: 100, rightMean: 100 * LIGHTING_RATIO_MAX + 1 })).toEqual(["lighting"]);
    expect(at({ sharpness: SHARPNESS_MIN - 1 })).toEqual(["sharpness"]);
  });

  it("flags a busy background, then a wrong colour", () => {
    const busy = evaluateCompliance({
      pose: goodPose,
      image: { ...goodImage, background: { ...goodBackground, std: BACKGROUND_STD_MAX + 1 } },
      format,
      replacementFill: null,
    });
    expect(busy.checks.find((c) => c.id === "background")?.message).toMatch(/not plain/);

    const grey = evaluateCompliance({
      pose: goodPose,
      image: { ...goodImage, background: { ...goodBackground, mean: 150, r: 150, g: 150, b: 150 } },
      format,
      replacementFill: null,
    });
    expect(grey.checks.find((c) => c.id === "background")?.message).toMatch(/should be white/);

    // The same grey is fine for a light-grey spec.
    const lightGrey = evaluateCompliance({
      pose: goodPose,
      image: { ...goodImage, background: { ...goodBackground, mean: 150, r: 150, g: 150, b: 150 } },
      format: makeFormat({ background: "light_grey" }),
      replacementFill: null,
    });
    expect(lightGrey.checks.find((c) => c.id === "background")?.level).toBe("ok");
  });

  it("treats a replaced background as compliant when the fill matches the spec", () => {
    const replaced = evaluateCompliance({
      pose: goodPose,
      image: { ...goodImage, background: { ...goodBackground, std: 80 } },
      format,
      replacementFill: "#ffffff",
    });
    const check = replaced.checks.find((c) => c.id === "background");
    expect(check?.level).toBe("ok");
    expect(check?.message).toMatch(/replaced with plain white/);

    const wrongFill = evaluateCompliance({
      pose: goodPose,
      image: goodImage,
      format,
      replacementFill: "#8FB8DE",
    });
    expect(wrongFill.checks.find((c) => c.id === "background")?.level).toBe("warn");
  });

  it("skips the background check when no background was sampled", () => {
    const report = evaluateCompliance({
      pose: goodPose,
      image: { ...goodImage, background: null },
      format,
      replacementFill: null,
    });
    expect(report.checks.some((c) => c.id === "background")).toBe(false);
  });
});

describe("backgroundColourMatches", () => {
  const grey = (v: number): BackgroundStats => ({ mean: v, std: 0, chroma: 0, r: v, g: v, b: v, samples: 1 });
  it("accepts the spec colours and rejects the rest", () => {
    expect(backgroundColourMatches("white", grey(250))).toBe(true);
    expect(backgroundColourMatches("white", grey(180))).toBe(false);
    expect(backgroundColourMatches("light_grey", grey(180))).toBe(true);
    expect(backgroundColourMatches("off_white", grey(190))).toBe(true);
    expect(backgroundColourMatches("blue", { ...grey(150), r: 120, g: 160, b: 220 })).toBe(true);
    expect(backgroundColourMatches("blue", grey(150))).toBe(false);
    expect(backgroundColourMatches("red", { ...grey(100), r: 200, g: 50, b: 50 })).toBe(true);
    expect(backgroundColourMatches("any", { ...grey(100), r: 200, g: 50, b: 50 })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Crop-solver centring check

describe("solveCrop centring check", () => {
  const format = makeFormat();
  const image = IMAGE_1000x1500;

  it("is ok for the auto crop", () => {
    const s = solveCrop({ head: headBox(), format, image });
    expect(s.validations.find((v) => v.id === "centring")?.level).toBe("ok");
  });

  it("warns, then errors, as the face is dragged off-centre", () => {
    const s = solveCrop({ head: headBox(), format, image });
    const width = s.rect.width;
    const at = (fraction: number) =>
      solveCrop({
        head: headBox(),
        format,
        image,
        adjust: { offsetX: fraction * width, offsetY: 0, scale: 1 },
      }).validations.find((v) => v.id === "centring");
    expect(at(0.04)?.level).toBe("ok");
    expect(at(0.08)?.level).toBe("warn");
    expect(at(0.08)?.message).toMatch(/off-centre to the left/);
    expect(at(-0.08)?.message).toMatch(/off-centre to the right/);
    // 16% of a 35 mm photo = 5.6 mm
    const bad = at(0.16);
    expect(bad?.level).toBe("error");
    expect(bad?.value).toBeCloseTo(0.16 * 35, 6);
  });

  it("does not escalate to error when the offset comes from clamping at the edge", () => {
    const s = solveCrop({ head: headBox({ xMidline: 960 }), format, image });
    expect(s.clamped).toBe(true);
    expect(s.validations.find((v) => v.id === "centring")?.level).toBe("warn");
    expect(s.level).toBe("warn");
  });
});

// ---------------------------------------------------------------------------
// Real photo: the bundled sample portrait through the pixel scan

describe("sample portrait", () => {
  const samplePath = fileURLToPath(
    new URL("../../../apps/web/public/sample-portrait.jpg", import.meta.url),
  );

  async function decode(blur = 0): Promise<PixelSource> {
    let img = sharp(readFileSync(samplePath)).ensureAlpha();
    if (blur) img = img.blur(blur);
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    return { data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), width: info.width, height: info.height };
  }

  // Hand-measured for the 820×1024 sample; the face mesh would give similar.
  const face: Rect = { x: 300, y: 90, width: 200, height: 260 };
  const head = headBox({ yCrown: 30, yChin: 350, xLeft: 300, xRight: 500, yEyes: 180, xMidline: 400 });
  const rect: Rect = { x: 150, y: 0, width: 500, height: 640 };

  it("is sharp, well exposed, evenly lit — and has a busy background", async () => {
    const pixels = await decode();
    const metrics = measureImage(pixels, { face, head, rect });
    expect(metrics.sharpness).toBeGreaterThan(SHARPNESS_MIN * 5);
    expect(metrics.face.mean).toBeGreaterThan(FACE_LUMA_MIN);
    expect(metrics.face.mean).toBeLessThan(FACE_LUMA_MAX);
    expect(metrics.background!.std).toBeGreaterThan(BACKGROUND_STD_MAX);

    const report = evaluateCompliance({ pose: goodPose, image: metrics, format: makeFormat(), replacementFill: null });
    expect(ids(report, "warn")).toEqual(["background"]);
  });

  it("detects the same photo as blurred after a 3 px gaussian blur", async () => {
    const pixels = await decode(3);
    expect(measureSharpness(pixels, face)).toBeLessThan(SHARPNESS_MIN);
  });
});
