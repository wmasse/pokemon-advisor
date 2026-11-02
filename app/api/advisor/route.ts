import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

/* =========================================================
   TYPES
   ========================================================= */

type AdvisorPokemon = {
  id: string;
  name: string;
  form: string;

  cp: number | null;
  level: number | null;

  attackIV: number | null;
  defenseIV: number | null;
  staminaIV: number | null;

  shiny: boolean;
  shadow: boolean;
  purified: boolean;
  lucky: boolean;
  favorite: boolean;

  fastMove: string;
  chargedMove: string;
  chargedMove2: string;

  notes?: string;
};

type HistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

type RawRanking = {
  speciesId?: string;
  speciesName?: string;
  score?: number;
  moveset?: string[];

  moves?: {
    fastMoves?: {
      moveId: string;
      uses: number;
    }[];

    chargedMoves?: {
      moveId: string;
      uses: number;
    }[];
  };
};

type Ranking = {
  speciesId: string;
  speciesName: string;

  rank: number;
  score: number;

  moveset: string[];
};

/* =========================================================
   PVPoke
   ========================================================= */

const PVP_BASE =
  "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall";

const GREAT_URL =
  `${PVP_BASE}/rankings-1500.json`;

const ULTRA_URL =
  `${PVP_BASE}/rankings-2500.json`;

const MASTER_URL =
  `${PVP_BASE}/rankings-10000.json`;

/* =========================================================
   HELPERS
   ========================================================= */

function normalize(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/é/g, "e")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function getMoveset(
  ranking: RawRanking
): string[] {
  if (
    Array.isArray(ranking.moveset) &&
    ranking.moveset.length > 0
  ) {
    return ranking.moveset.slice(0, 3);
  }

  const fastMoves = [
    ...(ranking.moves?.fastMoves ?? []),
  ].sort(
    (a, b) =>
      b.uses - a.uses
  );

  const chargedMoves = [
    ...(ranking.moves?.chargedMoves ?? []),
  ].sort(
    (a, b) =>
      b.uses - a.uses
  );

  const result: string[] = [];

  if (fastMoves[0]?.moveId) {
    result.push(
      fastMoves[0].moveId
    );
  }

  if (chargedMoves[0]?.moveId) {
    result.push(
      chargedMoves[0].moveId
    );
  }

  if (chargedMoves[1]?.moveId) {
    result.push(
      chargedMoves[1].moveId
    );
  }

  return result;
}

/* =========================================================
   LOAD LEAGUE DATA
   ========================================================= */

async function loadLeague(
  url: string
): Promise<Ranking[]> {
  const response =
    await fetch(url);

  if (!response.ok) {
    throw new Error(
      `PvPoke request failed with HTTP ${response.status}.`
    );
  }

  const raw =
    (await response.json()) as RawRanking[];

  const rankings: Ranking[] = [];

  for (
    let index = 0;
    index < raw.length;
    index++
  ) {
    const ranking =
      raw[index];

    if (
      !ranking.speciesId ||
      !ranking.speciesName
    ) {
      continue;
    }

    rankings.push({
      speciesId:
        ranking.speciesId,

      speciesName:
        ranking.speciesName,

      rank:
        index + 1,

      score:
        Number(
          ranking.score ?? 0
        ),

      moveset:
        getMoveset(ranking),
    });
  }

  return rankings;
}

/* =========================================================
   MATCH ROSTER ENTRY TO PVPoke
   ========================================================= */

function matchScore(
  pokemon: AdvisorPokemon,
  ranking: Ranking
) {
  const pokemonName =
    normalize(
      pokemon.name
    );

  const pokemonForm =
    normalize(
      pokemon.form || ""
    );

  const rankingName =
    normalize(
      ranking.speciesName
    );

  if (
    rankingName === pokemonName
  ) {
    if (
      !pokemonForm ||
      pokemonForm === "normal"
    ) {
      return 100;
    }

    return 70;
  }

  if (
    rankingName.startsWith(
      `${pokemonName} `
    )
  ) {
    if (
      pokemonForm &&
      rankingName.includes(
        pokemonForm
      )
    ) {
      return 110;
    }

    return 80;
  }

  if (
    pokemonForm &&
    rankingName.includes(
      pokemonName
    ) &&
    rankingName.includes(
      pokemonForm
    )
  ) {
    return 90;
  }

  return 0;
}

function findRanking(
  pokemon: AdvisorPokemon,
  rankings: Ranking[]
): Ranking | null {
  let best:
    Ranking | null =
    null;

  let bestScore = 0;

  for (
    const ranking
    of rankings
  ) {
    const score =
      matchScore(
        pokemon,
        ranking
      );

    if (
      score > bestScore
    ) {
      bestScore =
        score;

      best =
        ranking;
    }
  }

  if (
    bestScore < 80
  ) {
    return null;
  }

  return best;
}

function rankingSummary(
  ranking: Ranking | null
) {
  if (!ranking) {
    return null;
  }

  return {
    rank:
      ranking.rank,

    score:
      ranking.score,

    moveset:
      ranking.moveset,
  };
}

