"use client";

/**
 * Editor localization (§5.8). One dictionary per locale, typed against the
 * English shape so a missing key is a compile error. Validation and compliance
 * messages are rebuilt here from each check's stable (id, level, variant) and
 * its measured values — core keeps producing English text as the fallback for
 * ids this file does not know.
 *
 * Dari and Pashto were machine-drafted and are awaiting native-speaker review.
 */

import { create } from "zustand";
import type { PhotoFormat, ValidationItem } from "@photomaker/core";
import { LOCALE_META, isLocale, type Locale } from "./locales";

/* ------------------------------------------------------------------ */
/* English — the authoritative shape                                    */
/* ------------------------------------------------------------------ */

const en = {
  tagline:
    "Passport and ID photos, sized correctly for printing. Everything runs in your browser — your photo never leaves your device.",
  onDevicePill: "100% on-device",
  noUploadsFooter: "No uploads. No tracking of your photos.",
  footerDisclaimer:
    "Not affiliated with any government. Always verify photo requirements with the issuing authority before submitting.",
  footerGerman:
    "German note: since 2025, photos for the Personalausweis and Reisepass must be transmitted digitally by a certified provider and cannot be produced with this app. Driving licence photos are still accepted on paper.",
  steps: { format: "Format", photo: "Photo", adjust: "Adjust", download: "Download" },
  hintIntro: "Drag to reposition · scroll or pinch to zoom ·",
  hintPan: "pan,",
  hintZoom: "zoom",
  useAnother: "Use another photo",
  languageAria: "Language",
  theme: { light: "Light", dark: "Dark", system: "System" },

  uploader: {
    title: "Add your photo",
    reading: "Reading your photo…",
    drop: "Drop it here",
    formats:
      "JPEG, PNG, WebP or HEIC. Face the camera, plain background, whole head visible with some space above it.",
    choose: "Choose a photo",
    take: "Take a photo",
    sample: "No photo handy? Try a sample photo",
    privacy: "Your photo is processed on your device and never uploaded.",
  },

  picker: {
    search: "Search: 3×4, passport, US, 35×45…",
    noMatch: (q: string) => `No format matches “${q}”. Try a size like 35x45, or a country.`,
    categories: {
      generic: "Common sizes",
      passport: "Passports",
      visa: "Visas",
      license: "Driving licences",
      other: "Other",
    },
    headRange: (a: number, b: number) => `head ${a}–${b}`,
  },

  checks: {
    eyebrow: "Checks",
    headline: { ok: "Ready to download", warn: "Usable, with warnings", error: "Not within spec" },
    framing: "Framing",
    quality: "Photo quality",
    scanning: "Checking exposure, sharpness and background…",
    beforeSubmit: "Before you submit",
    allConfirmed: "all confirmed",
    toConfirm: (n: number) => `${n} to confirm`,
    manualIntro: "These can't be checked automatically — confirm them yourself.",
    manual: {
      recent: "Taken within the last 6 months",
      glasses: "No glare on glasses; eyes fully visible (some countries: no glasses at all)",
      headwear: "No hat or head covering, unless worn daily for religious reasons",
      hair: "Hair not covering the eyes or eyebrows",
      clothing: "Everyday clothing — no uniform, and a colour that contrasts with the background",
    },
    reset: "Reset to auto crop",
    specNote: (date: string, seeded: boolean) =>
      `Spec last checked ${date}${seeded ? " (not yet re-verified)" : ""}. Photo-quality checks are automatic estimates — always confirm the requirements with the issuing authority.`,
  },

  check: {
    headHeightOk: (v: string, a: number, b: number) => `Head height: ${v} mm (required ${a}–${b} mm)`,
    headHeightOut: (v: string, a: number, b: number) => `Head height: ${v} mm — outside the required ${a}–${b} mm`,
    headHeightFree: (v: string) => `Head height: ${v} mm (no official requirement for this format)`,
    topMargin: (v: string, a: number, b: number) => `Space above head: ${v} mm (required ${a}–${b} mm)`,
    eyeLine: (v: string, a: number, b: number) => `Eye line from bottom: ${v} mm (required ${a}–${b} mm)`,
    centringOk: "Face is centred",
    centringOff: (v: string, side: "left" | "right") =>
      `Face is ${v} mm off-centre to the ${side === "right" ? "right" : "left"}`,
    centringHint: "Drag the photo so the face sits in the middle of the frame, or reset the crop.",
    resolutionOk: (v: number) => `Print resolution: ${v} DPI`,
    resolutionWarn: (v: number, min: number) =>
      `Print resolution: ${v} DPI — below the recommended ${min} DPI, print quality will suffer`,
    resolutionErr: (v: number) => `Print resolution: ${v} DPI — too low to print. Use a higher-resolution photo.`,
    framingWarn: "The crop reaches the edge of the photo; a little more space around the head would be safer.",
    framingErr: "Photo doesn't have enough room around the head — retake with more space above the head and at the sides.",
    poseRollOk: "Head is upright",
    poseRollBad: (deg: number) => `Head is tilted about ${deg}°`,
    poseRollHint: "Keep the head upright — the line through both eyes should be level.",
    poseYawOk: "Facing the camera",
    poseYawBad: (deg: number) => `Head is turned about ${deg}° to the side`,
    poseYawHint: "Face the camera directly, with both ears equally visible.",
    eyesOk: "Eyes are open",
    eyesClosed: "Eyes look closed or nearly closed",
    eyesHint: "Both eyes must be open and clearly visible, looking at the camera.",
    expressionOk: "Neutral expression",
    mouthOpen: "Mouth looks open — keep a neutral expression",
    expressionHint: "Close the mouth; no smile, no raised eyebrows.",
    exposureOk: "Exposure looks good",
    exposureDark: "Face is too dark",
    exposureDarkHint: "Use more light from the front, or raise brightness in Adjust.",
    exposureBright: "Face is overexposed",
    exposureBrightHint: "Avoid direct flash and bright windows behind the camera; lower brightness in Adjust.",
    lightingOk: "Lighting is even",
    lightingUneven: "Lighting is uneven — one side of the face is darker",
    lightingHint: "Light the face evenly from the front; avoid a window or lamp to one side.",
    sharpOk: "Photo is sharp",
    sharpSoft: "Photo looks soft or blurred",
    sharpHint: "Focus on the eyes, hold the camera steady, and use the original full-size photo rather than a screenshot.",
    bgReplacedAny: "Background will be replaced with a plain colour",
    bgReplaced: (colour: string) => `Background will be replaced with plain ${colour}`,
    bgFillMismatch: (colour: string) => `Background should be ${colour} — a different fill is selected`,
    bgFillMismatchHint: "Pick the required colour under Background before downloading.",
    bgBusy: "Background is not plain",
    bgBusyHint: "Stand in front of a plain, evenly lit wall — or use Remove background below.",
    bgWrongColour: (colour: string) => `Background should be ${colour} — yours looks different`,
    bgWrongColourHint: "Use Remove background below to replace it with the required colour.",
    bgPlainAny: "Background is plain",
    bgPlain: (colour: string) => `Background is plain ${colour}`,
  },

  bgNames: {
    white: "white",
    light_grey: "light grey",
    off_white: "off-white",
    blue: "blue",
    red: "red",
    any: "a plain colour",
  } as Record<string, string>,

  retouch: {
    eyebrow: "Retouch",
    lockedNote:
      "Retouching is disabled for this document: the issuing authority rejects digitally altered photos. Available for CV and unofficial formats.",
    intro: "Manual tools — you aim every change, nothing is altered automatically.",
    heal: "Heal spots",
    smooth: "Smooth skin",
    attire: "Attire",
    off: "Off",
    healHint: "Tap a blemish to blend it into the surrounding skin.",
    smoothHint: "Paint over skin to soften it. Keep it subtle.",
    attireHint: "Drag to position. Use a PNG with transparency for best results.",
    brushSize: "Brush size",
    strength: "Strength",
    uploadAttire: "Upload attire (tie, collar…)",
    attireWidth: "Size",
    attireRotation: "Rotation",
    removeAttire: "Remove attire",
    undo: "Undo",
    clearAll: "Clear all retouching",
    editsApplied: (n: number) => (n === 1 ? "1 edit" : `${n} edits`),
  },
  adjust: {
    eyebrow: "Fine-tune",
    brightness: "Brightness",
    contrast: "Contrast",
    saturation: "Saturation",
    subtle: "Keep edits subtle. Many authorities reject retouched or heavily filtered photos.",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
  },

  bg: {
    eyebrow: "Background",
    desc: "Replace the background with the colour this document requires — processed entirely on your device.",
    remove: "Remove background",
    detecting: "Detecting outline…",
    modelNote:
      "Loads a 25 MB matting model on first use; cached after that. The head measurement also becomes more precise, using the exact hair outline instead of an estimate.",
    requiredChip: (name: string) => `Required · ${name}`,
    presetWhite: "White",
    presetLightGrey: "Light grey",
    presetOffWhite: "Off-white",
    custom: "Custom",
    softness: "Edge softness",
    showOriginal: "Show original",
    showingOriginal: "Showing original",
    keepOriginal: "Keep original",
    crownNote: "Head height is now measured from the exact hair outline (more accurate for tall hair).",
  },

  exportP: {
    eyebrow: "Download",
    printFile: "Print file",
    printsAt: "Prints at exactly",
    fileType: "File type",
    jpegRec: "JPEG · recommended",
    png: "PNG",
    downloadPhoto: (fmt: string) => `Download photo (${fmt})`,
    preparing: "Preparing…",
    onlineFile: (w: number, h: number, size: string) =>
      `Online-application file · ${w} × ${h} px, max ${size}`,
    blocked: "Fix the checks above before downloading — this crop would be rejected.",
  },

  sheet: {
    eyebrow: "Print sheet",
    paperSize: "Paper size",
    perSheet: (n: number) => `${n} photos`,
    perSheetTail: "per sheet · 2 mm gaps · cut marks included",
    pdfRec: "PDF · recommended",
    jpeg: "JPEG",
    downloadSheet: (fmt: string) => `Download sheet (${fmt})`,
    preparingSheet: "Preparing sheet…",
    help: (paper: string) =>
      `Order a plain ${paper} photo print at any drugstore, then cut along the marks. Prefer the PDF where possible — it prints true to size more reliably.`,
    noFit: (paper: string) => `This photo format doesn't fit on ${paper} — pick a larger paper.`,
  },

  family: {
    eyebrow: "Family sheet",
    intro:
      "Doing photos for several people? Add this photo, then load the next person — everyone shares one print, cut apart after printing.",
    addFirst: "Add this photo to a family sheet",
    addToo: "Add this photo too",
    adding: "Adding…",
    addAnother: "Add another person (load their photo)",
    people: (n: number) => (n === 1 ? "1 person" : `${n} people`),
    photosOn: (copies: number, paper: string, counts: string) =>
      `${copies} photos on ${paper} (${counts} each)`,
    noFit: (n: number, paper: string) =>
      `${n} people don't fit on ${paper} — pick a larger paper in the Print sheet panel.`,
    downloadFamily: (fmt: string) => `Download family sheet (${fmt})`,
    clear: "Clear the family sheet",
    removePerson: (label: string) => `Remove ${label}`,
    person: (n: number) => `Person ${n}`,
    mismatch: (label: string) =>
      `This family sheet is ${label} — switch back to that format to add more people, or clear the batch.`,
  },

  result: {
    photoReady: "Your photo is ready.",
    sheetReady: "Your print sheet is ready.",
    familyReady: "Your family sheet is ready.",
    save: "Save",
    keepEditing: "Keep editing",
    perPerson: (counts: string) => `(${counts} per person)`,
    adviceSheet:
      "Order this as a normal photo print, then cut along the marks. Choose “actual size” when printing — never “fit to page”.",
    advicePhoto:
      "The file carries its physical size — choose “actual size” / “no scaling” when printing. For the cheapest prints, use the print sheet below.",
  },

  camera: {
    hints: {
      "no-face": "Position your face inside the oval",
      closer: "Move closer",
      back: "Move back a little",
      centre: "Centre your face in the frame",
      "space-above": "Leave more space above your head",
      "move-up": "Move up — your chin is too close to the bottom edge",
      straighten: "Keep your head straight",
      "face-camera": "Look straight at the camera",
      "open-eyes": "Open your eyes",
      "close-mouth": "Close your mouth — neutral expression",
      good: "Looking good — hold still",
    } as Record<string, string>,
    searching: "Looking for your face…",
    starting: "Starting camera…",
    takingPhoto: "Taking the photo…",
    takeIn: (n: number) => `Taking photo in ${n}…`,
    takeBtn: (n: number) => `Take photo (${n} s timer)`,
    switchCam: "Switch camera",
    cancel: "Cancel",
    liveLocal: "Live video stays on your device",
    tips: "Plain, evenly lit wall behind you · light on your face, not behind you · camera at eye level · glasses off if you can.",
    cameraFailed: "The camera could not be started.",
    captureFailed: "Could not take the photo.",
  },

  errors: {
    "file-too-large": "That file is too large (max 40 MB).",
    "too-many-pixels": "That photo has too many pixels (max 50 MP).",
    "unsupported-type": "That file type isn't supported. Use a JPEG, PNG, WebP or HEIC photo.",
    "decode-failed": "That image could not be opened. It may be corrupted or in an unsupported format.",
    "detect-failed": "Face detection failed. Please try again.",
    "no-face": "No face found in that photo. Use a clear, front-facing portrait with the whole head visible.",
    "segment-failed": "Background removal failed. Please try again.",
    "encode-failed": "The photo could not be exported. Please try again.",
    "sheet-failed": "The print sheet could not be created. Please try again.",
    "batch-sheet-failed": "The family sheet could not be created. Please try again.",
  } as Record<string, string>,
};

