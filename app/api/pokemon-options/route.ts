import {
    NextResponse,
  } from "next/server";
  
  const SOURCE =
    "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/gamemaster/pokemon.json";
  
  type RawPokemon = {
    dex?: number;
    speciesName?: string;
    speciesId?: string;
  
    fastMoves?: string[];
    chargedMoves?: string[];
    eliteMoves?: string[];
  
    tags?: string[];
  
    released?: boolean;
  };
  
  export async function GET() {
    try {
      const response =
        await fetch(
          SOURCE,
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
  
      const raw:
        RawPokemon[] =
        await response.json();
  
      const pokemon =
        raw
          .filter(
            (entry) =>
              entry.speciesId &&
              entry.speciesName &&
              entry.released !==
                false
          )
          .map(
            (entry) => ({
              dex:
                entry.dex ??
                null,
  
              speciesId:
                entry.speciesId!,
  
              speciesName:
                entry.speciesName!,
  
              fastMoves:
                entry.fastMoves ??
                [],
  
              chargedMoves:
                entry.chargedMoves ??
                [],
  
              eliteMoves:
                entry.eliteMoves ??
                [],
  
              tags:
                entry.tags ??
                [],
            })
          );
  
      return NextResponse.json({
        source:
          "PvPoke GameMaster",
  
        updatedAt:
          new Date()
            .toISOString(),
  
        pokemon,
      });
    } catch (
      error
    ) {
      console.error(
        "Pokemon options error:",
        error
      );
  
      return NextResponse.json(
        {
          error:
            "Could not load Pokémon GO move data.",
        },
        {
          status:
            500,
        }
      );
    }
  }