/* =========================================================
   ENRICH ONE OWNED POKEMON
   ========================================================= */

function enrichPokemon(
  pokemon: AdvisorPokemon,
  great: Ranking[],
  ultra: Ranking[],
  master: Ranking[]
) {
  /*
    Current CP cannot be lowered, so capped leagues
    are only considered when the current Pokémon fits.
  */

  const greatRanking =
    pokemon.cp !== null &&
    pokemon.cp <= 1500
      ? findRanking(
          pokemon,
          great
        )
      : null;

  const ultraRanking =
    pokemon.cp !== null &&
    pokemon.cp <= 2500
      ? findRanking(
          pokemon,
          ultra
        )
      : null;

  const masterRanking =
    findRanking(
      pokemon,
      master
    );

  let ivs:
    string | null =
    null;

  let ivPercent:
    number | null =
    null;

  if (
    pokemon.attackIV !== null &&
    pokemon.defenseIV !== null &&
    pokemon.staminaIV !== null
  ) {
    ivs =
      `${pokemon.attackIV}/${pokemon.defenseIV}/${pokemon.staminaIV}`;

    ivPercent =
      (
        (
          pokemon.attackIV +
          pokemon.defenseIV +
          pokemon.staminaIV
        ) /
        45
      ) *
      100;
  }

  return {
    id:
      pokemon.id,

    name:
      pokemon.name,

    form:
      pokemon.form || null,

    cp:
      pokemon.cp,

    level:
      pokemon.level,

    ivs,

    ivPercent:
      ivPercent === null
        ? null
        : Number(
            ivPercent.toFixed(1)
          ),

    shiny:
      pokemon.shiny,

    shadow:
      pokemon.shadow,

    purified:
      pokemon.purified,

    lucky:
      pokemon.lucky,

    favorite:
      pokemon.favorite,

    currentMoves: {
      fast:
        pokemon.fastMove || null,

      charged1:
        pokemon.chargedMove || null,

      charged2:
        pokemon.chargedMove2 || null,
    },

    greatLeague:
      rankingSummary(
        greatRanking
      ),

    ultraLeague:
      rankingSummary(
        ultraRanking
      ),

    masterLeague:
      rankingSummary(
        masterRanking
      ),

    notes:
      pokemon.notes || null,
  };
}

/* =========================================================
   ROUTE
   ========================================================= */

