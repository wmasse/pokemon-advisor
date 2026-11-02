"use client";

import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

import AdvisorDrawer from "./components/AdvisorDrawer";
import {
  clearRoster,
  createPokemon,
  loadRoster,
  parseRosterFile,
  saveRoster,
} from "@/lib/pokemon";
import type { PokemonInput, PokemonRecord } from "@/lib/pokemon";

type Filter = "ALL" | "PRIORITY" | "PVP" | "SHADOW" | "SHINY" | "PERFECT";
type SortMode = "PRIORITY" | "CP_HIGH" | "CP_LOW" | "IV_HIGH" | "IV_LOW" | "NAME";
type ImportMode = "MERGE" | "REPLACE";
type League = "Great League" | "Ultra League" | "Master League";

type PvPEntry = {
  speciesId: string;
  speciesName: string;
  rank: number;
  score: number;
  moveset: string[];
};

type PvPData = {
  updatedAt: string;
  source: string;
  great: PvPEntry[];
  ultra: PvPEntry[];
  master: PvPEntry[];
};

type LeagueRecommendation = {
  league: League;
  entry: PvPEntry;
  advisorScore: number;
  fastMove: string | null;
  chargedMove1: string | null;
  chargedMove2: string | null;
};

type PokemonGoOption = {
  dex: number | null;
  speciesId: string;
  speciesName: string;
  fastMoves: string[];
  chargedMoves: string[];
  eliteMoves: string[];
  tags: string[];
};

type PokemonOptionsResponse = {
  source: string;
  updatedAt: string;
  pokemon: PokemonGoOption[];
};

type PokemonFormState = {
  name: string;
  form: string;
  nickname: string;
  cp: string;
  hp: string;
  level: string;
  attackIV: string;
  defenseIV: string;
  staminaIV: string;
  fastMove: string;
  chargedMove: string;
  secondChargedUnlocked: boolean;
  chargedMove2: string;
  shiny: boolean;
  shadow: boolean;
  purified: boolean;
  lucky: boolean;
  favorite: boolean;
  caughtAt: string;
  notes: string;
};

const EMPTY_FORM: PokemonFormState = {
  name: "",
  form: "",
  nickname: "",
  cp: "",
  hp: "",
  level: "",
  attackIV: "",
  defenseIV: "",
  staminaIV: "",
  fastMove: "",
  chargedMove: "",
  secondChargedUnlocked: false,
  chargedMove2: "",
  shiny: false,
  shadow: false,
  purified: false,
  lucky: false,
  favorite: false,
  caughtAt: "",
  notes: "",
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/é/g, "e")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function getPokemonSpecies(pokemon: PokemonRecord) {
  for (const [key, value] of Object.entries(pokemon.raw ?? {})) {
    const normalizedKey = normalize(key).replace(/\s/g, "");
    if (
      normalizedKey === "pokemon" ||
      normalizedKey === "species" ||
      normalizedKey === "pokemonname"
    ) {
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  }
  return pokemon.name;
}

function getPokemonForm(pokemon: PokemonRecord) {
  if (pokemon.form) return pokemon.form;

  for (const [key, value] of Object.entries(pokemon.raw ?? {})) {
    if (normalize(key) === "form" && typeof value === "string") {
      return value.trim();
    }
  }

  return "";
}

function splitSpeciesName(fullName: string) {
  let cleaned = fullName.trim();
  let shadow = false;

  if (/\s\(Shadow\)$/i.test(cleaned)) {
    shadow = true;
    cleaned = cleaned.replace(/\s\(Shadow\)$/i, "");
  }

  const match = cleaned.match(/^(.*?)\s+\(([^()]*)\)$/);

  if (match) {
    return {
      name: match[1].trim(),
      form: match[2].trim(),
      shadow,
    };
  }

  return {
    name: cleaned,
    form: "",
    shadow,
  };
}

function isShadowOption(option: PokemonGoOption) {
  return (
    option.tags.includes("shadow") ||
    option.speciesId.endsWith("_shadow") ||
    /\(Shadow\)$/i.test(option.speciesName)
  );
}

function isMegaOption(option: PokemonGoOption) {
  return option.tags.includes("mega") || option.speciesId.includes("_mega");
}

function findPokemonGoOption(
  options: PokemonGoOption[],
  name: string,
  form: string,
  shadow: boolean
) {
  const wantedName = normalize(name);
  const wantedForm = normalize(form);

  if (!wantedName) return null;

  const candidates = options.filter((option) => {
    const parsed = splitSpeciesName(option.speciesName);

    if (normalize(parsed.name) !== wantedName) return false;
    if (shadow !== isShadowOption(option)) return false;

    if (wantedForm) {
      return (
        normalize(parsed.form) === wantedForm ||
        normalize(option.speciesName).includes(wantedForm) ||
        normalize(option.speciesId).includes(wantedForm)
      );
    }

    return !parsed.form || normalize(parsed.form) === "normal";
  });

  if (candidates.length > 0) return candidates[0];

  if (shadow) {
    return findPokemonGoOption(options, name, form, false);
  }

  return null;
}

function truthyImportValue(value: unknown) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value === null || value === undefined) return false;

  const text = String(value).trim().toLowerCase();

  if (
    !text ||
    ["false", "no", "n", "0", "0.0", "none", "normal"].includes(text)
  ) {
    return false;
  }

  return ["true", "yes", "y", "1", "1.0", "x", "shiny", "✨", "★"].includes(text);
}

function rawSaysShiny(pokemon: PokemonRecord) {
  for (const [key, value] of Object.entries(pokemon.raw ?? {})) {
    if (normalize(key).includes("shiny")) {
      return truthyImportValue(value);
    }
  }
  return false;
}

function rankingMatchScore(pokemon: PokemonRecord, ranking: PvPEntry) {
  const species = normalize(getPokemonSpecies(pokemon));
  const form = normalize(getPokemonForm(pokemon));
  const rankingName = normalize(ranking.speciesName);

  if (rankingName === species) {
    if (!form || form === "normal") return 100;
    return 70;
  }

  if (rankingName.startsWith(`${species} `)) {
    if (form && rankingName.includes(form)) return 110;
    return 80;
  }

  if (rankingName.includes(species) && form && rankingName.includes(form)) {
    return 90;
  }

  return 0;
}