export type Dict = typeof en;

/* ------------------------------------------------------------------ */
/* German                                                              */
/* ------------------------------------------------------------------ */

const de: Dict = {
  tagline:
    "Pass- und ID-Fotos, korrekt fürs Drucken zugeschnitten. Alles läuft in Ihrem Browser — Ihr Foto verlässt nie Ihr Gerät.",
  onDevicePill: "100 % auf Ihrem Gerät",
  noUploadsFooter: "Keine Uploads. Kein Tracking Ihrer Fotos.",
  footerDisclaimer:
    "Keine Behörde. Prüfen Sie die Fotoanforderungen immer bei der ausstellenden Stelle.",
  footerGerman:
    "Hinweis: Seit 2025 müssen Fotos für Personalausweis und Reisepass digital von einem zertifizierten Anbieter übermittelt werden und können mit dieser App nicht erstellt werden. Führerschein-Fotos werden weiterhin auf Papier akzeptiert.",
  steps: { format: "Format", photo: "Foto", adjust: "Anpassen", download: "Download" },
  hintIntro: "Ziehen zum Verschieben · Scrollen oder Kneifen zum Zoomen ·",
  hintPan: "verschieben,",
  hintZoom: "zoomen",
  useAnother: "Anderes Foto verwenden",
  languageAria: "Sprache",
  theme: { light: "Hell", dark: "Dunkel", system: "System" },

  uploader: {
    title: "Foto hinzufügen",
    reading: "Foto wird gelesen…",
    drop: "Hier ablegen",
    formats:
      "JPEG, PNG, WebP oder HEIC. Frontal in die Kamera schauen, einfarbiger Hintergrund, ganzer Kopf mit etwas Platz darüber.",
    choose: "Foto auswählen",
    take: "Foto aufnehmen",
    sample: "Kein Foto zur Hand? Beispielfoto ausprobieren",
    privacy: "Ihr Foto wird auf Ihrem Gerät verarbeitet und nie hochgeladen.",
  },

  picker: {
    search: "Suche: 3×4, Reisepass, US, 35×45…",
    noMatch: (q) => `Kein Format passt zu „${q}“. Versuchen Sie eine Größe wie 35x45 oder ein Land.`,
    categories: {
      generic: "Gängige Größen",
      passport: "Reisepässe",
      visa: "Visa",
      license: "Führerscheine",
      other: "Sonstige",
    },
    headRange: (a, b) => `Kopf ${a}–${b}`,
  },

  checks: {
    eyebrow: "Prüfungen",
    headline: { ok: "Bereit zum Download", warn: "Brauchbar, mit Hinweisen", error: "Nicht vorschriftsgemäß" },
    framing: "Bildaufbau",
    quality: "Fotoqualität",
    scanning: "Belichtung, Schärfe und Hintergrund werden geprüft…",
    beforeSubmit: "Vor dem Einreichen",
    allConfirmed: "alle bestätigt",
    toConfirm: (n) => `${n} zu bestätigen`,
    manualIntro: "Diese Punkte lassen sich nicht automatisch prüfen — bestätigen Sie sie selbst.",
    manual: {
      recent: "In den letzten 6 Monaten aufgenommen",
      glasses: "Keine Reflexe auf der Brille; Augen voll sichtbar (manche Länder: ganz ohne Brille)",
      headwear: "Keine Kopfbedeckung, außer aus religiösen Gründen täglich getragen",
      hair: "Haare verdecken weder Augen noch Augenbrauen",
      clothing: "Alltagskleidung — keine Uniform, Farbe mit Kontrast zum Hintergrund",
    },
    reset: "Auf Auto-Zuschnitt zurücksetzen",
    specNote: (date, seeded) =>
      `Vorgaben zuletzt geprüft am ${date}${seeded ? " (noch nicht erneut verifiziert)" : ""}. Qualitätsprüfungen sind automatische Schätzungen — bestätigen Sie die Anforderungen immer bei der ausstellenden Stelle.`,
  },

  check: {
    headHeightOk: (v, a, b) => `Kopfhöhe: ${v} mm (gefordert ${a}–${b} mm)`,
    headHeightOut: (v, a, b) => `Kopfhöhe: ${v} mm — außerhalb der geforderten ${a}–${b} mm`,
    headHeightFree: (v) => `Kopfhöhe: ${v} mm (keine offizielle Vorgabe für dieses Format)`,
    topMargin: (v, a, b) => `Abstand über dem Kopf: ${v} mm (gefordert ${a}–${b} mm)`,
    eyeLine: (v, a, b) => `Augenlinie von unten: ${v} mm (gefordert ${a}–${b} mm)`,
    centringOk: "Gesicht ist mittig",
    centringOff: (v, side) =>
      `Gesicht ist ${v} mm ${side === "right" ? "nach rechts" : "nach links"} versetzt`,
    centringHint: "Ziehen Sie das Foto, bis das Gesicht mittig sitzt, oder setzen Sie den Zuschnitt zurück.",
    resolutionOk: (v) => `Druckauflösung: ${v} DPI`,
    resolutionWarn: (v, min) =>
      `Druckauflösung: ${v} DPI — unter den empfohlenen ${min} DPI, die Druckqualität leidet`,
    resolutionErr: (v) => `Druckauflösung: ${v} DPI — zu niedrig zum Drucken. Verwenden Sie ein höher aufgelöstes Foto.`,
    framingWarn: "Der Zuschnitt reicht bis an den Fotorand; etwas mehr Platz um den Kopf wäre sicherer.",
    framingErr: "Das Foto hat zu wenig Platz um den Kopf — neu aufnehmen, mit mehr Abstand über dem Kopf und seitlich.",
    poseRollOk: "Kopf ist gerade",
    poseRollBad: (deg) => `Kopf ist um etwa ${deg}° geneigt`,
    poseRollHint: "Kopf gerade halten — die Linie durch beide Augen sollte waagerecht sein.",
    poseYawOk: "Blick zur Kamera",
    poseYawBad: (deg) => `Kopf ist um etwa ${deg}° zur Seite gedreht`,
    poseYawHint: "Direkt in die Kamera schauen, beide Ohren gleich sichtbar.",
    eyesOk: "Augen sind offen",
    eyesClosed: "Augen wirken geschlossen oder fast geschlossen",
    eyesHint: "Beide Augen müssen offen und klar sichtbar sein, Blick in die Kamera.",
    expressionOk: "Neutraler Gesichtsausdruck",
    mouthOpen: "Mund wirkt geöffnet — neutralen Ausdruck halten",
    expressionHint: "Mund schließen; nicht lächeln, Augenbrauen nicht heben.",
    exposureOk: "Belichtung sieht gut aus",
    exposureDark: "Gesicht ist zu dunkel",
    exposureDarkHint: "Mehr Licht von vorn verwenden oder die Helligkeit unter „Anpassen“ erhöhen.",
    exposureBright: "Gesicht ist überbelichtet",
    exposureBrightHint: "Direkten Blitz und helle Fenster hinter der Kamera vermeiden; Helligkeit unter „Anpassen“ senken.",
    lightingOk: "Ausleuchtung ist gleichmäßig",
    lightingUneven: "Ausleuchtung ist ungleichmäßig — eine Gesichtshälfte ist dunkler",
    lightingHint: "Gesicht gleichmäßig von vorn ausleuchten; Fenster oder Lampe seitlich vermeiden.",
    sharpOk: "Foto ist scharf",
    sharpSoft: "Foto wirkt weich oder verwackelt",
    sharpHint: "Auf die Augen fokussieren, Kamera ruhig halten und das Original in voller Größe statt eines Screenshots verwenden.",
    bgReplacedAny: "Hintergrund wird durch eine einfarbige Fläche ersetzt",
    bgReplaced: (colour) => `Hintergrund wird durch einfarbiges ${colour} ersetzt`,
    bgFillMismatch: (colour) => `Hintergrund sollte ${colour} sein — eine andere Farbe ist gewählt`,
    bgFillMismatchHint: "Wählen Sie unter „Hintergrund“ die geforderte Farbe, bevor Sie herunterladen.",
    bgBusy: "Hintergrund ist nicht einfarbig",
    bgBusyHint: "Vor eine einfarbige, gleichmäßig beleuchtete Wand stellen — oder unten „Hintergrund entfernen“ nutzen.",
    bgWrongColour: (colour) => `Hintergrund sollte ${colour} sein — Ihrer sieht anders aus`,
    bgWrongColourHint: "Nutzen Sie unten „Hintergrund entfernen“, um ihn durch die geforderte Farbe zu ersetzen.",
    bgPlainAny: "Hintergrund ist einfarbig",
    bgPlain: (colour) => `Hintergrund ist einfarbig ${colour}`,
  },

  bgNames: {
    white: "Weiß",
    light_grey: "Hellgrau",
    off_white: "Cremeweiß",
    blue: "Blau",
    red: "Rot",
    any: "eine einfarbige Fläche",
  },

  retouch: {
    eyebrow: "Retusche",
    lockedNote:
      "Retusche ist für dieses Dokument deaktiviert: Die ausstellende Behörde lehnt digital veränderte Fotos ab. Verfügbar für Bewerbungsfotos und inoffizielle Formate.",
    intro: "Manuelle Werkzeuge — Sie steuern jede Änderung, nichts passiert automatisch.",
    heal: "Flecken entfernen",
    smooth: "Haut glätten",
    attire: "Kleidung",
    off: "Aus",
    healHint: "Tippen Sie auf eine Unreinheit, um sie an die umgebende Haut anzugleichen.",
    smoothHint: "Über die Haut malen, um sie zu glätten. Dezent bleiben.",
    attireHint: "Zum Positionieren ziehen. Am besten ein PNG mit Transparenz verwenden.",
    brushSize: "Pinselgröße",
    strength: "Stärke",
    uploadAttire: "Kleidung hochladen (Krawatte, Kragen…)",
    attireWidth: "Größe",
    attireRotation: "Drehung",
    removeAttire: "Kleidung entfernen",
    undo: "Rückgängig",
    clearAll: "Gesamte Retusche entfernen",
    editsApplied: (n) => (n === 1 ? "1 Änderung" : `${n} Änderungen`),
  },
  adjust: {
    eyebrow: "Feinjustierung",
    brightness: "Helligkeit",
    contrast: "Kontrast",
    saturation: "Sättigung",
    subtle: "Dezent bleiben. Viele Behörden lehnen retuschierte oder stark gefilterte Fotos ab.",
    zoomIn: "Vergrößern",
    zoomOut: "Verkleinern",
  },

  bg: {
    eyebrow: "Hintergrund",
    desc: "Ersetzen Sie den Hintergrund durch die geforderte Farbe — vollständig auf Ihrem Gerät verarbeitet.",
    remove: "Hintergrund entfernen",
    detecting: "Umriss wird erkannt…",
    modelNote:
      "Lädt beim ersten Mal ein 25-MB-Modell, danach im Cache. Die Kopfmessung wird zudem genauer, weil der exakte Haarumriss verwendet wird.",
    requiredChip: (name) => `Gefordert · ${name}`,
    presetWhite: "Weiß",
    presetLightGrey: "Hellgrau",
    presetOffWhite: "Cremeweiß",
    custom: "Eigene",
    softness: "Kantenweichheit",
    showOriginal: "Original zeigen",
    showingOriginal: "Original wird gezeigt",
    keepOriginal: "Original behalten",
    crownNote: "Die Kopfhöhe wird jetzt am exakten Haarumriss gemessen (genauer bei hohem Haar).",
  },

  exportP: {
    eyebrow: "Download",
    printFile: "Druckdatei",
    printsAt: "Druckt exakt in",
    fileType: "Dateityp",
    jpegRec: "JPEG · empfohlen",
    png: "PNG",
    downloadPhoto: (fmt) => `Foto herunterladen (${fmt})`,
    preparing: "Wird vorbereitet…",
    onlineFile: (w, h, size) => `Datei für Online-Anträge · ${w} × ${h} px, max. ${size}`,
    blocked: "Beheben Sie erst die Prüfungen oben — dieser Zuschnitt würde abgelehnt.",
  },

  sheet: {
    eyebrow: "Druckbogen",
    paperSize: "Papierformat",
    perSheet: (n) => `${n} Fotos`,
    perSheetTail: "pro Bogen · 2 mm Abstand · mit Schnittmarken",
    pdfRec: "PDF · empfohlen",
    jpeg: "JPEG",
    downloadSheet: (fmt) => `Bogen herunterladen (${fmt})`,
    preparingSheet: "Bogen wird vorbereitet…",
    help: (paper) =>
      `Bestellen Sie einen normalen ${paper}-Fotoabzug in der Drogerie und schneiden Sie entlang der Marken. Wenn möglich das PDF nehmen — es druckt zuverlässiger in Originalgröße.`,
    noFit: (paper) => `Dieses Fotoformat passt nicht auf ${paper} — wählen Sie ein größeres Papier.`,
  },

  family: {
    eyebrow: "Familienbogen",
    intro:
      "Fotos für mehrere Personen? Fügen Sie dieses Foto hinzu und laden Sie dann die nächste Person — alle teilen sich einen Abzug, nach dem Drucken auseinanderschneiden.",
    addFirst: "Dieses Foto zum Familienbogen hinzufügen",
    addToo: "Dieses Foto auch hinzufügen",
    adding: "Wird hinzugefügt…",
    addAnother: "Weitere Person hinzufügen (ihr Foto laden)",
    people: (n) => (n === 1 ? "1 Person" : `${n} Personen`),
    photosOn: (copies, paper, counts) => `${copies} Fotos auf ${paper} (je ${counts})`,
    noFit: (n, paper) => `${n} Personen passen nicht auf ${paper} — größeres Papier im Druckbogen-Bereich wählen.`,
    downloadFamily: (fmt) => `Familienbogen herunterladen (${fmt})`,
    clear: "Familienbogen leeren",
    removePerson: (label) => `${label} entfernen`,
    person: (n) => `Person ${n}`,
    mismatch: (label) =>
      `Dieser Familienbogen ist ${label} — wechseln Sie zurück zu diesem Format oder leeren Sie den Bogen.`,
  },

  result: {
    photoReady: "Ihr Foto ist fertig.",
    sheetReady: "Ihr Druckbogen ist fertig.",
    familyReady: "Ihr Familienbogen ist fertig.",
    save: "Speichern",
    keepEditing: "Weiter bearbeiten",
    perPerson: (counts) => `(${counts} pro Person)`,
    adviceSheet:
      "Als normalen Fotoabzug bestellen und entlang der Marken schneiden. Beim Drucken „tatsächliche Größe“ wählen — nie „an Seite anpassen“.",
    advicePhoto:
      "Die Datei enthält ihre physische Größe — beim Drucken „tatsächliche Größe“ / „keine Skalierung“ wählen. Am günstigsten drucken Sie mit dem Druckbogen unten.",
  },

  camera: {
    hints: {
      "no-face": "Positionieren Sie Ihr Gesicht im Oval",
      closer: "Näher herankommen",
      back: "Etwas zurückgehen",
      centre: "Gesicht in der Mitte des Bildes positionieren",
      "space-above": "Mehr Platz über dem Kopf lassen",
      "move-up": "Höher — das Kinn ist zu nah am unteren Rand",
      straighten: "Kopf gerade halten",
      "face-camera": "Direkt in die Kamera schauen",
      "open-eyes": "Augen öffnen",
      "close-mouth": "Mund schließen — neutraler Ausdruck",
      good: "Sieht gut aus — still halten",
    },
    searching: "Gesicht wird gesucht…",
    starting: "Kamera startet…",
    takingPhoto: "Foto wird aufgenommen…",
    takeIn: (n) => `Aufnahme in ${n}…`,
    takeBtn: (n) => `Foto aufnehmen (${n} s Timer)`,
    switchCam: "Kamera wechseln",
    cancel: "Abbrechen",
    liveLocal: "Das Live-Video bleibt auf Ihrem Gerät",
    tips: "Einfarbige, gleichmäßig beleuchtete Wand hinter Ihnen · Licht aufs Gesicht, nicht von hinten · Kamera auf Augenhöhe · Brille möglichst abnehmen.",
    cameraFailed: "Die Kamera konnte nicht gestartet werden.",
    captureFailed: "Das Foto konnte nicht aufgenommen werden.",
  },

  errors: {
    "file-too-large": "Die Datei ist zu groß (max. 40 MB).",
    "too-many-pixels": "Das Foto hat zu viele Pixel (max. 50 MP).",
    "unsupported-type": "Dieser Dateityp wird nicht unterstützt. Verwenden Sie JPEG, PNG, WebP oder HEIC.",
    "decode-failed": "Das Bild konnte nicht geöffnet werden. Es ist eventuell beschädigt oder in einem nicht unterstützten Format.",
    "detect-failed": "Die Gesichtserkennung ist fehlgeschlagen. Bitte erneut versuchen.",
    "no-face": "Kein Gesicht gefunden. Verwenden Sie ein klares, frontales Porträt mit dem ganzen Kopf im Bild.",
    "segment-failed": "Die Hintergrundentfernung ist fehlgeschlagen. Bitte erneut versuchen.",
    "encode-failed": "Das Foto konnte nicht exportiert werden. Bitte erneut versuchen.",
    "sheet-failed": "Der Druckbogen konnte nicht erstellt werden. Bitte erneut versuchen.",
    "batch-sheet-failed": "Der Familienbogen konnte nicht erstellt werden. Bitte erneut versuchen.",
  },
};

