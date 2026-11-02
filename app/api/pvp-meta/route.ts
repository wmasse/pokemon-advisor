import {
    NextResponse,
  } from "next/server";
  
  type PvPokeRanking = {
    speciesId: string;
    speciesName: string;
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
  
  const BASE =
    "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall";
  
  const SOURCES = {
    great: `${BASE}/rankings-1500.json`,
    ultra: `${BASE}/rankings-2500.json`,
    master: `${BASE}/rankings-10000.json`,
  };
  
  function getMoveset(
    ranking:
      PvPokeRanking
  ) {
    if (
      Array.isArray(
        ranking.moveset
      ) &&
      ranking.moveset.length >
        0
    ) {
      return ranking.moveset.slice(
        0,
        3
      );
    }
  
    const fastMoves = [
      ...(ranking.moves
        ?.fastMoves ??
        []),
    ].sort(
      (
        a,
        b
      ) =>
        b.uses -
        a.uses
    );
  
    const chargedMoves = [
      ...(ranking.moves
        ?.chargedMoves ??
        []),
    ].sort(
      (
        a,
        b
      ) =>
        b.uses -
        a.uses
    );
  
    return [
      fastMoves[0]?.moveId,
      chargedMoves[0]?.moveId,
      chargedMoves[1]?.moveId,
    ].filter(
      (
        value
      ): value is string =>
        Boolean(value)
    );
  }
  
  async function loadLeague(
    url: string
  ) {
    const response =
      await fetch(
        url,
        {
          next: {
            revalidate:
              21600,
          },
        }
      );
  
    if (
      !response.ok
    ) {
      throw new Error(
        `PvPoke request failed: ${response.status}`
      );
    }
  
    const rankings:
      PvPokeRanking[] =
      await response.json();
  
    return rankings.map(
      (
        ranking,
        index
      ) => ({
        speciesId:
          ranking.speciesId,
  
        speciesName:
          ranking.speciesName,
  
        rank:
          index + 1,
  
        score:
          Number(
            ranking.score ??
              0
          ),
  
        moveset:
          getMoveset(
            ranking
          ),
      })
    );
  }
  
  export async function GET() {
    try {
      const [
        great,
        ultra,
        master,
      ] =
        await Promise.all([
          loadLeague(
            SOURCES.great
          ),
  
          loadLeague(
            SOURCES.ultra
          ),
  
          loadLeague(
            SOURCES.master
          ),
        ]);
  
      return NextResponse.json({
        updatedAt:
          new Date()
            .toISOString(),
  
        source:
          "PvPoke",
  
        great,
        ultra,
        master,
      });
    } catch (
      error
    ) {
      console.error(
        "PvPoke metadata error",
        error
      );
  
      return NextResponse.json(
        {
          error:
            "Could not load PvPoke rankings.",
        },
        {
          status:
            500,
        }
      );
    }
  }