function findRanking(pokemon: PokemonRecord, rankings: PvPEntry[]) {
  let best: PvPEntry | null = null;
  let bestMatch = 0;

  for (const entry of rankings) {
    const match = rankingMatchScore(pokemon, entry);
    if (match > bestMatch) {
      bestMatch = match;
      best = entry;
    }
  }

  return bestMatch >= 80 ? best : null;
}

function eligibleForLeague(pokemon: PokemonRecord, league: League) {
  if (league === "Master League") return true;
  if (pokemon.cp === null) return false;
  if (league === "Great League") return pokemon.cp <= 1500;
  if (league === "Ultra League") return pokemon.cp <= 2500;
  return false;
}

function calculateAdvisorScore(
  pokemon: PokemonRecord,
  league: League,
  metaScore: number
) {
  let score = metaScore * 0.78;

  const attack = pokemon.attackIV;
  const defense = pokemon.defenseIV;
  const stamina = pokemon.staminaIV;
  const hasIV = attack !== null && defense !== null && stamina !== null;

  if (hasIV && (league === "Great League" || league === "Ultra League")) {
    if (attack <= 3 && defense >= 12 && stamina >= 12) {
      score += 12;
    } else if (attack <= 5 && defense >= 10 && stamina >= 10) {
      score += 7;
    }
  }

  if (hasIV && league === "Master League") {
    const ivPercent = ((attack + defense + stamina) / 45) * 100;

    if (ivPercent >= 99.99) score += 12;
    else if (ivPercent >= 96) score += 8;
    else if (ivPercent >= 91) score += 4;
  }

  if (pokemon.shiny) score += 8;
  if (pokemon.shadow) score += 3;
  if (pokemon.lucky) score += 2;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function getBestRecommendation(
  pokemon: PokemonRecord,
  data: PvPData | null
): LeagueRecommendation | null {
  if (!data) return null;

  const candidates: { league: League; entry: PvPEntry }[] = [];

  if (eligibleForLeague(pokemon, "Great League")) {
    const entry = findRanking(pokemon, data.great);
    if (entry) candidates.push({ league: "Great League", entry });
  }

  if (eligibleForLeague(pokemon, "Ultra League")) {
    const entry = findRanking(pokemon, data.ultra);
    if (entry) candidates.push({ league: "Ultra League", entry });
  }

  const master = findRanking(pokemon, data.master);
  if (master) candidates.push({ league: "Master League", entry: master });

  if (candidates.length === 0) return null;

  const scored = candidates.map((candidate) => ({
    ...candidate,
    advisorScore: calculateAdvisorScore(
      pokemon,
      candidate.league,
      candidate.entry.score
    ),
    fastMove: candidate.entry.moveset[0] ?? null,
    chargedMove1: candidate.entry.moveset[1] ?? null,
    chargedMove2: candidate.entry.moveset[2] ?? null,
  }));

  scored.sort((a, b) => {
    const metaDifference = b.entry.score - a.entry.score;
    if (Math.abs(metaDifference) >= 2) return metaDifference;
    return b.advisorScore - a.advisorScore;
  });

  return scored[0];
}

function formatMove(move: string | null) {
  if (!move) return "—";

  const formatted = move
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  const replacements: Record<string, string> = {
    "V Create": "V-Create",
    "X Scissor": "X-Scissor",
    "Lock On": "Lock-On",
  };

  return replacements[formatted] ?? formatted;
}

function sameMove(first: string, second: string) {
  return normalize(first) === normalize(second);
}

function hasMove(wanted: string, current: string[]) {
  return current.some((move) => move.trim() && sameMove(wanted, move));
}

function orderRecommendedChargedMoves(
  pokemon: PokemonRecord,
  recommendation: LeagueRecommendation
) {
  const first = formatMove(recommendation.chargedMove1);
  const second = formatMove(recommendation.chargedMove2);
  const owned = [pokemon.chargedMove, pokemon.chargedMove2].filter(
    (move): move is string => Boolean(move)
  );

  const ownsFirst = hasMove(first, owned);
  const ownsSecond = hasMove(second, owned);

  if (!ownsFirst && ownsSecond) return [second, first] as const;
  return [first, second] as const;
}

const artworkCache = new Map<string, string>();

function normalizePokeApi(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/é/g, "e")
    .replace(/['.’:]/g, "")
    .replace(/\s+/g, "-");
}

function buildPokeApiQueries(pokemon: PokemonRecord) {
  const name = normalizePokeApi(getPokemonSpecies(pokemon));
  const form = normalizePokeApi(getPokemonForm(pokemon));
  const queries: string[] = [];

  if (form.includes("alola")) queries.push(`${name}-alola`);
  if (form.includes("galar")) queries.push(`${name}-galar`);
  if (form.includes("hisui")) queries.push(`${name}-hisui`);
  if (form.includes("paldea")) queries.push(`${name}-paldea`);

  queries.push(name);
  return Array.from(new Set(queries));
}

async function resolveArtwork(pokemon: PokemonRecord) {
  const cacheKey = `${getPokemonSpecies(pokemon)}|${getPokemonForm(pokemon)}|${pokemon.shiny}`;
  const cached = artworkCache.get(cacheKey);

  if (cached !== undefined) return cached;

  for (const query of buildPokeApiQueries(pokemon)) {
    try {
      const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${query}`);
      if (!response.ok) continue;

      const data = await response.json();
      const id = data?.id;
      if (!id) continue;

      const url = pokemon.shiny
        ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/${id}.png`
        : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

      artworkCache.set(cacheKey, url);
      return url;
    } catch {
      // Try the next candidate.
    }
  }

  artworkCache.set(cacheKey, "");
  return "";
}

export default function Home() {
  const [pokemon, setPokemon] = useState<PokemonRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pvpData, setPvpData] = useState<PvPData | null>(null);
  const [pvpError, setPvpError] = useState("");
  const [pokemonOptions, setPokemonOptions] = useState<PokemonGoOption[]>([]);
  const [pokemonDataError, setPokemonDataError] = useState("");
  const [nameFocused, setNameFocused] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [sortMode, setSortMode] = useState<SortMode>("PRIORITY");
  const [minCP, setMinCP] = useState(0);
  const [maxCP, setMaxCP] = useState(5000);
  const [importMode, setImportMode] = useState<ImportMode>("MERGE");
  const [importMessage, setImportMessage] = useState("");
  const [error, setError] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PokemonFormState>(EMPTY_FORM);

  useEffect(() => {
    const saved = loadRoster();
    let changed = false;

    const migrated = saved.map((item) => {
      if (!item.shiny && rawSaysShiny(item)) {
        changed = true;
        return { ...item, shiny: true };
      }
      return item;
    });

    setPokemon(migrated);
    if (changed) saveRoster(migrated);
    setLoaded(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPokemonOptions() {
      try {
        const response = await fetch("/api/pokemon-options", { cache: "no-store" });
        if (!response.ok) throw new Error();

        const data: PokemonOptionsResponse = await response.json();

        if (!cancelled) {
          setPokemonOptions(data.pokemon);
          setPokemonDataError("");
        }
      } catch {
        if (!cancelled) {
          setPokemonDataError("Could not load Pokémon GO move pools.");
        }
      }
    }

    void loadPokemonOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPvP() {
      try {
        const response = await fetch("/api/pvp-meta", { cache: "no-store" });
        if (!response.ok) throw new Error();

        const data: PvPData = await response.json();

        if (!cancelled) {
          setPvpData(data);
          setPvpError("");
        }
      } catch {
        if (!cancelled) {
          setPvpError("Could not load PvPoke rankings.");
        }
      }
    }

    void loadPvP();

    return () => {
      cancelled = true;
    };
  }, []);

  const collectionMaxCP = useMemo(() => {
    const values = pokemon
      .map((item) => item.cp ?? 0)
      .filter((cp) => cp > 0);

    if (values.length === 0) return 5000;

    return Math.max(5000, Math.ceil(Math.max(...values) / 500) * 500);
  }, [pokemon]);

  useEffect(() => {
    setMaxCP(collectionMaxCP);
  }, [collectionMaxCP]);

  function commitRoster(next: PokemonRecord[]) {
    setPokemon(next);
    saveRoster(next);
  }

  const nameChoices = useMemo(() => {
    const map = new Map<string, PokemonGoOption>();

    for (const option of pokemonOptions) {
      if (isShadowOption(option) || isMegaOption(option)) continue;
      if (!map.has(option.speciesId)) map.set(option.speciesId, option);
    }

    return Array.from(map.values());
  }, [pokemonOptions]);

  const nameSuggestions = useMemo(() => {
    const typed = normalize(form.name);
    if (!typed) return [];

    const starts = nameChoices.filter((option) =>
      normalize(option.speciesName).startsWith(typed)
    );

    const contains = nameChoices.filter(
      (option) =>
        !normalize(option.speciesName).startsWith(typed) &&
        normalize(option.speciesName).includes(typed)
    );

    return [...starts, ...contains].slice(0, 10);
  }, [nameChoices, form.name]);

  function choosePokemon(option: PokemonGoOption) {
    const parsed = splitSpeciesName(option.speciesName);

    setForm((previous) => ({
      ...previous,
      name: parsed.name,
      form: parsed.form,
      fastMove: "",
      chargedMove: "",
      chargedMove2: "",
      secondChargedUnlocked: false,
    }));

    setNameFocused(false);
  }

  const selectedPokemonOption = useMemo(
    () =>
      findPokemonGoOption(
        pokemonOptions,
        form.name,
        form.form,
        form.shadow
      ),
    [pokemonOptions, form.name, form.form, form.shadow]
  );

  const fastMoveOptions = useMemo(() => {
    return selectedPokemonOption ? [...selectedPokemonOption.fastMoves] : [];
  }, [selectedPokemonOption]);

  const chargedMoveOptions = useMemo(() => {
    if (!selectedPokemonOption) return [];

    const moves = [...selectedPokemonOption.chargedMoves];

    if (form.shadow && !moves.includes("FRUSTRATION")) {
      moves.push("FRUSTRATION");
    }

    if (form.purified && !moves.includes("RETURN")) {
      moves.push("RETURN");
    }

    return moves;
  }, [selectedPokemonOption, form.shadow, form.purified]);

  const eliteMoves = selectedPokemonOption?.eliteMoves ?? [];

  function toggleShiny(id: string) {
    commitRoster(
      pokemon.map((item) =>
        item.id === id ? { ...item, shiny: !item.shiny } : item
      )
    );
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setImportMessage("");

    try {
      const text = await file.text();
      const parsed = parseRosterFile(file.name, text);

      if (parsed.pokemon.length === 0) {
        setError("I couldn't identify any Pokémon in that file.");
        return;
      }

      const imported = parsed.pokemon.map((item) =>
        rawSaysShiny(item) ? { ...item, shiny: true } : item
      );

      if (importMode === "REPLACE") {
        commitRoster(imported);
      } else {
        commitRoster([...pokemon, ...imported]);
      }

      setImportMessage(`${imported.length} Pokémon imported from ${file.name}.`);
    } catch {
      setError("The file could not be parsed.");
    }

    event.target.value = "";
  }

  function openAddPokemon() {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      caughtAt: new Date().toISOString().slice(0, 10),
    });
    setNameFocused(false);
    setShowEditor(true);
  }

  function openEditPokemon(item: PokemonRecord) {
    setEditingId(item.id);
    setForm({
      name: getPokemonSpecies(item),
      form: getPokemonForm(item),
      nickname: item.nickname,
      cp: item.cp !== null ? String(item.cp) : "",
      hp: item.hp !== null ? String(item.hp) : "",
      level: item.level !== null ? String(item.level) : "",
      attackIV: item.attackIV !== null ? String(item.attackIV) : "",
      defenseIV: item.defenseIV !== null ? String(item.defenseIV) : "",
      staminaIV: item.staminaIV !== null ? String(item.staminaIV) : "",
      fastMove: item.fastMove,
      chargedMove: item.chargedMove,
      secondChargedUnlocked: Boolean(item.chargedMove2),
      chargedMove2: item.chargedMove2,
      shiny: item.shiny,
      shadow: item.shadow,
      purified: item.purified,
      lucky: item.lucky,
      favorite: item.favorite,
      caughtAt: item.caughtAt,
      notes: item.notes,
    });
    setNameFocused(false);
    setShowEditor(true);
  }

  function optionalNumber(value: string) {
    if (value.trim() === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function submitPokemon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Pokémon species is required.");
      return;
    }

    const attackIV = optionalNumber(form.attackIV);
    const defenseIV = optionalNumber(form.defenseIV);
    const staminaIV = optionalNumber(form.staminaIV);

    for (const iv of [attackIV, defenseIV, staminaIV]) {
      if (iv !== null && (iv < 0 || iv > 15)) {
        setError("IV values must be between 0 and 15.");
        return;
      }
    }

    const old = editingId
      ? pokemon.find((item) => item.id === editingId) ?? null
      : null;

    const input: PokemonInput = {
      source: old?.source ?? "manual",
      name: form.name.trim(),
      form: form.form.trim(),
      nickname: form.nickname,
      cp: optionalNumber(form.cp),
      hp: optionalNumber(form.hp),
      level: optionalNumber(form.level),
      attackIV,
      defenseIV,
      staminaIV,
      fastMove: form.fastMove,
      chargedMove: form.chargedMove,
      chargedMove2: form.secondChargedUnlocked ? form.chargedMove2 : "",
      shiny: form.shiny,
      shadow: form.shadow,
      purified: form.purified,
      lucky: form.lucky,
      favorite: form.favorite,
      caughtAt: form.caughtAt,
      notes: form.notes,
    };

    const created = createPokemon(input, editingId ?? undefined);
    const finalRecord: PokemonRecord = old
      ? { ...created, raw: old.raw }
      : created;

    if (editingId) {
      commitRoster(
        pokemon.map((item) => (item.id === editingId ? finalRecord : item))
      );
    } else {
      commitRoster([finalRecord, ...pokemon]);
    }

    setShowEditor(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
  }

  function deletePokemon(id: string) {
    if (!window.confirm("Delete this Pokémon from the advisor?")) return;
    commitRoster(pokemon.filter((item) => item.id !== id));
  }

  function handleClear() {
    if (!window.confirm("Clear the entire local Pokémon roster?")) return;
    clearRoster();
    setPokemon([]);
  }

  const enriched = useMemo(
    () =>
      pokemon.map((item) => ({
        pokemon: item,
        recommendation: getBestRecommendation(item, pvpData),
      })),
    [pokemon, pvpData]
  );

  const stats = useMemo(
    () => ({
      total: pokemon.length,
      shiny: pokemon.filter((item) => item.shiny).length,
      shadow: pokemon.filter((item) => item.shadow).length,
      perfect: pokemon.filter(
        (item) => item.ivPercent !== null && item.ivPercent >= 99.99
      ).length,
      meta: enriched.filter(
        (item) => (item.recommendation?.entry.score ?? 0) >= 85
      ).length,
    }),
    [pokemon, enriched]
  );

  const visible = useMemo(() => {
    const query = normalize(search);

    const filtered = enriched.filter((row) => {
      const item = row.pokemon;

      if (
        query &&
        !normalize(getPokemonSpecies(item)).includes(query) &&
        !normalize(item.nickname).includes(query) &&
        !normalize(getPokemonForm(item)).includes(query)
      ) {
        return false;
      }

      if (item.cp !== null) {
        if (item.cp < minCP || item.cp > maxCP) return false;
      } else if (minCP > 0 || maxCP < collectionMaxCP) {
        return false;
      }

      switch (filter) {
        case "PRIORITY":
          return (row.recommendation?.advisorScore ?? 0) >= 75;
        case "PVP":
          return row.recommendation !== null;
        case "SHADOW":
          return item.shadow;
        case "SHINY":
          return item.shiny;
        case "PERFECT":
          return item.ivPercent !== null && item.ivPercent >= 99.99;
        default:
          return true;
      }
    });

    filtered.sort((a, b) => {
      switch (sortMode) {
        case "CP_HIGH":
          return (b.pokemon.cp ?? -1) - (a.pokemon.cp ?? -1);
        case "CP_LOW":
          return (a.pokemon.cp ?? Infinity) - (b.pokemon.cp ?? Infinity);
        case "IV_HIGH":
          return (b.pokemon.ivPercent ?? -1) - (a.pokemon.ivPercent ?? -1);
        case "IV_LOW":
          return (a.pokemon.ivPercent ?? Infinity) - (b.pokemon.ivPercent ?? Infinity);
        case "NAME":
          return getPokemonSpecies(a.pokemon).localeCompare(
            getPokemonSpecies(b.pokemon)
          );
        case "PRIORITY":
        default:
          return (
            (b.recommendation?.advisorScore ?? 0) -
            (a.recommendation?.advisorScore ?? 0)
          );
      }
    });

    return filtered;
  }, [
    enriched,
    search,
    filter,
    sortMode,
    minCP,
    maxCP,
    collectionMaxCP,
  ]);

  if (!loaded) {
    return <main className="min-h-screen bg-zinc-950" />;
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
              Pokémon GO
            </div>
            <h1 className="mt-2 text-4xl font-bold">Pokémon Advisor</h1>
            <p className="mt-2 text-zinc-400">
              PvP rankings, GO movesets, IVs, upgrade priorities and AI advice.
            </p>
          </div>

          <button
            type="button"
            onClick={openAddPokemon}
            className="cursor-pointer rounded-xl bg-emerald-500 px-5 py-3 font-bold text-black hover:bg-emerald-400"
          >
            + Add Pokémon
          </button>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <StatusBadge good={Boolean(pvpData)} error={pvpError}>
            PvPoke rankings
          </StatusBadge>
          <StatusBadge good={pokemonOptions.length > 0} error={pokemonDataError}>
            Pokémon GO move pools
          </StatusBadge>
        </div>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Collection" value={String(stats.total)} />
          <StatCard label="Shiny" value={String(stats.shiny)} />
          <StatCard label="Shadow" value={String(stats.shadow)} />
          <StatCard label="100% IV" value={String(stats.perfect)} />
          <StatCard label="Strong Meta" value={String(stats.meta)} />
        </section>

        <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Collection</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Import another roster or add future catches manually.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setImportMode("MERGE")}
                className={
                  importMode === "MERGE"
                    ? "rounded-full bg-white px-4 py-2 text-sm font-bold text-black"
                    : "rounded-full bg-zinc-950 px-4 py-2 text-sm text-zinc-400"
                }
              >
                Merge
              </button>

              <button
                type="button"
                onClick={() => setImportMode("REPLACE")}
                className={
                  importMode === "REPLACE"
                    ? "rounded-full bg-white px-4 py-2 text-sm font-bold text-black"
                    : "rounded-full bg-zinc-950 px-4 py-2 text-sm text-zinc-400"
                }
              >
                Replace
              </button>

              <label className="cursor-pointer rounded-xl bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500">
                Import CSV / JSON
                <input
                  type="file"
                  accept=".csv,.json"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {importMessage && (
            <div className="mt-4 rounded-xl bg-emerald-950 p-4 text-emerald-200">
              {importMessage}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search Pokémon..."
              className="input"
            />

            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="input cursor-pointer"
            >
              <option value="PRIORITY">Best Upgrade Priority</option>
              <option value="CP_HIGH">CP: High → Low</option>
              <option value="CP_LOW">CP: Low → High</option>
              <option value="IV_HIGH">IVs: Best → Worst</option>
              <option value="IV_LOW">IVs: Worst → Best</option>
              <option value="NAME">Name: A → Z</option>
            </select>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <FilterButton active={filter === "ALL"} onClick={() => setFilter("ALL")}>
              All
            </FilterButton>
            <FilterButton
              active={filter === "PRIORITY"}
              onClick={() => setFilter("PRIORITY")}
            >
              Top Priority
            </FilterButton>
            <FilterButton active={filter === "PVP"} onClick={() => setFilter("PVP")}>
              GBL
            </FilterButton>
            <FilterButton
              active={filter === "SHINY"}
              onClick={() => setFilter("SHINY")}
            >
              Shiny
            </FilterButton>
            <FilterButton
              active={filter === "SHADOW"}
              onClick={() => setFilter("SHADOW")}
            >
              Shadow
            </FilterButton>
            <FilterButton
              active={filter === "PERFECT"}
              onClick={() => setFilter("PERFECT")}
            >
              100%
            </FilterButton>
          </div>

          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">CP Range</div>
                <div className="text-sm text-zinc-500">
                  Only show Pokémon inside this range.
                </div>
              </div>

              <div className="rounded-full bg-zinc-900 px-4 py-2 font-mono text-sm font-bold text-emerald-400">
                {minCP} – {maxCP}
              </div>
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <RangeField
                label="Minimum"
                value={minCP}
                max={collectionMaxCP}
                onChange={(value) => setMinCP(Math.min(value, maxCP))}
              />
              <RangeField
                label="Maximum"
                value={maxCP}
                max={collectionMaxCP}
                onChange={(value) => setMaxCP(Math.max(value, minCP))}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setMinCP(0);
                  setMaxCP(1500);
                }}
                className="rounded-lg bg-zinc-900 px-3 py-2 text-xs hover:bg-zinc-800"
              >
                Great League
              </button>

              <button
                type="button"
                onClick={() => {
                  setMinCP(0);
                  setMaxCP(2500);
                }}
                className="rounded-lg bg-zinc-900 px-3 py-2 text-xs hover:bg-zinc-800"
              >
                Ultra League
              </button>

              <button
                type="button"
                onClick={() => {
                  setMinCP(0);
                  setMaxCP(collectionMaxCP);
                }}
                className="rounded-lg bg-zinc-900 px-3 py-2 text-xs hover:bg-zinc-800"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="mt-4 text-sm text-zinc-500">
            Showing <span className="text-white">{visible.length}</span> of{" "}
            <span className="text-white">{pokemon.length}</span>
          </div>
        </section>

        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((row) => (
            <PokemonCard
              key={row.pokemon.id}
              pokemon={row.pokemon}
              recommendation={row.recommendation}
              onToggleShiny={() => toggleShiny(row.pokemon.id)}
              onEdit={() => openEditPokemon(row.pokemon)}
              onDelete={() => deletePokemon(row.pokemon.id)}
            />
          ))}
        </div>

        {visible.length === 0 && pokemon.length > 0 && (
          <div className="mt-8 rounded-2xl border border-dashed border-zinc-700 p-10 text-center text-zinc-500">
            No Pokémon match your current filters.
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-xl border border-red-900 bg-red-950 p-4 text-red-200">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleClear}
          className="mt-10 cursor-pointer text-sm text-red-400 hover:text-red-300"
        >
          Clear entire collection
        </button>
      </div>

      {showEditor && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/80 p-4">
          <form
            onSubmit={submitPokemon}
            className="relative mx-auto my-8 max-w-2xl rounded-3xl border border-zinc-700 bg-zinc-900 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm uppercase tracking-wider text-zinc-500">
                  {editingId ? "Edit roster entry" : "New catch"}
                </div>
                <h2 className="mt-1 text-2xl font-bold">
                  {editingId ? "Edit Pokémon" : "Add Pokémon"}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setShowEditor(false)}
                className="cursor-pointer rounded-full bg-zinc-800 px-4 py-2 hover:bg-zinc-700"
              >
                ✕
              </button>
            </div>

            <div className="mt-7">
              <div className="mb-2 text-sm text-zinc-400">Pokémon Species *</div>

              <div className="relative">
                <input
                  autoFocus
                  value={form.name}
                  onFocus={() => setNameFocused(true)}
                  onChange={(event) => {
                    setForm({
                      ...form,
                      name: event.target.value,
                      form: "",
                      fastMove: "",
                      chargedMove: "",
                      chargedMove2: "",
                      secondChargedUnlocked: false,
                    });
                    setNameFocused(true);
                  }}
                  placeholder="Start typing, e.g. zam..."
                  autoComplete="off"
                  className="input"
                />

                {nameFocused && nameSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-[250] mt-2 max-h-72 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950 p-2 shadow-2xl">
                    {nameSuggestions.map((option) => (
                      <button
                        key={option.speciesId}
                        type="button"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          choosePokemon(option);
                        }}
                        className="flex w-full cursor-pointer items-center justify-between rounded-lg px-4 py-3 text-left hover:bg-zinc-800"
                      >
                        <span className="font-semibold">{option.speciesName}</span>
                        {option.dex !== null && (
                          <span className="text-xs text-zinc-600">#{option.dex}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {form.form && (
                <div className="mt-2 text-sm text-emerald-400">Form: {form.form}</div>
              )}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Nickname">
                <input
                  value={form.nickname}
                  onChange={(event) =>
                    setForm({ ...form, nickname: event.target.value })
                  }
                  className="input"
                />
              </Field>

              <NumberField
                label="CP"
                value={form.cp}
                onChange={(value) => setForm({ ...form, cp: value })}
              />

              <NumberField
                label="HP"
                value={form.hp}
                onChange={(value) => setForm({ ...form, hp: value })}
              />

              <NumberField
                label="Level"
                step="0.5"
                value={form.level}
                onChange={(value) => setForm({ ...form, level: value })}
              />
            </div>

            <section className="mt-8">
              <div className="font-semibold">IVs</div>
              <div className="mt-1 text-sm text-zinc-500">
                Enter the three appraisal values from 0–15.
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <IVField
                  label="Attack"
                  value={form.attackIV}
                  onChange={(value) => setForm({ ...form, attackIV: value })}
                />
                <IVField
                  label="Defense"
                  value={form.defenseIV}
                  onChange={(value) => setForm({ ...form, defenseIV: value })}
                />
                <IVField
                  label="HP"
                  value={form.staminaIV}
                  onChange={(value) => setForm({ ...form, staminaIV: value })}
                />
              </div>
            </section>

            <section className="mt-8">
              <div className="font-semibold">Special</div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Toggle
                  label="✨ Shiny"
                  checked={form.shiny}
                  onChange={(value) => setForm({ ...form, shiny: value })}
                />

                <Toggle
                  label="Shadow"
                  checked={form.shadow}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      shadow: value,
                      purified: value ? false : form.purified,
                      fastMove: "",
                      chargedMove: "",
                      chargedMove2: "",
                      secondChargedUnlocked: false,
                    })
                  }
                />

                <Toggle
                  label="Purified"
                  checked={form.purified}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      purified: value,
                      shadow: value ? false : form.shadow,
                      chargedMove: "",
                      chargedMove2: "",
                      secondChargedUnlocked: false,
                    })
                  }
                />

                <Toggle
                  label="Lucky"
                  checked={form.lucky}
                  onChange={(value) => setForm({ ...form, lucky: value })}
                />

                <Toggle
                  label="★ Favorite"
                  checked={form.favorite}
                  onChange={(value) => setForm({ ...form, favorite: value })}
                />
              </div>
            </section>

            <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
              <div className="font-semibold">Current Moves</div>
              <div className="mt-1 text-sm text-zinc-500">
                {selectedPokemonOption
                  ? `Showing moves available to ${selectedPokemonOption.speciesName} in Pokémon GO.`
                  : "Choose a Pokémon from the species dropdown first."}
              </div>

              <div className="mt-5 space-y-5">
                <MovePicker
                  label="Fast Attack"
                  value={form.fastMove}
                  placeholder="Choose Fast Attack"
                  moves={fastMoveOptions}
                  eliteMoves={eliteMoves}
                  disabled={!selectedPokemonOption}
                  onSelect={(move) =>
                    setForm({ ...form, fastMove: formatMove(move) })
                  }
                />

                <MovePicker
                  label="Charged Attack 1"
                  value={form.chargedMove}
                  placeholder="Choose Charged Attack"
                  moves={chargedMoveOptions.filter(
                    (move) =>
                      !form.chargedMove2 ||
                      !sameMove(formatMove(move), form.chargedMove2)
                  )}
                  eliteMoves={eliteMoves}
                  disabled={!selectedPokemonOption}
                  onSelect={(move) =>
                    setForm({ ...form, chargedMove: formatMove(move) })
                  }
                />

                <button
                  type="button"
                  disabled={!selectedPokemonOption}
                  onClick={() =>
                    setForm({
                      ...form,
                      secondChargedUnlocked: !form.secondChargedUnlocked,
                      chargedMove2: form.secondChargedUnlocked ? "" : form.chargedMove2,
                    })
                  }
                  className={
                    form.secondChargedUnlocked
                      ? "w-full cursor-pointer rounded-xl border border-emerald-700 bg-emerald-950 p-4 text-left font-semibold text-emerald-300"
                      : "w-full cursor-pointer rounded-xl border border-zinc-700 bg-zinc-900 p-4 text-left font-semibold text-zinc-400 disabled:cursor-not-allowed disabled:opacity-40"
                  }
                >
                  {form.secondChargedUnlocked
                    ? "✓ Second Charged Attack Unlocked"
                    : "+ Second Charged Attack Unlocked"}
                </button>

                {form.secondChargedUnlocked && (
                  <MovePicker
                    label="Charged Attack 2"
                    value={form.chargedMove2}
                    placeholder="Choose Second Charged Attack"
                    moves={chargedMoveOptions.filter(
                      (move) =>
                        !form.chargedMove ||
                        !sameMove(formatMove(move), form.chargedMove)
                    )}
                    eliteMoves={eliteMoves}
                    disabled={!selectedPokemonOption}
                    onSelect={(move) =>
                      setForm({ ...form, chargedMove2: formatMove(move) })
                    }
                  />
                )}
              </div>
            </section>

            <button
              type="submit"
              className="mt-8 w-full cursor-pointer rounded-xl bg-emerald-500 px-5 py-4 font-bold text-black hover:bg-emerald-400"
            >
              {editingId ? "Save Changes" : "Add to Collection"}
            </button>
          </form>
        </div>
      )}

      <AdvisorDrawer />

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgb(63 63 70);
          background: rgb(9 9 11);
          padding: 0.75rem 1rem;
          color: white;
          outline: none;
        }

        .input:focus {
          border-color: rgb(16 185 129);
        }
      `}</style>
    </main>
  );
}

function PokemonCard({
  pokemon,
  recommendation,
  onToggleShiny,
  onEdit,
  onDelete,
}: {
  pokemon: PokemonRecord;
  recommendation: LeagueRecommendation | null;
  onToggleShiny: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [artwork, setArtwork] = useState("");

  useEffect(() => {
    let active = true;

    void resolveArtwork(pokemon).then((value) => {
      if (active) setArtwork(value);
    });

    return () => {
      active = false;
    };
  }, [pokemon.name, pokemon.form, pokemon.shiny]);

  const currentCharged = [pokemon.chargedMove, pokemon.chargedMove2].filter(
    (move): move is string => Boolean(move)
  );

  const recommendedFast = formatMove(recommendation?.fastMove ?? null);

  let recommendedCharged1 = "—";
  let recommendedCharged2 = "—";

  if (recommendation) {
    const ordered = orderRecommendedChargedMoves(pokemon, recommendation);
    recommendedCharged1 = ordered[0];
    recommendedCharged2 = ordered[1];
  }

  return (
    <article
      className={
        pokemon.shiny
          ? "relative isolate overflow-hidden rounded-2xl border border-amber-700/60 bg-zinc-900 p-5 shadow-[0_0_25px_rgba(245,158,11,0.08)]"
          : "relative isolate overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
      }
    >
      <div className="flex gap-4">
        <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl bg-zinc-950">
          {artwork ? (
            <img
              src={artwork}
              alt={getPokemonSpecies(pokemon)}
              className="pointer-events-none h-24 w-24 object-contain"
            />
          ) : (
            <span className="text-3xl text-zinc-700">?</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-xl font-bold">{getPokemonSpecies(pokemon)}</h3>
              {getPokemonForm(pokemon) && (
                <div className="text-sm text-zinc-500">{getPokemonForm(pokemon)}</div>
              )}
            </div>

            <ScoreBadge score={recommendation?.advisorScore ?? 0} />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {recommendation && <Badge>{recommendation.league}</Badge>}
            {pokemon.shiny && <Badge>✨ SHINY</Badge>}
            {pokemon.shadow && <Badge>SHADOW</Badge>}
            {pokemon.lucky && <Badge>LUCKY</Badge>}
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <MiniStat label="CP" value={pokemon.cp ?? "—"} />
        <MiniStat
          label="IV"
          value={pokemon.ivPercent !== null ? `${pokemon.ivPercent.toFixed(1)}%` : "—"}
        />
        <MiniStat
          label="META"
          value={recommendation ? recommendation.entry.score.toFixed(1) : "—"}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {pokemon.cp !== null && pokemon.cp <= 1500 && (
          <SmallBadge>Great eligible</SmallBadge>
        )}
        {pokemon.cp !== null && pokemon.cp <= 2500 && (
          <SmallBadge>Ultra eligible</SmallBadge>
        )}
        <SmallBadge>Master eligible</SmallBadge>
      </div>

      <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Recommended GBL Moves
        </div>

        <div className="mt-1 text-sm text-zinc-400">
          {recommendation
            ? `${recommendation.league} · PvPoke #${recommendation.entry.rank}`
            : "No eligible Open League ranking matched"}
        </div>

        {recommendation && (
          <div className="mt-4 space-y-4">
            <RecommendedMove
              label="FAST"
              move={recommendedFast}
              owned={hasMove(recommendedFast, [pokemon.fastMove])}
              missingText={
                pokemon.fastMove ? `Current: ${pokemon.fastMove}` : "Not recorded"
              }
            />

            <RecommendedMove
              label="CHARGED 1"
              move={recommendedCharged1}
              owned={hasMove(recommendedCharged1, currentCharged)}
              missingText={pokemon.chargedMove ? "Use Charged TM" : "Not recorded"}
            />

            <RecommendedMove
              label="CHARGED 2"
              move={recommendedCharged2}
              owned={hasMove(recommendedCharged2, currentCharged)}
              missingText={
                pokemon.chargedMove2 ? "Use Charged TM" : "Unlock second charged move"
              }
            />
          </div>
        )}

        <div className="mt-5 border-t border-zinc-800 pt-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">
            Your Current Moves
          </div>

          <div className="mt-2 space-y-1 text-sm text-zinc-400">
            <div>
              Fast: <span className="text-white">{pokemon.fastMove || "Unknown"}</span>
            </div>
            <div>
              Charged 1:{" "}
              <span className="text-white">{pokemon.chargedMove || "Unknown"}</span>
            </div>
            <div>
              Charged 2:{" "}
              <span className="text-white">
                {pokemon.chargedMove2 || "Not unlocked / unknown"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 text-sm">
        <span className="text-zinc-500">IVs:</span>{" "}
        <span className="font-mono font-semibold">{formatIVs(pokemon)}</span>
      </div>

      <div className="relative z-50 mt-5 grid grid-cols-4 gap-2 border-t border-zinc-800 pt-4">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            window.dispatchEvent(
              new CustomEvent("pokemon-advisor:open", {
                detail: { pokemonId: pokemon.id },
              })
            );
          }}
          className="cursor-pointer rounded-lg bg-emerald-950 px-2 py-3 text-sm font-semibold text-emerald-300 hover:bg-emerald-900"
        >
          Ask AI
        </button>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleShiny();
          }}
          className={
            pokemon.shiny
              ? "cursor-pointer rounded-lg bg-amber-500 px-2 py-3 text-sm font-bold text-black hover:bg-amber-400"
              : "cursor-pointer rounded-lg bg-zinc-800 px-2 py-3 text-sm text-zinc-200 hover:bg-zinc-700"
          }
        >
          {pokemon.shiny ? "✨ Shiny" : "Shiny"}
        </button>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
          className="cursor-pointer rounded-lg bg-zinc-800 px-2 py-3 text-sm hover:bg-zinc-700"
        >
          Edit
        </button>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          className="cursor-pointer rounded-lg bg-zinc-950 px-2 py-3 text-sm text-red-400 hover:bg-red-950"
        >
          Delete
        </button>
      </div>
    </article>
  );
}