/* ------------------------------------------------------------------ */
/* Dari (fa-AF) — machine-drafted, awaiting native review              */
/* ------------------------------------------------------------------ */

const fa: Dict = {
  tagline:
    "عکس‌های پاسپورت و کارت هویت، با اندازهٔ درست برای چاپ. همه‌چیز در مرورگر شما اجرا می‌شود — عکس شما هرگز از دستگاه‌تان خارج نمی‌شود.",
  onDevicePill: "100٪ روی دستگاه شما",
  noUploadsFooter: "بدون آپلود. بدون ردیابی عکس‌های شما.",
  footerDisclaimer:
    "این ابزار به هیچ نهاد دولتی وابسته نیست. شرایط عکس را همیشه از مرجع صادرکننده تأیید کنید.",
  footerGerman:
    "یادداشت آلمان: از سال 2025 عکس‌های کارت هویت و پاسپورت آلمان باید به صورت دیجیتال توسط ارائه‌دهندهٔ تأییدشده ارسال شوند و با این برنامه قابل تهیه نیستند. عکس جواز رانندگی هنوز به صورت کاغذی پذیرفته می‌شود.",
  steps: { format: "قالب", photo: "عکس", adjust: "تنظیم", download: "دانلود" },
  hintIntro: "برای جابه‌جایی بکشید · برای بزرگ‌نمایی اسکرول یا دو انگشت ·",
  hintPan: "جابه‌جایی،",
  hintZoom: "بزرگ‌نمایی",
  useAnother: "استفاده از عکس دیگر",
  languageAria: "زبان",
  theme: { light: "روشن", dark: "تاریک", system: "سیستم" },

  uploader: {
    title: "عکس خود را اضافه کنید",
    reading: "در حال خواندن عکس…",
    drop: "اینجا رها کنید",
    formats:
      "JPEG، PNG، WebP یا HEIC. رو به کمره، پس‌زمینهٔ ساده، تمام سر با کمی فضا در بالای آن دیده شود.",
    choose: "انتخاب عکس",
    take: "گرفتن عکس",
    sample: "عکسی ندارید؟ عکس نمونه را امتحان کنید",
    privacy: "عکس شما روی دستگاه‌تان پردازش می‌شود و هرگز آپلود نمی‌شود.",
  },

  picker: {
    search: "جستجو: 3×4، پاسپورت، امریکا، 35×45…",
    noMatch: (q) => `هیچ قالبی با «${q}» مطابقت ندارد. اندازه‌ای مانند 35x45 یا نام کشور را امتحان کنید.`,
    categories: {
      generic: "اندازه‌های رایج",
      passport: "پاسپورت‌ها",
      visa: "ویزاها",
      license: "جواز رانندگی",
      other: "سایر",
    },
    headRange: (a, b) => `سر ${a}–${b}`,
  },

  checks: {
    eyebrow: "بررسی‌ها",
    headline: { ok: "آمادهٔ دانلود", warn: "قابل استفاده، با هشدار", error: "مطابق مقررات نیست" },
    framing: "قاب‌بندی",
    quality: "کیفیت عکس",
    scanning: "در حال بررسی نور، وضوح و پس‌زمینه…",
    beforeSubmit: "پیش از ارسال",
    allConfirmed: "همه تأیید شد",
    toConfirm: (n) => `${n} مورد برای تأیید`,
    manualIntro: "این موارد به صورت خودکار قابل بررسی نیستند — خودتان تأیید کنید.",
    manual: {
      recent: "در ۶ ماه اخیر گرفته شده باشد",
      glasses: "بدون انعکاس نور روی عینک؛ چشم‌ها کاملاً دیده شوند (بعضی کشورها: بدون عینک)",
      headwear: "بدون کلاه یا پوشش سر، مگر به دلایل دینی که هر روز پوشیده می‌شود",
      hair: "مو روی چشم‌ها یا ابروها نباشد",
      clothing: "لباس معمولی — بدون یونیفورم، با رنگی متفاوت از پس‌زمینه",
    },
    reset: "بازگشت به برش خودکار",
    specNote: (date, seeded) =>
      `آخرین بررسی مشخصات: ${date}${seeded ? " (هنوز دوباره تأیید نشده)" : ""}. بررسی‌های کیفیت تخمین خودکار است — شرایط را همیشه از مرجع صادرکننده تأیید کنید.`,
  },

  check: {
    headHeightOk: (v, a, b) => `ارتفاع سر: ${v} میلی‌متر (لازم: ${a}–${b} میلی‌متر)`,
    headHeightOut: (v, a, b) => `ارتفاع سر: ${v} میلی‌متر — خارج از محدودهٔ لازم ${a}–${b} میلی‌متر`,
    headHeightFree: (v) => `ارتفاع سر: ${v} میلی‌متر (برای این قالب شرط رسمی ندارد)`,
    topMargin: (v, a, b) => `فضای بالای سر: ${v} میلی‌متر (لازم: ${a}–${b} میلی‌متر)`,
    eyeLine: (v, a, b) => `خط چشم از پایین: ${v} میلی‌متر (لازم: ${a}–${b} میلی‌متر)`,
    centringOk: "چهره در وسط است",
    centringOff: (v, side) =>
      `چهره ${v} میلی‌متر به ${side === "right" ? "راست" : "چپ"} منحرف است`,
    centringHint: "عکس را بکشید تا چهره در وسط قاب قرار گیرد، یا برش را بازنشانی کنید.",
    resolutionOk: (v) => `کیفیت چاپ: ${v} DPI`,
    resolutionWarn: (v, min) => `کیفیت چاپ: ${v} DPI — کمتر از ${min} DPI پیشنهادی؛ کیفیت چاپ پایین می‌آید`,
    resolutionErr: (v) => `کیفیت چاپ: ${v} DPI — برای چاپ خیلی کم است. از عکس با کیفیت بالاتر استفاده کنید.`,
    framingWarn: "برش به لبهٔ عکس رسیده است؛ کمی فضای بیشتر دور سر مطمئن‌تر است.",
    framingErr: "عکس فضای کافی دور سر ندارد — دوباره با فضای بیشتر بالای سر و اطراف بگیرید.",
    poseRollOk: "سر صاف است",
    poseRollBad: (deg) => `سر حدود ${deg}° کج است`,
    poseRollHint: "سر را صاف نگه دارید — خط بین دو چشم باید افقی باشد.",
    poseYawOk: "رو به کمره",
    poseYawBad: (deg) => `سر حدود ${deg}° به پهلو چرخیده است`,
    poseYawHint: "مستقیم به کمره نگاه کنید؛ هر دو گوش به یک اندازه دیده شوند.",
    eyesOk: "چشم‌ها باز است",
    eyesClosed: "چشم‌ها بسته یا نیمه‌بسته به نظر می‌رسد",
    eyesHint: "هر دو چشم باید باز و واضح باشند و به کمره نگاه کنند.",
    expressionOk: "حالت چهره خنثی است",
    mouthOpen: "دهان باز به نظر می‌رسد — حالت خنثی نگه دارید",
    expressionHint: "دهان را ببندید؛ بدون لبخند و بدون بالا بردن ابروها.",
    exposureOk: "نور مناسب است",
    exposureDark: "چهره خیلی تاریک است",
    exposureDarkHint: "نور بیشتری از روبه‌رو استفاده کنید یا روشنایی را در «تنظیم» بالا ببرید.",
    exposureBright: "چهره بیش از حد روشن است",
    exposureBrightHint: "از فلش مستقیم و پنجرهٔ روشن پشت کمره پرهیز کنید؛ روشنایی را در «تنظیم» پایین بیاورید.",
    lightingOk: "نورپردازی یکنواخت است",
    lightingUneven: "نورپردازی یکنواخت نیست — یک طرف چهره تاریک‌تر است",
    lightingHint: "چهره را از روبه‌رو یکنواخت نور دهید؛ از پنجره یا چراغ در یک طرف پرهیز کنید.",
    sharpOk: "عکس واضح است",
    sharpSoft: "عکس نرم یا تار به نظر می‌رسد",
    sharpHint: "روی چشم‌ها فوکوس کنید، کمره را ثابت نگه دارید و عکس اصلی با اندازهٔ کامل را به جای اسکرین‌شات استفاده کنید.",
    bgReplacedAny: "پس‌زمینه با یک رنگ ساده جایگزین می‌شود",
    bgReplaced: (colour) => `پس‌زمینه با ${colour} ساده جایگزین می‌شود`,
    bgFillMismatch: (colour) => `پس‌زمینه باید ${colour} باشد — رنگ دیگری انتخاب شده است`,
    bgFillMismatchHint: "پیش از دانلود، رنگ لازم را در بخش «پس‌زمینه» انتخاب کنید.",
    bgBusy: "پس‌زمینه ساده نیست",
    bgBusyHint: "جلوی یک دیوار ساده با نور یکنواخت بایستید — یا از «حذف پس‌زمینه» در پایین استفاده کنید.",
    bgWrongColour: (colour) => `پس‌زمینه باید ${colour} باشد — پس‌زمینهٔ شما متفاوت به نظر می‌رسد`,
    bgWrongColourHint: "از «حذف پس‌زمینه» در پایین استفاده کنید تا با رنگ لازم جایگزین شود.",
    bgPlainAny: "پس‌زمینه ساده است",
    bgPlain: (colour) => `پس‌زمینه ${colour} ساده است`,
  },

  bgNames: {
    white: "سفید",
    light_grey: "خاکستری روشن",
    off_white: "سفید کریمی",
    blue: "آبی",
    red: "سرخ",
    any: "یک رنگ ساده",
  },

  retouch: {
    eyebrow: "روتوش",
    lockedNote:
      "روتوش برای این سند غیرفعال است: مرجع صادرکننده عکس‌های تغییر یافتهٔ دیجیتال را رد می‌کند. برای عکس CV و قالب‌های غیررسمی در دسترس است.",
    intro: "ابزارهای دستی — هر تغییر را خودتان انجام می‌دهید، هیچ چیز خودکار تغییر نمی‌کند.",
    heal: "حذف لکه",
    smooth: "نرم کردن پوست",
    attire: "لباس",
    off: "خاموش",
    healHint: "روی لکه بزنید تا با پوست اطراف یکدست شود.",
    smoothHint: "روی پوست بکشید تا نرم شود. کم و طبیعی نگه دارید.",
    attireHint: "برای جابه‌جایی بکشید. بهترین نتیجه با PNG شفاف است.",
    brushSize: "اندازهٔ قلم",
    strength: "شدت",
    uploadAttire: "بارگذاری لباس (نکتایی، یقه…)",
    attireWidth: "اندازه",
    attireRotation: "چرخش",
    removeAttire: "حذف لباس",
    undo: "واگرد",
    clearAll: "حذف همهٔ روتوش",
    editsApplied: (n) => (n === 1 ? "1 تغییر" : `${n} تغییر`),
  },
  adjust: {
    eyebrow: "تنظیم دقیق",
    brightness: "روشنایی",
    contrast: "کنتراست",
    saturation: "اشباع رنگ",
    subtle: "تغییرات را کم نگه دارید. بسیاری از مراجع عکس‌های روتوش‌شده یا فیلترشده را رد می‌کنند.",
    zoomIn: "بزرگ‌نمایی",
    zoomOut: "کوچک‌نمایی",
  },

  bg: {
    eyebrow: "پس‌زمینه",
    desc: "پس‌زمینه را با رنگی که این سند لازم دارد جایگزین کنید — پردازش کاملاً روی دستگاه شما.",
    remove: "حذف پس‌زمینه",
    detecting: "در حال تشخیص خطوط…",
    modelNote:
      "بار اول یک مدل 25 مگابایتی بارگیری می‌شود و بعداً در حافظه می‌ماند. اندازه‌گیری سر نیز دقیق‌تر می‌شود، چون از خط دقیق موها استفاده می‌کند.",
    requiredChip: (name) => `لازم · ${name}`,
    presetWhite: "سفید",
    presetLightGrey: "خاکستری روشن",
    presetOffWhite: "سفید کریمی",
    custom: "دلخواه",
    softness: "نرمی لبه",
    showOriginal: "نمایش اصلی",
    showingOriginal: "در حال نمایش اصلی",
    keepOriginal: "نگه‌داشتن اصلی",
    crownNote: "ارتفاع سر اکنون از خط دقیق موها اندازه‌گیری می‌شود (برای موی بلند دقیق‌تر).",
  },

  exportP: {
    eyebrow: "دانلود",
    printFile: "فایل چاپ",
    printsAt: "چاپ دقیق در",
    fileType: "نوع فایل",
    jpegRec: "JPEG · پیشنهادی",
    png: "PNG",
    downloadPhoto: (fmt) => `دانلود عکس (${fmt})`,
    preparing: "در حال آماده‌سازی…",
    onlineFile: (w, h, size) => `فایل درخواست آنلاین · ${w} × ${h} پیکسل، حداکثر ${size}`,
    blocked: "ابتدا بررسی‌های بالا را برطرف کنید — این برش رد خواهد شد.",
  },

  sheet: {
    eyebrow: "برگهٔ چاپ",
    paperSize: "اندازهٔ کاغذ",
    perSheet: (n) => `${n} عکس`,
    perSheetTail: "در هر برگه · فاصلهٔ 2 میلی‌متر · با خطوط برش",
    pdfRec: "PDF · پیشنهادی",
    jpeg: "JPEG",
    downloadSheet: (fmt) => `دانلود برگه (${fmt})`,
    preparingSheet: "در حال آماده‌سازی برگه…",
    help: (paper) =>
      `یک چاپ عکس معمولی ${paper} در هر عکاسی سفارش دهید و در امتداد خطوط ببرید. در صورت امکان PDF را انتخاب کنید — با اندازهٔ واقعی مطمئن‌تر چاپ می‌شود.`,
    noFit: (paper) => `این قالب عکس روی ${paper} جا نمی‌شود — کاغذ بزرگ‌تری انتخاب کنید.`,
  },

  family: {
    eyebrow: "برگهٔ خانوادگی",
    intro:
      "برای چند نفر عکس تهیه می‌کنید؟ این عکس را اضافه کنید و سپس عکس نفر بعدی را بارگذاری کنید — همه در یک چاپ شریک می‌شوند و بعد از چاپ جدا می‌شود.",
    addFirst: "افزودن این عکس به برگهٔ خانوادگی",
    addToo: "این عکس را هم اضافه کن",
    adding: "در حال افزودن…",
    addAnother: "افزودن نفر بعدی (بارگذاری عکس او)",
    people: (n) => (n === 1 ? "1 نفر" : `${n} نفر`),
    photosOn: (copies, paper, counts) => `${copies} عکس روی ${paper} (هر نفر ${counts})`,
    noFit: (n, paper) => `${n} نفر روی ${paper} جا نمی‌شوند — در بخش برگهٔ چاپ کاغذ بزرگ‌تری انتخاب کنید.`,
    downloadFamily: (fmt) => `دانلود برگهٔ خانوادگی (${fmt})`,
    clear: "پاک کردن برگهٔ خانوادگی",
    removePerson: (label) => `حذف ${label}`,
    person: (n) => `نفر ${n}`,
    mismatch: (label) =>
      `این برگهٔ خانوادگی ${label} است — برای افزودن افراد بیشتر به همان قالب برگردید، یا برگه را پاک کنید.`,
  },

  result: {
    photoReady: "عکس شما آماده است.",
    sheetReady: "برگهٔ چاپ شما آماده است.",
    familyReady: "برگهٔ خانوادگی شما آماده است.",
    save: "ذخیره",
    keepEditing: "ادامهٔ ویرایش",
    perPerson: (counts) => `(هر نفر ${counts})`,
    adviceSheet:
      "این را مانند یک چاپ عکس معمولی سفارش دهید و در امتداد خطوط ببرید. هنگام چاپ «اندازهٔ واقعی» را انتخاب کنید — هرگز «متناسب با صفحه» نه.",
    advicePhoto:
      "فایل اندازهٔ فیزیکی خود را دارد — هنگام چاپ «اندازهٔ واقعی» / «بدون مقیاس» را انتخاب کنید. برای ارزان‌ترین چاپ از برگهٔ چاپ پایین استفاده کنید.",
  },

  camera: {
    hints: {
      "no-face": "چهرهٔ خود را داخل بیضی قرار دهید",
      closer: "نزدیک‌تر شوید",
      back: "کمی عقب بروید",
      centre: "چهره را در وسط قاب قرار دهید",
      "space-above": "فضای بیشتری بالای سر بگذارید",
      "move-up": "بالاتر — چانه خیلی به لبهٔ پایین نزدیک است",
      straighten: "سر را صاف نگه دارید",
      "face-camera": "مستقیم به کمره نگاه کنید",
      "open-eyes": "چشم‌ها را باز کنید",
      "close-mouth": "دهان را ببندید — حالت خنثی",
      good: "خوب است — ثابت بمانید",
    },
    searching: "در حال یافتن چهرهٔ شما…",
    starting: "کمره روشن می‌شود…",
    takingPhoto: "در حال گرفتن عکس…",
    takeIn: (n) => `گرفتن عکس تا ${n}…`,
    takeBtn: (n) => `گرفتن عکس (تایمر ${n} ثانیه)`,
    switchCam: "تغییر کمره",
    cancel: "لغو",
    liveLocal: "ویدیوی زنده روی دستگاه شما می‌ماند",
    tips: "دیوار ساده با نور یکنواخت پشت سر · نور روی چهره، نه از پشت · کمره در ارتفاع چشم · در صورت امکان عینک را بردارید.",
    cameraFailed: "کمره روشن نشد.",
    captureFailed: "عکس گرفته نشد.",
  },

  errors: {
    "file-too-large": "فایل خیلی بزرگ است (حداکثر 40 مگابایت).",
    "too-many-pixels": "عکس پیکسل‌های خیلی زیادی دارد (حداکثر 50 مگاپیکسل).",
    "unsupported-type": "این نوع فایل پشتیبانی نمی‌شود. از JPEG، PNG، WebP یا HEIC استفاده کنید.",
    "decode-failed": "عکس باز نشد. شاید خراب یا در قالب پشتیبانی‌نشده باشد.",
    "detect-failed": "تشخیص چهره ناموفق بود. دوباره تلاش کنید.",
    "no-face": "چهره‌ای در عکس پیدا نشد. از یک پورتریت واضح و روبه‌رو با تمام سر استفاده کنید.",
    "segment-failed": "حذف پس‌زمینه ناموفق بود. دوباره تلاش کنید.",
    "encode-failed": "عکس صادر نشد. دوباره تلاش کنید.",
    "sheet-failed": "برگهٔ چاپ ساخته نشد. دوباره تلاش کنید.",
    "batch-sheet-failed": "برگهٔ خانوادگی ساخته نشد. دوباره تلاش کنید.",
  },
};

