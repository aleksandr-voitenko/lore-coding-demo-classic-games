import { test as base, expect } from "@playwright/test";

type BrowserIssue = {
  source: "console" | "pageerror";
  text: string;
};

export const test = base.extend<{ browserIssues: BrowserIssue[] }>({
  browserIssues: [
    async ({ page }, use) => {
      const browserIssues: BrowserIssue[] = [];

      page.on("console", (message) => {
        if (message.type() !== "error") {
          return;
        }

        browserIssues.push({
          source: "console",
          text: message.text(),
        });
      });

      page.on("pageerror", (error) => {
        browserIssues.push({
          source: "pageerror",
          text: error.message,
        });
      });

      await use(browserIssues);

      expect(browserIssues).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
