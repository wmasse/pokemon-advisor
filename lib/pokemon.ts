import {
    getMetaProfile,
  } from "@/lib/meta";
  
  export type PokemonSource =
    | "manual"
    | "pokegenie"
    | "niantic"
    | "import";
  
  export type PokemonRecord = {
    id: string;
    source: PokemonSource;
    importedAt: string;
  
    name: string;
    form: string;
    nickname: string;
  
    cp: number | null;
    hp: number | null;
    level: number | null;
  
    attackIV: number | null;
    defenseIV: number | null;
    staminaIV: number | null;
    ivPercent: number | null;
  
    fastMove: string;
    chargedMove: string;
    chargedMove2: string;
  
    shiny: boolean;
    shadow: boolean;
    purified: boolean;
    lucky: boolean;
    favorite: boolean;
  
    caughtAt: string;
    notes: string;
  
    priorityScore: number;
    metaScore: number;
    targetRole: string;
    recommendation: string;
    reasons: string[];
  
    raw: Record<string, unknown>;
  };
  
  export type PokemonInput = {
    name: string;
    form?: string;
    nickname?: string;
  
    cp?: number | null;
    hp?: number | null;
    level?: number | null;
  
    attackIV?: number | null;
    defenseIV?: number | null;
    staminaIV?: number | null;
  
    fastMove?: string;
    chargedMove?: string;
    chargedMove2?: string;
  
    shiny?: boolean;
    shadow?: boolean;
    purified?: boolean;
    lucky?: boolean;
    favorite?: boolean;
  
    caughtAt?: string;
    notes?: string;
  
    source?: PokemonSource;
  };
  
  const STORAGE_KEY =
    "pokemon-advisor-roster-v3";
  
  function makeId() {
    if (
      typeof crypto !== "undefined" &&
      "randomUUID" in crypto
    ) {
      return crypto.randomUUID();
    }
  
    return `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;
  }
  
  function normalizeKey(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[%()]/g, "")
      .replace(/[^a-z0-9]+/g, "");
  }
  
  function toNumber(
    value: unknown
  ): number | null {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return null;
    }
  
    const cleaned = String(value)
      .replace("%", "")
      .trim();
  
    if (!cleaned) {
      return null;
    }
  
    const result = Number(cleaned);
  
    return Number.isFinite(result)
      ? result
      : null;
  }
  
  function toBoolean(
    value: unknown
  ): boolean {
    if (
      value === true ||
      value === 1
    ) {
      return true;
    }
  
    if (
      value === false ||
      value === 0 ||
      value === null ||
      value === undefined
    ) {
      return false;
    }
  
    const normalized = String(value)
      .trim()
      .toLowerCase();
  
    return [
      "true",
      "yes",
      "y",
      "1",
      "x",
      "shiny",
      "shadow",
      "lucky",
      "favorite",
      "favourite",
    ].includes(normalized);
  }
  
  function calculateIVPercent(
    attackIV: number | null,
    defenseIV: number | null,
    staminaIV: number | null
  ) {
    if (
      attackIV === null ||
      defenseIV === null ||
      staminaIV === null
    ) {
      return null;
    }
  
    return (
      ((attackIV +
        defenseIV +
        staminaIV) /
        45) *
      100
    );
  }
  
  function analyzePokemon(input: {
    name: string;
    form: string;
    cp: number | null;
    level: number | null;
    attackIV: number | null;
    defenseIV: number | null;
    staminaIV: number | null;
    ivPercent: number | null;
    shiny: boolean;
    shadow: boolean;
    lucky: boolean;
  }) {
    const {
      name,
      form,
      cp,
      level,
      attackIV,
      defenseIV,
      staminaIV,
      ivPercent,
      shiny,
      shadow,
      lucky,
    } = input;
  
    let score = 0;
    let metaScore = 0;
    let targetRole = "General";
    let recommendation =
      "HOLD FOR META CHECK";
  
    const reasons: string[] = [];
  
    const meta = getMetaProfile(
      name,
      form,
      shadow
    );
  
    if (meta) {
      const leagueOptions = [
        {
          label: "Great League",
          score: meta.great ?? 0,
        },
        {
          label: "Ultra League",
          score: meta.ultra ?? 0,
        },
        {
          label: "Master League",
          score: meta.master ?? 0,
        },
        {
          label: "Raids",
          score: meta.raid ?? 0,
        },
      ].sort((a, b) => b.score - a.score);
  
      const best = leagueOptions[0];
  
      if (best.score > 0) {
        metaScore = best.score;
        targetRole = best.label;
        score += Math.round(best.score * 0.6);
        recommendation = `${best.label.toUpperCase()} PRIORITY`;
  
        reasons.push(
          `Meta priority: strong ${best.label} Pokémon`
        );
  
        if (best.label === "Great League") {
          reasons.push(
            "Usually wants a build at or under 1500 CP"
          );
        }
  
        if (best.label === "Ultra League") {
          reasons.push(
            "Usually wants a build at or under 2500 CP"
          );
        }
  
        if (best.label === "Master League") {
          reasons.push(
            "Master League usually prefers strong IVs and high level"
          );
        }
  
        if (best.label === "Raids") {
          reasons.push(
            "Useful mainly as a PvE / raid investment"
          );
        }
      }
  
      if (meta.notes?.length) {
        reasons.push(...meta.notes);
      }
    }
  
    if (ivPercent !== null) {
      if (ivPercent >= 99.99) {
        score += 18;
        reasons.push("Perfect 15/15/15 IVs");
      } else if (ivPercent >= 96) {
        score += 12;
        reasons.push("Excellent overall IVs");
      } else if (ivPercent >= 91) {
        score += 6;
        reasons.push("Strong overall IVs");
      }
    }
  
    const hasIVs =
      attackIV !== null &&
      defenseIV !== null &&
      staminaIV !== null;
  
    const pvpShape =
      hasIVs &&
      attackIV <= 3 &&
      defenseIV >= 12 &&
      staminaIV >= 12;
  
    const decentPvpShape =
      hasIVs &&
      attackIV <= 5 &&
      defenseIV >= 10 &&
      staminaIV >= 10;
  
    if (
      targetRole === "Great League" ||
      targetRole === "Ultra League"
    ) {
      if (pvpShape) {
        score += 14;
        reasons.push(
          "Excellent low-Attack PvP IV shape"
        );
      } else if (decentPvpShape) {
        score += 8;
        reasons.push(
          "Good PvP IV shape"
        );
      }
    }
  
    if (
      targetRole === "Master League" ||
      targetRole === "Raids"
    ) {
      if (ivPercent !== null && ivPercent >= 96) {
        score += 10;
      }
    }
  
    if (shadow) {
      score += 7;
      reasons.push(
        "Shadow bonus: often valuable, do not purify automatically"
      );
    }
  
    if (lucky) {
      score += 5;
      reasons.push(
        "Lucky Pokémon cost less Stardust to power up"
      );
    }
  
    if (shiny) {
      score += 10;
      reasons.push(
        "Shiny bonus: boosted because you want shinies prioritized"
      );
    }
  
    if (level !== null && level >= 35) {
      score += 4;
      reasons.push(
        "Already relatively high level"
      );
    }
  
    if (
      cp !== null &&
      targetRole === "Great League" &&
      cp > 1500
    ) {
      reasons.push(
        "Current CP may be too high for Great League"
      );
    }
  
    if (
      cp !== null &&
      targetRole === "Ultra League" &&
      cp > 2500
    ) {
      reasons.push(
        "Current CP may be too high for Ultra League"
      );
    }
  
    if (reasons.length === 0) {
      reasons.push(
        "No strong meta or IV signal detected yet"
      );
    }
  
    return {
      priorityScore: Math.max(
        0,
        Math.min(100, Math.round(score))
      ),
      metaScore,
      targetRole,
      recommendation,
      reasons,
    };
  }
  
  export function createPokemon(
    input: PokemonInput,
    existingId?: string
  ): PokemonRecord {
    const attackIV =
      input.attackIV ?? null;
    const defenseIV =
      input.defenseIV ?? null;
    const staminaIV =
      input.staminaIV ?? null;
  
    const ivPercent =
      calculateIVPercent(
        attackIV,
        defenseIV,
        staminaIV
      );
  
    const analysis = analyzePokemon({
      name: input.name,
      form: input.form ?? "",
      cp: input.cp ?? null,
      level: input.level ?? null,
      attackIV,
      defenseIV,
      staminaIV,
      ivPercent,
      shiny: input.shiny ?? false,
      shadow: input.shadow ?? false,
      lucky: input.lucky ?? false,
    });
  
    return {
      id: existingId ?? makeId(),
      source: input.source ?? "manual",
      importedAt: new Date().toISOString(),
  
      name: input.name.trim(),
      form: input.form?.trim() ?? "",
      nickname: input.nickname?.trim() ?? "",
  
      cp: input.cp ?? null,
      hp: input.hp ?? null,
      level: input.level ?? null,
  
      attackIV,
      defenseIV,
      staminaIV,
      ivPercent,
  
      fastMove: input.fastMove?.trim() ?? "",
      chargedMove: input.chargedMove?.trim() ?? "",
      chargedMove2:
        input.chargedMove2?.trim() ?? "",
  
      shiny: input.shiny ?? false,
      shadow: input.shadow ?? false,
      purified: input.purified ?? false,
      lucky: input.lucky ?? false,
      favorite: input.favorite ?? false,
  
      caughtAt: input.caughtAt ?? "",
      notes: input.notes?.trim() ?? "",
  
      priorityScore: analysis.priorityScore,
      metaScore: analysis.metaScore,
      targetRole: analysis.targetRole,
      recommendation: analysis.recommendation,
      reasons: analysis.reasons,
  
      raw: {},
    };
  }
  
  function parseCSV(
    text: string
  ): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let quoted = false;
  
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
  
      if (char === '"') {
        if (quoted && text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = !quoted;
        }
        continue;
      }
  
      if (char === "," && !quoted) {
        row.push(field);
        field = "";
        continue;
      }
  
      if (
        (char === "\n" || char === "\r") &&
        !quoted
      ) {
        if (char === "\r" && text[i + 1] === "\n") {
          i++;
        }
  
        row.push(field);
  
        if (
          row.some((value) => value.trim() !== "")
        ) {
          rows.push(row);
        }
  
        row = [];
        field = "";
        continue;
      }
  
      field += char;
    }
  
    row.push(field);
  
    if (row.some((value) => value.trim() !== "")) {
      rows.push(row);
    }
  
    return rows;
  }
  
  function flattenObject(
    input: unknown,
    prefix = "",
    result: Record<string, unknown> = {}
  ) {
    if (
      input === null ||
      typeof input !== "object" ||
      Array.isArray(input)
    ) {
      return result;
    }
  
    for (const [key, value] of Object.entries(input)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
  
      result[normalizeKey(fullKey)] = value;
      result[normalizeKey(key)] = value;
  
      if (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
      ) {
        flattenObject(value, fullKey, result);
      }
    }
  
    return result;
  }
  
  function firstValue(
    object: Record<string, unknown>,
    aliases: string[]
  ): unknown {
    for (const alias of aliases) {
      const value = object[normalizeKey(alias)];
  
      if (
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ""
      ) {
        return value;
      }
    }
  
    return undefined;
  }
  
  function importObjectToPokemon(
    raw: Record<string, unknown>,
    source: PokemonSource
  ): PokemonRecord | null {
    const flat = flattenObject(raw);
  
    const rawName = firstValue(flat, [
      "name",
      "pokemon",
      "pokemon name",
      "species",
      "species name",
    ]);
  
    if (
      rawName === undefined ||
      String(rawName).trim() === ""
    ) {
      return null;
    }
  
    const attackIV = toNumber(
      firstValue(flat, [
        "atk iv",
        "attack iv",
        "iv attack",
        "atk",
      ])
    );
  
    const defenseIV = toNumber(
      firstValue(flat, [
        "def iv",
        "defense iv",
        "iv defense",
        "def",
      ])
    );
  
    const staminaIV = toNumber(
      firstValue(flat, [
        "sta iv",
        "stamina iv",
        "hp iv",
        "iv stamina",
        "sta",
      ])
    );
  
    const record = createPokemon({
      source,
      name: String(rawName).trim(),
      form: String(
        firstValue(flat, ["form", "pokemon form"]) ?? ""
      ),
      nickname: String(
        firstValue(flat, ["nickname"]) ?? ""
      ),
      cp: toNumber(
        firstValue(flat, ["cp", "combat power"])
      ),
      hp: toNumber(firstValue(flat, ["hp"])),
      level: toNumber(
        firstValue(flat, ["level", "pokemon level"])
      ),
      attackIV,
      defenseIV,
      staminaIV,
      fastMove: String(
        firstValue(flat, [
          "fast move",
          "quick move",
          "move 1",
        ]) ?? ""
      ),
      chargedMove: String(
        firstValue(flat, [
          "charged move",
          "charge move",
          "move 2",
        ]) ?? ""
      ),
      chargedMove2: String(
        firstValue(flat, [
          "charged move 2",
          "charge move 2",
          "second charged move",
          "move 3",
        ]) ?? ""
      ),
      shiny: toBoolean(firstValue(flat, ["shiny"])),
      shadow: toBoolean(firstValue(flat, ["shadow"])),
      purified: toBoolean(
        firstValue(flat, ["purified"])
      ),
      lucky: toBoolean(firstValue(flat, ["lucky"])),
      favorite: toBoolean(
        firstValue(flat, ["favorite", "favourite"])
      ),
      caughtAt: String(
        firstValue(flat, [
          "caught at",
          "caught date",
          "date caught",
        ]) ?? ""
      ),
    });
  
    record.raw = raw;
  
    return record;
  }
  
  function parseCSVImport(
    text: string,
    source: PokemonSource
  ) {
    const rows = parseCSV(text);
  
    if (rows.length < 2) {
      return [];
    }
  
    const headers = rows[0];
    const result: PokemonRecord[] = [];
  
    for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
      const values = rows[rowIndex];
      const object: Record<string, unknown> = {};
  
      for (let columnIndex = 0; columnIndex < headers.length; columnIndex++) {
        object[
          headers[columnIndex]?.trim() ||
            `column${columnIndex}`
        ] =
          values[columnIndex]?.trim() ?? "";
      }
  
      const pokemon = importObjectToPokemon(
        object,
        source
      );
  
      if (pokemon) {
        result.push(pokemon);
      }
    }
  
    return result;
  }
  
  function findPokemonArray(
    input: unknown
  ): Record<string, unknown>[] {
    if (Array.isArray(input)) {
      return input.filter(
        (item) =>
          item !== null &&
          typeof item === "object" &&
          !Array.isArray(item)
      ) as Record<string, unknown>[];
    }
  
    if (
      input === null ||
      typeof input !== "object"
    ) {
      return [];
    }
  
    const object = input as Record<string, unknown>;
    const preferredKeys = [
      "pokemon",
      "pokemons",
      "collection",
      "inventory",
      "pokemonCollection",
      "pokemon_inventory",
    ];
  
    for (const key of preferredKeys) {
      if (key in object) {
        const found = findPokemonArray(object[key]);
        if (found.length > 0) {
          return found;
        }
      }
    }
  
    for (const value of Object.values(object)) {
      const found = findPokemonArray(value);
      if (found.length > 0) {
        return found;
      }
    }
  
    return [];
  }
  
  function parseJSONImport(
    text: string,
    source: PokemonSource
  ) {
    const parsed = JSON.parse(text);
    const objects = findPokemonArray(parsed);
    const result: PokemonRecord[] = [];
  
    for (const object of objects) {
      const pokemon = importObjectToPokemon(
        object,
        source
      );
  
      if (pokemon) {
        result.push(pokemon);
      }
    }
  
    return result;
  }
  
  export function parseRosterFile(
    fileName: string,
    text: string
  ): {
    pokemon: PokemonRecord[];
    format: string;
  } {
    const lower = fileName.toLowerCase();
  
    let source: PokemonSource = "import";
  
    if (lower.includes("genie")) {
      source = "pokegenie";
    } else if (
      lower.includes("niantic") ||
      lower.includes("pokemon")
    ) {
      source = "niantic";
    }
  
    if (
      lower.endsWith(".json") ||
      text.trim().startsWith("{") ||
      text.trim().startsWith("[")
    ) {
      return {
        pokemon: parseJSONImport(text, source),
        format: "JSON",
      };
    }
  
    return {
      pokemon: parseCSVImport(
        text,
        source === "import" ? "pokegenie" : source
      ),
      format: "CSV",
    };
  }
  
  export function saveRoster(
    pokemon: PokemonRecord[]
  ) {
    if (typeof window === "undefined") {
      return;
    }
  
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(pokemon)
    );
  }
  
  export function loadRoster(): PokemonRecord[] {
    if (typeof window === "undefined") {
      return [];
    }
  
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
  
      if (!stored) {
        return [];
      }
  
      const parsed = JSON.parse(stored);
  
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  
  export function clearRoster() {
    if (typeof window === "undefined") {
      return;
    }
  
    localStorage.removeItem(STORAGE_KEY);
  }