/* ------------------------------------------------------------------ */
/* Pashto — machine-drafted, awaiting native review                    */
/* ------------------------------------------------------------------ */

const ps: Dict = {
  tagline:
    "د پاسپورټ او هویت کارت عکسونه، د چاپ لپاره سمه اندازه. هر څه ستاسو په براوزر کې چلېږي — ستاسو عکس هېڅکله له وسیلې نه بهر نه ځي.",
  onDevicePill: "100٪ ستاسو په وسیله کې",
  noUploadsFooter: "هېڅ اپلوډ نشته. ستاسو د عکسونو هېڅ تعقیب نشته.",
  footerDisclaimer:
    "له هېڅ دولتي ادارې سره تړاو نه لري. د عکس شرطونه تل له صادروونکې ادارې څخه تایید کړئ.",
  footerGerman:
    "د آلمان یادونه: له 2025 راهیسې د آلمان د هویت کارت او پاسپورټ عکسونه باید په ډیجیټل بڼه د تایید شوي وړاندې کوونکي له خوا واستول شي او په دې اپ نه جوړېږي. د موټر چلونې جواز عکسونه لا هم په کاغذ منل کېږي.",
  steps: { format: "بڼه", photo: "عکس", adjust: "سمون", download: "ډاونلوډ" },
  hintIntro: "د ځای بدلولو لپاره یې راکش کړئ · د لویولو لپاره سکرول یا دوه ګوتې ·",
  hintPan: "خوځول،",
  hintZoom: "لویول",
  useAnother: "بل عکس وکاروئ",
  languageAria: "ژبه",
  theme: { light: "روښانه", dark: "تیاره", system: "سیسټم" },

  uploader: {
    title: "خپل عکس اضافه کړئ",
    reading: "عکس لوستل کېږي…",
    drop: "دلته یې خوشې کړئ",
    formats:
      "JPEG، PNG، WebP یا HEIC. کمرې ته مخامخ، ساده شالید، ټول سر له یو څه فضا سره په بره کې ښکاره وي.",
    choose: "عکس وټاکئ",
    take: "عکس واخلئ",
    sample: "عکس نه لرئ؟ نمونه عکس وازمویئ",
    privacy: "ستاسو عکس ستاسو په وسیله کې پروسس کېږي او هېڅکله نه اپلوډ کېږي.",
  },

  picker: {
    search: "لټون: 3×4، پاسپورټ، امریکا، 35×45…",
    noMatch: (q) => `هېڅ بڼه له «${q}» سره سمون نه لري. لکه 35x45 اندازه یا د هېواد نوم وازمویئ.`,
    categories: {
      generic: "عامې اندازې",
      passport: "پاسپورټونه",
      visa: "ویزې",
      license: "د موټر چلونې جوازونه",
      other: "نور",
    },
    headRange: (a, b) => `سر ${a}–${b}`,
  },

  checks: {
    eyebrow: "کتنې",
    headline: { ok: "د ډاونلوډ لپاره چمتو", warn: "کارېدونکی، له خبرتیاوو سره", error: "له مقرراتو سره سم نه دی" },
    framing: "چوکاټ",
    quality: "د عکس کیفیت",
    scanning: "رڼا، وضاحت او شالید کتل کېږي…",
    beforeSubmit: "له سپارلو مخکې",
    allConfirmed: "ټول تایید شول",
    toConfirm: (n) => `${n} د تایید لپاره`,
    manualIntro: "دا په اتوماتیک ډول نه کتل کېږي — پخپله یې تایید کړئ.",
    manual: {
      recent: "په تېرو 6 میاشتو کې اخیستل شوی وي",
      glasses: "په عینکو کې د رڼا انعکاس نه وي؛ سترګې بشپړې ښکاره وي (ځینې هېوادونه: بې عینکو)",
      headwear: "خولۍ یا د سر پوښ نه وي، پرته له هغه چې د دیني دلایلو له امله هره ورځ اغوستل کېږي",
      hair: "وېښتان سترګې یا وروځې نه پټوي",
      clothing: "عادي جامې — یونیفورم نه، او داسې رنګ چې له شالید سره توپیر ولري",
    },
    reset: "اتوماتیک برش ته بېرته",
    specNote: (date, seeded) =>
      `مشخصات وروستی ځل په ${date} وکتل شول${seeded ? " (لا بیا نه دي تایید شوي)" : ""}. د کیفیت کتنې اتوماتیک اټکلونه دي — شرطونه تل له صادروونکې ادارې څخه تایید کړئ.`,
  },

  check: {
    headHeightOk: (v, a, b) => `د سر لوړوالی: ${v} ملي متره (اړین: ${a}–${b} ملي متره)`,
    headHeightOut: (v, a, b) => `د سر لوړوالی: ${v} ملي متره — له اړینې ${a}–${b} ملي متره بهر`,
    headHeightFree: (v) => `د سر لوړوالی: ${v} ملي متره (د دې بڼې لپاره رسمي شرط نشته)`,
    topMargin: (v, a, b) => `د سر پورته فضا: ${v} ملي متره (اړین: ${a}–${b} ملي متره)`,
    eyeLine: (v, a, b) => `د سترګو کرښه له لاندې: ${v} ملي متره (اړین: ${a}–${b} ملي متره)`,
    centringOk: "مخ په منځ کې دی",
    centringOff: (v, side) => `مخ ${v} ملي متره ${side === "right" ? "ښي" : "کیڼ"} لوري ته وتلی دی`,
    centringHint: "عکس راکش کړئ تر څو مخ د چوکاټ منځ ته راشي، یا برش بیا تنظیم کړئ.",
    resolutionOk: (v) => `د چاپ کیفیت: ${v} DPI`,
    resolutionWarn: (v, min) => `د چاپ کیفیت: ${v} DPI — له وړاندیز شوي ${min} DPI نه کم؛ د چاپ کیفیت به خراب شي`,
    resolutionErr: (v) => `د چاپ کیفیت: ${v} DPI — د چاپ لپاره ډېر کم دی. لوړ کیفیت عکس وکاروئ.`,
    framingWarn: "برش د عکس څنډې ته رسېدلی؛ د سر شاوخوا یو څه زیاته فضا به خوندي وي.",
    framingErr: "عکس د سر شاوخوا کافي فضا نه لري — بیا یې واخلئ، د سر له پاسه او خواوو ته له زیاتې فضا سره.",
    poseRollOk: "سر سم دی",
    poseRollBad: (deg) => `سر شاوخوا ${deg}° کوږ دی`,
    poseRollHint: "سر سم ونیسئ — د دواړو سترګو کرښه باید افقي وي.",
    poseYawOk: "کمرې ته مخامخ",
    poseYawBad: (deg) => `سر شاوخوا ${deg}° یوې خوا ته ګرځېدلی`,
    poseYawHint: "مستقیم کمرې ته وګورئ؛ دواړه غوږونه یو شان ښکاره وي.",
    eyesOk: "سترګې خلاصې دي",
    eyesClosed: "سترګې پټې یا نیمه پټې ښکاري",
    eyesHint: "دواړه سترګې باید خلاصې او ښکاره وي، کمرې ته ګوري.",
    expressionOk: "عادي څېره",
    mouthOpen: "خوله خلاصه ښکاري — عادي څېره وساتئ",
    expressionHint: "خوله بنده کړئ؛ بې موسکا، وروځې مه پورته کوئ.",
    exposureOk: "رڼا ښه ده",
    exposureDark: "مخ ډېر تیاره دی",
    exposureDarkHint: "له مخامخ لوري زیاته رڼا وکاروئ، یا په «سمون» کې روښانتیا پورته کړئ.",
    exposureBright: "مخ ډېر روښانه دی",
    exposureBrightHint: "له مستقیم فلش او د کمرې شاته روښانه کړکۍ ډډه وکړئ؛ په «سمون» کې روښانتیا راکمه کړئ.",
    lightingOk: "رڼا یو شان ده",
    lightingUneven: "رڼا یو شان نه ده — د مخ یوه خوا تیاره ده",
    lightingHint: "مخ له مخامخ لوري یو شان روښانه کړئ؛ یوې خوا ته له کړکۍ یا څراغ ډډه وکړئ.",
    sharpOk: "عکس واضح دی",
    sharpSoft: "عکس نرم یا تار ښکاري",
    sharpHint: "په سترګو فوکس وکړئ، کمره ثابته ونیسئ، او د سکرین شاټ پر ځای اصلي بشپړ عکس وکاروئ.",
    bgReplacedAny: "شالید به په یوه ساده رنګ بدل شي",
    bgReplaced: (colour) => `شالید به په ساده ${colour} بدل شي`,
    bgFillMismatch: (colour) => `شالید باید ${colour} وي — بل رنګ ټاکل شوی`,
    bgFillMismatchHint: "له ډاونلوډ مخکې په «شالید» کې اړین رنګ وټاکئ.",
    bgBusy: "شالید ساده نه دی",
    bgBusyHint: "د یوه ساده، یو شان روښانه دیوال مخې ته ودرېږئ — یا لاندې «د شالید لرې کول» وکاروئ.",
    bgWrongColour: (colour) => `شالید باید ${colour} وي — ستاسو یې توپیر لري`,
    bgWrongColourHint: "لاندې «د شالید لرې کول» وکاروئ تر څو په اړین رنګ بدل شي.",
    bgPlainAny: "شالید ساده دی",
    bgPlain: (colour) => `شالید ساده ${colour} دی`,
  },

  bgNames: {
    white: "سپین",
    light_grey: "روښانه خړ",
    off_white: "کریمي سپین",
    blue: "شین",
    red: "سور",
    any: "یو ساده رنګ",
  },

  retouch: {
    eyebrow: "روتوش",
    lockedNote:
      "د دې سند لپاره روتوش بند دی: صادروونکې اداره ډیجیټل بدل شوي عکسونه ردوي. د CV عکس او غیر رسمي بڼو لپاره شته.",
    intro: "لاسي وسایل — هر بدلون پخپله کوئ، هېڅ شی اتوماتیک نه بدلېږي.",
    heal: "د داغ لرې کول",
    smooth: "د پوستکي نرمول",
    attire: "جامې",
    off: "بند",
    healHint: "پر داغ ټک ووهئ تر څو له شاوخوا پوستکي سره یو شان شي.",
    smoothHint: "د پوستکي له پاسه یې وکاږئ تر څو نرم شي. لږ او طبیعي یې وساتئ.",
    attireHint: "د ځای بدلولو لپاره یې راکش کړئ. غوره پایله د شفاف PNG سره ده.",
    brushSize: "د برس اندازه",
    strength: "شدت",
    uploadAttire: "جامې پورته کړئ (نکټایي، غاړه…)",
    attireWidth: "اندازه",
    attireRotation: "تاوول",
    removeAttire: "جامې لرې کړئ",
    undo: "بېرته",
    clearAll: "ټول روتوش لرې کړئ",
    editsApplied: (n) => (n === 1 ? "1 بدلون" : `${n} بدلونونه`),
  },
  adjust: {
    eyebrow: "دقیق سمون",
    brightness: "روښانتیا",
    contrast: "کنتراست",
    saturation: "د رنګ ډکوالی",
    subtle: "بدلونونه لږ وساتئ. ډېرې ادارې روتوش شوي یا فلټر شوي عکسونه ردوي.",
    zoomIn: "لویول",
    zoomOut: "کمول",
  },

  bg: {
    eyebrow: "شالید",
    desc: "شالید په هغه رنګ بدل کړئ چې دا سند یې غواړي — پروسس بشپړ ستاسو په وسیله کې.",
    remove: "د شالید لرې کول",
    detecting: "خطونه پېژندل کېږي…",
    modelNote:
      "لومړی ځل یو 25 MB ماډل ډاونلوډېږي، بیا په کیش کې پاتېږي. د سر اندازه هم دقیقه کېږي، ځکه چې د وېښتانو دقیق خط کارول کېږي.",
    requiredChip: (name) => `اړین · ${name}`,
    presetWhite: "سپین",
    presetLightGrey: "روښانه خړ",
    presetOffWhite: "کریمي سپین",
    custom: "دلخواه",
    softness: "د څنډې نرموالی",
    showOriginal: "اصلي وښایاست",
    showingOriginal: "اصلي ښودل کېږي",
    keepOriginal: "اصلي وساتئ",
    crownNote: "د سر لوړوالی اوس د وېښتانو له دقیق خط څخه اندازه کېږي (د لوړو وېښتانو لپاره دقیق).",
  },

  exportP: {
    eyebrow: "ډاونلوډ",
    printFile: "د چاپ فایل",
    printsAt: "دقیق چاپ په",
    fileType: "د فایل ډول",
    jpegRec: "JPEG · وړاندیز شوی",
    png: "PNG",
    downloadPhoto: (fmt) => `عکس ډاونلوډ کړئ (${fmt})`,
    preparing: "چمتو کېږي…",
    onlineFile: (w, h, size) => `د آنلاین غوښتنلیک فایل · ${w} × ${h} پیکسله، تر ${size} پورې`,
    blocked: "لومړی پورته کتنې سمې کړئ — دا برش به رد شي.",
  },

  sheet: {
    eyebrow: "د چاپ پاڼه",
    paperSize: "د کاغذ اندازه",
    perSheet: (n) => `${n} عکسونه`,
    perSheetTail: "په هره پاڼه کې · 2 ملي متره واټن · د برش کرښې",
    pdfRec: "PDF · وړاندیز شوی",
    jpeg: "JPEG",
    downloadSheet: (fmt) => `پاڼه ډاونلوډ کړئ (${fmt})`,
    preparingSheet: "پاڼه چمتو کېږي…",
    help: (paper) =>
      `یو عادي ${paper} عکس چاپ په هره عکاسۍ کې سفارش کړئ او د کرښو په اوږدو کې یې پرې کړئ. که امکان وي PDF غوره کړئ — په اصلي اندازه ډاډمن چاپېږي.`,
    noFit: (paper) => `دا د عکس بڼه په ${paper} کې نه ځایېږي — لویه کاغذ وټاکئ.`,
  },

  family: {
    eyebrow: "کورنۍ پاڼه",
    intro:
      "د څو کسانو لپاره عکسونه جوړوئ؟ دا عکس اضافه کړئ او بیا د بل کس عکس پورته کړئ — ټول په یوه چاپ کې شریکېږي، له چاپ وروسته یې جلا کړئ.",
    addFirst: "دا عکس کورنۍ پاڼې ته اضافه کړئ",
    addToo: "دا عکس هم اضافه کړئ",
    adding: "اضافه کېږي…",
    addAnother: "بل کس اضافه کړئ (د هغه عکس پورته کړئ)",
    people: (n) => (n === 1 ? "1 کس" : `${n} کسان`),
    photosOn: (copies, paper, counts) => `${copies} عکسونه په ${paper} (هر کس ${counts})`,
    noFit: (n, paper) => `${n} کسان په ${paper} کې نه ځایېږي — د چاپ پاڼې برخه کې لویه کاغذ وټاکئ.`,
    downloadFamily: (fmt) => `کورنۍ پاڼه ډاونلوډ کړئ (${fmt})`,
    clear: "کورنۍ پاڼه پاکه کړئ",
    removePerson: (label) => `${label} لرې کړئ`,
    person: (n) => `کس ${n}`,
    mismatch: (label) =>
      `دا کورنۍ پاڼه ${label} ده — د نورو کسانو د اضافه کولو لپاره هماغې بڼې ته ورشئ، یا پاڼه پاکه کړئ.`,
  },

  result: {
    photoReady: "ستاسو عکس چمتو دی.",
    sheetReady: "ستاسو د چاپ پاڼه چمتو ده.",
    familyReady: "ستاسو کورنۍ پاڼه چمتو ده.",
    save: "خوندي کړئ",
    keepEditing: "سمون ته دوام",
    perPerson: (counts) => `(هر کس ${counts})`,
    adviceSheet:
      "دا د عادي عکس چاپ په توګه سفارش کړئ او د کرښو په اوږدو کې یې پرې کړئ. د چاپ پر مهال «اصلي اندازه» غوره کړئ — هېڅکله «له پاڼې سره برابر» نه.",
    advicePhoto:
      "فایل خپله فزیکي اندازه لري — د چاپ پر مهال «اصلي اندازه» / «بې مقیاسه» غوره کړئ. تر ټولو ارزانه چاپ لپاره لاندې د چاپ پاڼه وکاروئ.",
  },

  camera: {
    hints: {
      "no-face": "خپل مخ د بیضوي دننه ونیسئ",
      closer: "نږدې شئ",
      back: "لږ شاته شئ",
      centre: "مخ د چوکاټ منځ ته راولئ",
      "space-above": "د سر له پاسه زیاته فضا پرېږدئ",
      "move-up": "پورته شئ — زنه لاندې څنډې ته ډېره نږدې ده",
      straighten: "سر سم ونیسئ",
      "face-camera": "مستقیم کمرې ته وګورئ",
      "open-eyes": "سترګې خلاصې کړئ",
      "close-mouth": "خوله بنده کړئ — عادي څېره",
      good: "ښه ښکاري — ثابت پاتې شئ",
    },
    searching: "ستاسو مخ لټول کېږي…",
    starting: "کمره پیلېږي…",
    takingPhoto: "عکس اخیستل کېږي…",
    takeIn: (n) => `عکس اخیستل په ${n}…`,
    takeBtn: (n) => `عکس واخلئ (${n} ثانیې ټایمر)`,
    switchCam: "کمره بدله کړئ",
    cancel: "لغوه",
    liveLocal: "ژوندۍ ویډیو ستاسو په وسیله کې پاتېږي",
    tips: "شاته ساده، یو شان روښانه دیوال · رڼا پر مخ، نه له شا · کمره د سترګو په لوړوالي · که کېدای شي عینکې لرې کړئ.",
    cameraFailed: "کمره پیل نه شوه.",
    captureFailed: "عکس وانه خیستل شو.",
  },

  errors: {
    "file-too-large": "فایل ډېر لوی دی (تر 40 MB پورې).",
    "too-many-pixels": "عکس ډېر پیکسلونه لري (تر 50 MP پورې).",
    "unsupported-type": "دا د فایل ډول نه ملاتړ کېږي. JPEG، PNG، WebP یا HEIC وکاروئ.",
    "decode-failed": "عکس خلاص نه شو. ښایي خراب وي یا په نه ملاتړ شوې بڼه کې وي.",
    "detect-failed": "د مخ پېژندنه ناکامه شوه. بیا هڅه وکړئ.",
    "no-face": "په عکس کې مخ ونه موندل شو. یو واضح، مخامخ پورټریټ وکاروئ چې ټول سر پکې ښکاره وي.",
    "segment-failed": "د شالید لرې کول ناکام شول. بیا هڅه وکړئ.",
    "encode-failed": "عکس صادر نه شو. بیا هڅه وکړئ.",
    "sheet-failed": "د چاپ پاڼه جوړه نه شوه. بیا هڅه وکړئ.",
    "batch-sheet-failed": "کورنۍ پاڼه جوړه نه شوه. بیا هڅه وکړئ.",
  },
};

