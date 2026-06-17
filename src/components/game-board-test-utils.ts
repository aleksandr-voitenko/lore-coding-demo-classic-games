import { expect } from "vitest";

export function expectMarkup(markup: string, fragments: string[]) {
  fragments.forEach((fragment) => {
    expect(markup).toContain(fragment);
  });
}

export function getMarkupAttribute(markup: string, testId: string, attribute: string) {
  const elementMatch = markup.match(new RegExp(`<[^>]+data-testid="${testId}"[^>]*>`));

  expect(elementMatch).not.toBeNull();

  const attributeMatch = elementMatch![0].match(new RegExp(`${attribute}="([^"]+)"`));

  expect(attributeMatch).not.toBeNull();

  return attributeMatch![1]!;
}
