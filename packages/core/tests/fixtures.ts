import {
  LM_CHIN,
  LM_FOREHEAD_TOP,
  LM_IRIS_LEFT,
  LM_IRIS_RIGHT,
  LM_NOSE_BRIDGE,
} from "../src/detect/headBounds";
import type { HeadBox, Landmark, PhotoFormat, Size } from "../src/types";

/** A head box in working px, with sane defaults for the fields under test. */
export function headBox(overrides: Partial<HeadBox> = {}): HeadBox {
  const base: HeadBox = {
    yCrown: 200,
    yChin: 800,
    xLeft: 320,
    xRight: 680,
    yEyes: 430,
    xMidline: 500,
    crownSource: "heuristic",
  };
  return { ...base, ...overrides };
}

export const IMAGE_1000x1500: Size = { width: 1000, height: 1500 };

/**
 * A portrait with generous margins: every registered format's crop fits inside
 * IMAGE_1000x1500 without clamping, so format-wide assertions test the solver
 * rather than the clamp.
 */
export function wellFramedHead(): HeadBox {
  return headBox({ yCrown: 400, yChin: 900, yEyes: 591, xLeft: 350, xRight: 650 });
}

/**
 * Synthetic 478-point face mesh. Every point sits at the face centre except the
 * ones the estimator actually reads, so tests assert on exactly one variable.
 */
export function synthLandmarks(params: {
  image: Size;
  chinY: number;
  meshTopY: number;
  eyeY: number;
  midlineX: number;
  faceLeftX?: number;
  faceRightX?: number;
}): Landmark[] {
  const { image } = params;
  const nx = (px: number) => px / image.width;
  const ny = (px: number) => px / image.height;

  const landmarks: Landmark[] = Array.from({ length: 478 }, () => ({
    x: nx(params.midlineX),
    y: ny((params.meshTopY + params.chinY) / 2),
    z: 0,
  }));

  const set = (index: number, x: number, y: number) => {
    landmarks[index] = { x: nx(x), y: ny(y), z: 0 };
  };

  set(LM_CHIN, params.midlineX, params.chinY);
  set(LM_NOSE_BRIDGE, params.midlineX, params.eyeY);
  for (const index of LM_FOREHEAD_TOP) set(index, params.midlineX, params.meshTopY);
  set(LM_IRIS_LEFT, params.midlineX - 40, params.eyeY);
  set(LM_IRIS_RIGHT, params.midlineX + 40, params.eyeY);
  set(1, params.faceLeftX ?? params.midlineX - 180, params.chinY);
  set(2, params.faceRightX ?? params.midlineX + 180, params.chinY);

  return landmarks;
}

/** Minimal valid format for isolating one constraint at a time. */
export function makeFormat(overrides: Partial<PhotoFormat> = {}): PhotoFormat {
  return {
    id: "test-format",
    label: { en: "Test" },
    category: "generic",
    countries: [],
    width_mm: 35,
    height_mm: 45,
    head_min_mm: 32,
    head_max_mm: 36,
    min_dpi: 300,
    target_dpi: 600,
    background: "white",
    retouch: "lenient",
    source_url: "internal:generic-format",
    verified_date: "2026-01-01",
    verification_status: "seeded",
    ...overrides,
  };
}