function MovePicker({
  label,
  value,
  placeholder,
  moves,
  eliteMoves,
  disabled,
  onSelect,
}: {
  label: string;
  value: string;
  placeholder: string;
  moves: string[];
  eliteMoves: string[];
  disabled: boolean;
  onSelect: (move: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <div className="mb-2 text-sm text-zinc-400">{label}</div>

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-left disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span className={value ? "font-semibold text-white" : "text-zinc-500"}>
          {value || placeholder}
        </span>
        <span className="text-zinc-500">{open ? "▲" : "▼"}</span>
      </button>

      {open && !disabled && (
        <div className="absolute left-0 right-0 top-full z-[300] mt-2 max-h-64 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950 p-2 shadow-2xl">
          {moves.length === 0 && (
            <div className="px-4 py-3 text-sm text-zinc-500">No moves found.</div>
          )}

          {moves.map((move) => {
            const display = formatMove(move);
            const elite = eliteMoves.includes(move);
            const special = move === "FRUSTRATION" || move === "RETURN";
            const selected = Boolean(value) && sameMove(value, display);

            return (
              <button
                key={move}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onSelect(move);
                  setOpen(false);
                }}
                className={
                  selected
                    ? "flex w-full cursor-pointer items-center justify-between rounded-lg bg-emerald-950 px-4 py-3 text-left text-emerald-300"
                    : "flex w-full cursor-pointer items-center justify-between rounded-lg px-4 py-3 text-left hover:bg-zinc-800"
                }
              >
                <span className="font-semibold">{display}</span>

                <div className="flex items-center gap-2">
                  {elite && (
                    <span className="rounded-full border border-amber-800 bg-amber-950 px-2 py-1 text-[10px] font-bold text-amber-300">
                      ELITE TM
                    </span>
                  )}

                  {special && (
                    <span className="rounded-full border border-purple-800 bg-purple-950 px-2 py-1 text-[10px] font-bold text-purple-300">
                      SPECIAL
                    </span>
                  )}

                  {selected && <span>✓</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RecommendedMove({
  label,
  move,
  owned,
  missingText,
}: {
  label: string;
  move: string;
  owned: boolean;
  missingText: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-[10px] font-bold tracking-wider text-zinc-600">
          {label}
        </div>
        <div className="text-lg font-semibold">{move}</div>
      </div>

      <div
        className={
          owned
            ? "text-xs font-bold text-emerald-400"
            : "max-w-[150px] text-right text-xs font-semibold text-amber-400"
        }
      >
        {owned ? "✓ HAVE IT" : missingText}
      </div>
    </div>
  );
}

function StatusBadge({
  good,
  error,
  children,
}: {
  good: boolean;
  error: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm">
      {good ? (
        <span className="text-emerald-400">● {children} loaded</span>
      ) : error ? (
        <span className="text-red-400">● {error}</span>
      ) : (
        <span className="text-zinc-500">○ Loading {children}...</span>
      )}
    </div>
  );
}

function formatIVs(pokemon: PokemonRecord) {
  if (
    pokemon.attackIV === null ||
    pokemon.defenseIV === null ||
    pokemon.staminaIV === null
  ) {
    return "Unknown";
  }

  return `${pokemon.attackIV}/${pokemon.defenseIV}/${pokemon.staminaIV}`;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="text-sm text-zinc-500">{label}</div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl bg-zinc-950 p-3">
      <div className="text-[10px] font-semibold tracking-wider text-zinc-600">
        {label}
      </div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  let style = "border-zinc-700 bg-zinc-950 text-zinc-400";

  if (score >= 85) {
    style = "border-emerald-700 bg-emerald-950 text-emerald-300";
  } else if (score >= 70) {
    style = "border-blue-800 bg-blue-950 text-blue-300";
  }

  return (
    <div className={`rounded-full border px-3 py-1 text-xs font-bold ${style}`}>
      {score}
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2 py-1 text-[10px] font-bold text-zinc-400">
      {children}
    </span>
  );
}

function SmallBadge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md bg-zinc-950 px-2 py-1 text-[10px] font-semibold text-zinc-500">
      {children}
    </span>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "cursor-pointer rounded-full bg-white px-4 py-2 text-sm font-semibold text-black"
          : "cursor-pointer rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-zinc-400 hover:bg-zinc-800"
      }
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm text-zinc-400">{label}</div>
      {children}
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = "1",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  step?: string;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        min="0"
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input"
      />
    </Field>
  );
}

function IVField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        min="0"
        max="15"
        step="1"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input"
      />
    </Field>
  );
}

function RangeField({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-xs text-zinc-500">
        <span>{label}</span>
        <span className="text-white">{value}</span>
      </div>

      <input
        type="range"
        min="0"
        max={max}
        step="10"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full cursor-pointer accent-emerald-500"
      />
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={
        checked
          ? "cursor-pointer rounded-xl border border-emerald-700 bg-emerald-950 p-4 font-semibold text-emerald-300"
          : "cursor-pointer rounded-xl border border-zinc-700 bg-zinc-950 p-4 text-zinc-400 hover:bg-zinc-800"
      }
    >
      {checked ? "✓ " : ""}
      {label}
    </button>
  );
}