export async function POST(
  request: Request
) {
  try {
    /* -----------------------------------------------------
       GEMINI KEY
       ----------------------------------------------------- */

    const apiKey =
      process.env
        .GEMINI_API_KEY
        ?.trim();

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "GEMINI_API_KEY is missing from .env.local. Add it and restart npm run dev.",
        },
        {
          status: 500,
        }
      );
    }

    /* -----------------------------------------------------
       REQUEST
       ----------------------------------------------------- */

    const body =
      await request.json();

    const question =
      typeof body.question ===
        "string"
        ? body.question.trim()
        : "";

    if (!question) {
      return NextResponse.json(
        {
          error:
            "Please enter a question.",
        },
        {
          status: 400,
        }
      );
    }

    /* -----------------------------------------------------
       ROSTER
       ----------------------------------------------------- */

    let roster:
      AdvisorPokemon[] = [];

    if (
      Array.isArray(
        body.roster
      )
    ) {
      roster =
        body.roster as
          AdvisorPokemon[];
    }

    roster =
      roster.slice(
        0,
        1500
      );

    if (
      roster.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Your Pokémon collection is empty.",
        },
        {
          status: 400,
        }
      );
    }

    /* -----------------------------------------------------
       HISTORY
       ----------------------------------------------------- */

    let history:
      HistoryMessage[] = [];

    if (
      Array.isArray(
        body.history
      )
    ) {
      history =
        body.history as
          HistoryMessage[];
    }

    history =
      history.slice(-8);

    const selectedPokemonId =
      typeof body.selectedPokemonId ===
        "string"
        ? body.selectedPokemonId
        : null;

    /* -----------------------------------------------------
       CURRENT PVPoke DATA
       ----------------------------------------------------- */

    const [
      great,
      ultra,
      master,
    ] =
      await Promise.all([
        loadLeague(
          GREAT_URL
        ),

        loadLeague(
          ULTRA_URL
        ),

        loadLeague(
          MASTER_URL
        ),
      ]);

    /* -----------------------------------------------------
       COLLECTION CONTEXT
       ----------------------------------------------------- */

    const collection =
      roster.map(
        (
          pokemon:
            AdvisorPokemon
        ) =>
          enrichPokemon(
            pokemon,
            great,
            ultra,
            master
          )
      );

    let selectedPokemon:
      (typeof collection)[number] |
      null =
      null;

    if (
      selectedPokemonId
    ) {
      for (
        const pokemon
        of collection
      ) {
        if (
          pokemon.id ===
          selectedPokemonId
        ) {
          selectedPokemon =
            pokemon;

          break;
        }
      }
    }

    /* -----------------------------------------------------
       CHAT HISTORY TEXT
       ----------------------------------------------------- */

    let conversation = "";

    for (
      const message
      of history
    ) {
      if (
        message.role ===
        "assistant"
      ) {
        conversation +=
          `ADVISOR: ${message.content}\n\n`;
      } else {
        conversation +=
          `USER: ${message.content}\n\n`;
      }
    }

    /* -----------------------------------------------------
       SYSTEM INSTRUCTIONS
       ----------------------------------------------------- */

    const systemInstruction = `
You are Pokémon Advisor, an expert assistant inside a Pokémon GO collection-management application.

You receive the user's ACTUAL Pokémon collection and current PvPoke Open League information.

Give practical recommendations based on the supplied data.

RULES:

1. Never say the user owns a Pokémon unless it appears in COLLECTION.

2. Great League has a 1500 CP maximum.
Never recommend Great League for an owned Pokémon whose CURRENT CP is above 1500.

3. Ultra League has a 2500 CP maximum.
Never recommend Ultra League for an owned Pokémon whose CURRENT CP is above 2500.

4. Master League has no CP maximum.

5. greatLeague, ultraLeague, and masterLeague contain current PvPoke data supplied by the application.
Prefer this information over remembered meta information.

6. If a league value is null, do not invent a current ranking.

7. ivPercent is ordinary total IV percentage.
It is NOT the exact PvP IV rank or stat-product rank.

8. If IVs are missing, explicitly say they are unknown when they matter.

9. currentMoves contains the moves that this exact owned Pokémon currently knows.

10. The moveset inside each league contains the PvPoke recommended moves.

11. Never recommend removing a recommended attack that the Pokémon already knows.

12. If the Pokémon already owns one of the recommended Charged Attacks, preserve it.

13. Shiny Pokémon have no inherent battle advantage.
The user personally likes shinies, so shiny status may be used as a tiebreaker between otherwise similar investments.

14. Treat Shadow Pokémon carefully.
Never casually recommend purification without explaining the tradeoff.

15. Consider current CP, current moves, IVs, PvPoke ranking, shiny status, Shadow status, and how much work the Pokémon still appears to need.

16. Never invent how much Stardust, Candy, XL Candy, Rare Candy, or TMs the user owns.

17. If the user states resource amounts in their question or conversation, use those values.

18. When asked which Pokémon need move changes, directly compare currentMoves against recommended PvPoke movesets.

19. When asked what to upgrade, give a ranked shortlist with specific reasons.

20. When SELECTED POKEMON exists, words such as "this", "it", and "my Pokémon" normally refer to that exact roster entry.

21. Do not invent exact PvP IV ranks, power-up costs, Candy costs, XL requirements, or Elite TM requirements when the supplied data does not establish them.

22. If information needed for a precise recommendation is missing, explain what information is missing.

23. Prioritize actionable advice over generic Pokémon descriptions.

24. Keep the answer concise unless the user asks for detail.
`;

    /* -----------------------------------------------------
       PROMPT
       ----------------------------------------------------- */

    const prompt = `
SELECTED POKEMON:
${JSON.stringify(
  selectedPokemon,
  null,
  2
)}

COLLECTION:
${JSON.stringify(
  collection
)}

RECENT CONVERSATION:
${conversation || "None"}

USER QUESTION:
${question}
`;

    /* -----------------------------------------------------
       GEMINI
       ----------------------------------------------------- */

    const ai =
      new GoogleGenAI({
        apiKey,
      });

    const model =
      process.env
        .GEMINI_MODEL
        ?.trim() ||
      "gemini-3.8-flash";

    console.log(
      `Gemini Advisor: ${collection.length} Pokémon using ${model}`
    );

    const response =
      await ai.models.generateContent({
        model,

        contents:
          prompt,

        config: {
          systemInstruction,

          maxOutputTokens:
            1600,

          temperature:
            0.4,
        },
      });

    const answer =
      response.text?.trim();

    if (!answer) {
      throw new Error(
        "Gemini returned an empty response."
      );
    }

    return NextResponse.json({
      answer,
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "GEMINI ADVISOR ERROR:",
      error
    );

    let message =
      "The advisor could not answer right now.";

    let status = 500;

    if (
      error instanceof Error &&
      error.message
    ) {
      message =
        error.message;
    }

    if (
      error &&
      typeof error ===
        "object"
    ) {
      const apiError =
        error as {
          status?: number;
          message?: string;
        };

      if (
        typeof apiError.status ===
          "number" &&
        apiError.status >= 400 &&
        apiError.status <= 599
      ) {
        status =
          apiError.status;
      }

      if (
        typeof apiError.message ===
          "string" &&
        apiError.message
      ) {
        message =
          apiError.message;
      }
    }

    return NextResponse.json(
      {
        error:
          message,
      },
      {
        status,
      }
    );
  }
}