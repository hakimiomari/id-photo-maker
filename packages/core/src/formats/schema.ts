import { z } from "zod";

/**
 * Runtime schema for the format registry. Validated in CI (see tests/formats.test.ts)
 * so a malformed or self-contradictory format entry can never ship.
 */

const mmRange = z.tuple([z.number().positive(), z.number().positive()]);

export const digitalSpecSchema = z.object({
  width_px: z.number().int().positive(),
  height_px: z.number().int().positive(),
  max_bytes: z.number().int().positive(),
  format: z.enum(["jpeg", "png"]),
});

export const photoFormatSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "id must be kebab-case"),
    label: z.record(z.string(), z.string()).refine((l) => "en" in l, {
      message: "label must include an 'en' key",
    }),
    category: z.enum(["passport", "visa", "license", "generic", "other"]),
    countries: z.array(z.string().regex(/^[A-Z]{2}$/, "ISO 3166-1 alpha-2")),
    width_mm: z.number().positive().max(300),
    height_mm: z.number().positive().max(300),
    head_min_mm: z.number().positive().nullable(),
    head_max_mm: z.number().positive().nullable(),
    eye_line_from_bottom_mm: mmRange.optional(),
    top_margin_mm: mmRange.optional(),
    min_dpi: z.number().int().min(72),
    target_dpi: z.number().int().min(72),
    background: z.enum([
      "white",
      "light_grey",
      "off_white",
      "any",
      "blue",
      "red",
    ]),
    digital_spec: digitalSpecSchema.optional(),
    retouch: z.enum(["strict", "lenient"]),
    source_url: z
      .string()
      .refine(
        (s) => s.startsWith("https://") || s.startsWith("internal:"),
        "source_url must be an https URL (or 'internal:' for unofficial formats)",
      ),
    verified_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "ISO date"),
    /**
     * Deviation from the original spec, added deliberately: seeded values must
     * not be presented to users as verified. The UI shows a stronger disclaimer
     * while this is "seeded".
     */
    verification_status: z.enum(["seeded", "verified"]),
    notes: z.string().optional(),
  })
  .superRefine((f, ctx) => {
    if (
      f.head_min_mm !== null &&
      f.head_max_mm !== null &&
      f.head_min_mm > f.head_max_mm
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "head_min_mm must be <= head_max_mm",
        path: ["head_min_mm"],
      });
    }
    if (f.head_max_mm !== null && f.head_max_mm > f.height_mm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "head_max_mm cannot exceed the photo height",
        path: ["head_max_mm"],
      });
    }
    for (const key of ["eye_line_from_bottom_mm", "top_margin_mm"] as const) {
      const range = f[key];
      if (range && range[0] > range[1]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${key} must be [min, max]`,
          path: [key],
        });
      }
      if (range && range[1] > f.height_mm) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${key} cannot exceed the photo height`,
          path: [key],
        });
      }
    }
    if (f.target_dpi < f.min_dpi) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "target_dpi must be >= min_dpi",
        path: ["target_dpi"],
      });
    }
  });

export const formatRegistrySchema = z.object({
  $comment: z.string().optional(),
  formats: z.array(photoFormatSchema).min(1),
});

export type ValidatedPhotoFormat = z.infer<typeof photoFormatSchema>;
