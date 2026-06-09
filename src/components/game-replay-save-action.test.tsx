import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { GameReplaySaveAction } from "./game-replay-save-action";

describe("game replay save action", () => {
  it("renders the ready save action with the existing button contract", () => {
    const markup = renderToStaticMarkup(
      <GameReplaySaveAction
        onSave={vi.fn()}
        replayReady
        status="idle"
        testIdPrefix="snake"
      />,
    );

    expect(markup).toContain('data-testid="snake-save-replay-button"');
    expect(markup).toContain('type="button"');
    expect(markup).toContain("w-full");
    expect(markup).toContain('data-icon="inline-start"');
    expect(markup).toContain("Save replay");
    expect(markup).not.toContain('disabled=""');
    expect(markup).not.toContain('data-testid="snake-save-replay-error"');
  });

  it("disables unavailable, saving, and saved replay states with matching labels", () => {
    const unavailableMarkup = renderToStaticMarkup(
      <GameReplaySaveAction
        onSave={vi.fn()}
        replayReady={false}
        status="idle"
        testIdPrefix="snake"
      />,
    );
    const savingMarkup = renderToStaticMarkup(
      <GameReplaySaveAction
        onSave={vi.fn()}
        replayReady
        status="saving"
        testIdPrefix="snake"
      />,
    );
    const savedMarkup = renderToStaticMarkup(
      <GameReplaySaveAction
        onSave={vi.fn()}
        replayReady
        status="saved"
        testIdPrefix="snake"
      />,
    );

    expect(unavailableMarkup).toContain('disabled=""');
    expect(unavailableMarkup).toContain("Save replay");
    expect(savingMarkup).toContain('disabled=""');
    expect(savingMarkup).toContain("Saving replay");
    expect(savedMarkup).toContain('disabled=""');
    expect(savedMarkup).toContain("Replay saved");
  });

  it("renders the existing save error text and allows game-specific error color", () => {
    const defaultMarkup = renderToStaticMarkup(
      <GameReplaySaveAction
        onSave={vi.fn()}
        replayReady
        status="failed"
        testIdPrefix="tetris"
      />,
    );
    const markup = renderToStaticMarkup(
      <GameReplaySaveAction
        errorClassName="text-[#59687d]"
        onSave={vi.fn()}
        replayReady
        status="failed"
        testIdPrefix="simon"
      />,
    );

    expect(defaultMarkup).toContain('data-testid="tetris-save-replay-error"');
    expect(defaultMarkup).toContain("text-[#cbd5e1]");
    expect(markup).toContain('data-testid="simon-save-replay-button"');
    expect(markup).toContain('data-testid="simon-save-replay-error"');
    expect(markup).toContain("Could not save replay. Sign in and try again.");
    expect(markup).toContain("text-[#59687d]");
  });
});
