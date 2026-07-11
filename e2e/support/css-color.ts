import type { Page } from "@playwright/test";

export type RgbColor = {
  alpha: number;
  blue: number;
  green: number;
  red: number;
};

export function compositeColors(foreground: RgbColor, background: RgbColor): RgbColor {
  const alpha = foreground.alpha + background.alpha * (1 - foreground.alpha);

  if (alpha === 0) {
    return { alpha: 0, blue: 0, green: 0, red: 0 };
  }

  const compositeChannel = (foregroundChannel: number, backgroundChannel: number) =>
    (foregroundChannel * foreground.alpha +
      backgroundChannel * background.alpha * (1 - foreground.alpha)) /
    alpha;

  return {
    alpha,
    blue: compositeChannel(foreground.blue, background.blue),
    green: compositeChannel(foreground.green, background.green),
    red: compositeChannel(foreground.red, background.red),
  };
}

export function compositeOverWhite(color: RgbColor) {
  return compositeColors(color, {
    alpha: 1,
    blue: 255,
    green: 255,
    red: 255,
  });
}

export function getRelativeLuminance(color: RgbColor) {
  const channels = [color.red, color.green, color.blue].map((channel) => {
    const normalized = channel / 255;

    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function getContrastRatio(foreground: RgbColor, background: RgbColor) {
  const foregroundLuminance = getRelativeLuminance(foreground);
  const backgroundLuminance = getRelativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

export async function getResolvedCssColorRgb(page: Page, value: string) {
  return page.evaluate((cssColor) => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (cssColor.length === 0) {
      throw new Error("Unable to resolve empty CSS color.");
    }

    if (!context) {
      throw new Error("Unable to resolve CSS color: canvas context unavailable.");
    }

    canvas.height = 1;
    canvas.width = 1;
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = cssColor;
    context.fillRect(0, 0, 1, 1);

    const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;

    return {
      alpha: alpha / 255,
      blue,
      green,
      red,
    };
  }, value);
}
