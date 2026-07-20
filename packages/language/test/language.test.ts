import { defaultUiTranslations, resolveConfig } from "foldocs-core";
import { describe, expect, it } from "vitest";

import {
  simplifiedChinese,
  spanish,
  traditionalChinese,
} from "../src/index.js";

describe("language packs", () => {
  it("merge into a complete resolved locale definition", () => {
    const config = resolveConfig({
      site: { title: "Docs" },
      i18n: {
        defaultLocale: "es",
        locales: [spanish(), simplifiedChinese(), traditionalChinese()],
      },
    });
    expect(config.i18n.locales).toHaveLength(3);
    expect(config.i18n.locales[0]?.ui.search).toBe("Buscar");
    expect(config.i18n.locales[1]?.ui.copy).toBe("复制");
    expect(config.i18n.locales[2]?.ui.copy).toBe("複製");
    expect(config.i18n.locales[0]?.ui.loading).not.toBe(
      defaultUiTranslations.loading,
    );
  });
});