/* ------------------------------------------------------------------ */
/* Locale state + helpers                                              */
/* ------------------------------------------------------------------ */

const DICTS: Record<Locale, Dict> = { en, de, fa, ps };

const KEY = "locale";

function applyToDocument(locale: Locale): void {
  const meta = LOCALE_META[locale];
  document.documentElement.lang = meta.lang;
  document.documentElement.dir = meta.dir;
}

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  // The server renders English; initLocale() applies the stored choice after
  // hydration (same pattern as the theme, minus the pre-paint script — a text
  // flash matters less than a colour flash).
  locale: "en",
  setLocale: (locale) => {
    localStorage.setItem(KEY, locale);
    applyToDocument(locale);
    set({ locale });
  },
}));

/** Restore the stored/deep-linked locale. Call once after mount. */
export function initLocale(): void {
  const fromUrl = new URLSearchParams(window.location.search).get("lang");
  const stored = localStorage.getItem(KEY);
  const locale = isLocale(fromUrl) ? fromUrl : isLocale(stored) ? stored : "en";
  if (isLocale(fromUrl)) localStorage.setItem(KEY, fromUrl);
  applyToDocument(locale);
  useLocaleStore.setState({ locale });
}

/** Dictionary + metadata for the current locale. */
export function useT(): { t: Dict; locale: Locale; dir: "ltr" | "rtl" } {
  const locale = useLocaleStore((s) => s.locale);
  return { t: DICTS[locale], locale, dir: LOCALE_META[locale].dir };
}

