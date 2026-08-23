import { describe, expect, it } from "vitest";
import {
  alignmentGuide,
  assessFrame,
  CAPTURE_FILL,
  HEAD_TOO_LARGE,
  HEAD_TOO_SMALL,
  idealHeadFraction,
} from "../src/capture/guidance";
import { EYE_OPEN_MIN, ROLL_WARN_DEG } from "../src/compliance/evaluate";
import type { HeadBox, PoseMetrics, Size } from "../src/types";
import { headBox, makeFormat } from "./fixtures";

const format = makeFormat(); // 35×45, head 32–36 → target 34 mm
const landscape: Size = { width: 1920, height: 1080 };
const portrait: Size = { width: 720, height: 1280 };
const goodPose: PoseMetrics = { rollDeg: 0, yawDeg: 0, eyeOpenness: 0.3, mouthOpenRatio: 0 };

/** A head of the given height, centred in the frame. */
function centredHead(frame: Size, headPx: number, overrides: Partial<HeadBox> = {}): HeadBox {
  const yCrown = frame.height / 2 - headPx * 0.45;
  return headBox({
    yCrown,
    yChin: yCrown + headPx,
    yEyes: yCrown + headPx * 0.42,
    xLeft: frame.width / 2 - headPx * 0.3,
    xRight: frame.width / 2 + headPx * 0.3,
    xMidline: frame.width / 2,
    ...overrides,
  });
}

describe("idealHeadFraction", () => {
  it("is height-bound on a landscape frame", () => {
    // Crop fills 80% of the height; head is 34/45 of the crop.
    expect(idealHeadFraction(format, landscape)).toBeCloseTo(CAPTURE_FILL * (34 / 45), 10);
  });

  it("is width-bound on a narrow portrait frame", () => {
    // 80% of 720 px wide → crop height 576 / (35/45) = 740.6 px of 1280.
    const cropHeight = (720 * CAPTURE_FILL) / (35 / 45);
    expect(idealHeadFraction(format, portrait)).toBeCloseTo(((34 / 45) * cropHeight) / 1280, 10);
  });
});

describe("assessFrame", () => {
  const ideal = idealHeadFraction(format, landscape);

  it("asks for a face when there is none", () => {
    const g = assessFrame({ head: null, pose: null, format, frame: landscape });
    expect(g.status).toBe("no-face");
    expect(g.rect).toBeNull();
  });

  it("says good for a well-sized, centred, neutral head", () => {
    const head = centredHead(landscape, ideal * landscape.height);
    const g = assessFrame({ head, pose: goodPose, format, frame: landscape });
    expect(g.status).toBe("good");
    expect(g.code).toBe("good");
    expect(g.rect).not.toBeNull();
    expect(g.headFraction).toBeCloseTo(ideal, 10);
  });

  it("asks to move closer when the head is small, and back when it is large", () => {
    const small = centredHead(landscape, ideal * landscape.height * HEAD_TOO_SMALL * 0.9);
    expect(assessFrame({ head: small, pose: goodPose, format, frame: landscape }).code).toBe("closer");
    const large = centredHead(landscape, ideal * landscape.height * HEAD_TOO_LARGE * 1.1);
    expect(assessFrame({ head: large, pose: goodPose, format, frame: landscape }).code).toBe("back");
  });

  it("reports the cut-off edge when the crop clamps", () => {
    const headPx = ideal * landscape.height;
    // Crown almost at the top edge: no room above the head.
    const high = centredHead(landscape, headPx, { yCrown: 5, yChin: 5 + headPx, yEyes: 5 + headPx * 0.42 });
    expect(assessFrame({ head: high, pose: goodPose, format, frame: landscape }).code).toBe("space-above");
    // Chin at the bottom edge.
    const low = centredHead(landscape, headPx, {
      yCrown: 1080 - headPx - 5,
      yChin: 1075,
      yEyes: 1080 - headPx - 5 + headPx * 0.42,
    });
    expect(assessFrame({ head: low, pose: goodPose, format, frame: landscape }).code).toBe("move-up");
    // Face at the left edge.
    const left = centredHead(landscape, headPx, { xMidline: 60, xLeft: 10, xRight: 110 });
    expect(assessFrame({ head: left, pose: goodPose, format, frame: landscape }).code).toBe("centre");
  });

  it("checks pose and expression only once size and framing are right", () => {
    const head = centredHead(landscape, ideal * landscape.height);
    const at = (pose: Partial<PoseMetrics>) =>
      assessFrame({ head, pose: { ...goodPose, ...pose }, format, frame: landscape }).code;
    expect(at({ rollDeg: ROLL_WARN_DEG + 1 })).toBe("straighten");
    expect(at({ yawDeg: 20 })).toBe("face-camera");
    expect(at({ eyeOpenness: EYE_OPEN_MIN - 0.02 })).toBe("open-eyes");
    expect(at({ mouthOpenRatio: 0.1 })).toBe("close-mouth");

    // The same tilt on a too-small head still says "closer" first.
    const small = centredHead(landscape, ideal * landscape.height * 0.5);
    expect(
      assessFrame({ head: small, pose: { ...goodPose, rollDeg: 20 }, format, frame: landscape }).code,
    ).toBe("closer");
  });

  it("works without pose metrics", () => {
    const head = centredHead(landscape, ideal * landscape.height);
    expect(assessFrame({ head, pose: null, format, frame: landscape }).status).toBe("good");
  });
});

describe("alignmentGuide", () => {
  it("centres a crop of the format's aspect filling 80% of the height", () => {
    const guide = alignmentGuide(format, landscape);
    expect(guide.crop.height).toBeCloseTo(1080 * CAPTURE_FILL, 10);
    expect(guide.crop.width / guide.crop.height).toBeCloseTo(35 / 45, 10);
    expect(guide.crop.x + guide.crop.width / 2).toBeCloseTo(960, 10);
    expect(guide.crop.y + guide.crop.height / 2).toBeCloseTo(540, 10);
  });

  it("places the head oval inside the crop at the target head height", () => {
    const guide = alignmentGuide(format, landscape);
    expect(guide.head.height).toBeCloseTo((34 / 45) * guide.crop.height, 10);
    expect(guide.head.y).toBeGreaterThan(guide.crop.y);
    expect(guide.head.y + guide.head.height).toBeLessThan(guide.crop.y + guide.crop.height);
    expect(guide.head.x).toBeGreaterThan(guide.crop.x);
    expect(guide.head.x + guide.head.width).toBeLessThan(guide.crop.x + guide.crop.width);
  });

  it("honours an explicit top-margin spec", () => {
    const withMargin = makeFormat({ top_margin_mm: [3, 5] });
    const guide = alignmentGuide(withMargin, landscape);
    expect(guide.head.y - guide.crop.y).toBeCloseTo((4 / 45) * guide.crop.height, 10);
  });
});