const round1 = (n: number) => (Math.round(n * 10) / 10).toString();

/**
 * Localized message + hint for a core check, keyed by (id, level, variant)
 * with the item's measured values. Unknown ids fall back to core's English.
 */
export function localizeCheck(
  item: ValidationItem,
  t: Dict,
  format: PhotoFormat,
): { message: string; hint?: string } {
  const c = t.check;
  const colour = t.bgNames[format.background] ?? t.bgNames.any!;
  const v = item.value !== undefined ? round1(item.value) : "";
  const [a, b] = item.range ?? [0, 0];
  const ok = item.level === "ok";

  switch (item.id) {
    case "head-height":
      if (!item.range) return { message: c.headHeightFree(v) };
      return ok
        ? { message: c.headHeightOk(v, a, b) }
        : { message: c.headHeightOut(v, a, b) };
    case "top-margin":
      return { message: c.topMargin(v, a, b) };
    case "eye-line":
      return { message: c.eyeLine(v, a, b) };
    case "centring":
      return ok
        ? { message: c.centringOk }
        : {
            message: c.centringOff(v, item.variant === "right" ? "right" : "left"),
            hint: c.centringHint,
          };
    case "resolution": {
      const dpi = Math.round(item.value ?? 0);
      if (ok) return { message: c.resolutionOk(dpi) };
      return item.level === "warn"
        ? { message: c.resolutionWarn(dpi, a) }
        : { message: c.resolutionErr(dpi) };
    }
    case "framing-room":
      return { message: item.level === "error" ? c.framingErr : c.framingWarn };
    case "pose-roll":
      return ok
        ? { message: c.poseRollOk }
        : { message: c.poseRollBad(Math.round(item.value ?? 0)), hint: c.poseRollHint };
    case "pose-yaw":
      return ok
        ? { message: c.poseYawOk }
        : { message: c.poseYawBad(Math.round(item.value ?? 0)), hint: c.poseYawHint };
    case "eyes-open":
      return ok ? { message: c.eyesOk } : { message: c.eyesClosed, hint: c.eyesHint };
    case "expression":
      return ok
        ? { message: c.expressionOk }
        : { message: c.mouthOpen, hint: c.expressionHint };
    case "exposure":
      if (ok) return { message: c.exposureOk };
      return item.variant === "bright"
        ? { message: c.exposureBright, hint: c.exposureBrightHint }
        : { message: c.exposureDark, hint: c.exposureDarkHint };
    case "lighting":
      return ok
        ? { message: c.lightingOk }
        : { message: c.lightingUneven, hint: c.lightingHint };
    case "sharpness":
      return ok ? { message: c.sharpOk } : { message: c.sharpSoft, hint: c.sharpHint };
    case "background":
      switch (item.variant) {
        case "replaced":
          return {
            message:
              format.background === "any" ? c.bgReplacedAny : c.bgReplaced(colour),
          };
        case "fill-mismatch":
          return { message: c.bgFillMismatch(colour), hint: c.bgFillMismatchHint };
        case "busy":
          return { message: c.bgBusy, hint: c.bgBusyHint };
        case "wrong-colour":
          return { message: c.bgWrongColour(colour), hint: c.bgWrongColourHint };
        case "plain":
          return {
            message: format.background === "any" ? c.bgPlainAny : c.bgPlain(colour),
          };
        default:
          return { message: item.message, hint: item.hint };
      }
    default:
      // Core added a check this dictionary does not know — English fallback.
      return { message: item.message, hint: item.hint };
  }
}

/** Localized user-facing error, falling back to the raw (English) message. */
export function localizeError(
  code: string | null | undefined,
  fallback: string,
  t: Dict,
): string {
  return (code && t.errors[code]) || fallback;
}
