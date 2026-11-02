"use client";

import {
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  loadRoster,
  PokemonRecord,
} from "@/lib/pokemon";

/* =========================================================
   TYPES
   ========================================================= */

type Message = {
  role:
    | "user"
    | "assistant";

  content:
    string;
};

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

  notes: string;
};

/* =========================================================
   HELPERS
   ========================================================= */

function normalize(
  value:
    string
) {
  return value
    .toLowerCase()
    .trim()
    .replace(
      /é/g,
      "e"
    )
    .replace(
      /[^a-z0-9]+/g,
      " "
    )
    .trim()
    .replace(
      /\s+/g,
      " "
    );
}

function getPokemonSpecies(
  pokemon:
    PokemonRecord
) {
  for (
    const [
      key,
      value,
    ] of Object.entries(
      pokemon.raw ??
        {}
    )
  ) {
    const normalizedKey =
      normalize(
        key
      ).replace(
        /\s/g,
        ""
      );

    if (
      normalizedKey ===
        "pokemon" ||
      normalizedKey ===
        "species" ||
      normalizedKey ===
        "pokemonname"
    ) {
      if (
        typeof value ===
          "string" &&
        value.trim()
      ) {
        return value.trim();
      }
    }
  }

  return pokemon.name;
}

function getPokemonForm(
  pokemon:
    PokemonRecord
) {
  if (
    pokemon.form
  ) {
    return pokemon.form;
  }

  for (
    const [
      key,
      value,
    ] of Object.entries(
      pokemon.raw ??
        {}
    )
  ) {
    if (
      normalize(
        key
      ) ===
        "form" &&
      typeof value ===
        "string"
    ) {
      return value.trim();
    }
  }

  return "";
}

function compactRoster():
  AdvisorPokemon[] {
  return loadRoster().map(
    (
      pokemon
    ) => ({
      id:
        pokemon.id,

      name:
        getPokemonSpecies(
          pokemon
        ),

      form:
        getPokemonForm(
          pokemon
        ),

      cp:
        pokemon.cp,

      level:
        pokemon.level,

      attackIV:
        pokemon.attackIV,

      defenseIV:
        pokemon.defenseIV,

      staminaIV:
        pokemon.staminaIV,

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

      fastMove:
        pokemon.fastMove,

      chargedMove:
        pokemon.chargedMove,

      chargedMove2:
        pokemon.chargedMove2,

      notes:
        pokemon.notes,
    })
  );
}

/* =========================================================
   COMPONENT
   ========================================================= */

export default function AdvisorDrawer() {
  const [
    open,
    setOpen,
  ] =
    useState(
      false
    );

  const [
    input,
    setInput,
  ] =
    useState(
      ""
    );

  const [
    messages,
    setMessages,
  ] =
    useState<
      Message[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(
      false
    );

  const [
    error,
    setError,
  ] =
    useState(
      ""
    );

  const [
    selectedPokemonId,
    setSelectedPokemonId,
  ] =
    useState<
      string | null
    >(
      null
    );

  const [
    selectedPokemon,
    setSelectedPokemon,
  ] =
    useState<
      AdvisorPokemon | null
    >(
      null
    );

  const bottomRef =
    useRef<
      HTMLDivElement | null
    >(
      null
    );

  /* =======================================================
     CARD -> ADVISOR EVENT
     ======================================================= */

  useEffect(
    () => {
      function handleOpen(
        event:
          Event
      ) {
        const custom =
          event as
            CustomEvent<{
              pokemonId?:
                string;
            }>;

        const id =
          custom.detail
            ?.pokemonId ??
          null;

        setSelectedPokemonId(
          id
        );

        const roster =
          compactRoster();

        setSelectedPokemon(
          id
            ? roster.find(
                (
                  pokemon
                ) =>
                  pokemon.id ===
                  id
              ) ??
              null
            : null
        );

        setOpen(
          true
        );
      }

      window.addEventListener(
        "pokemon-advisor:open",
        handleOpen
      );

      return () => {
        window.removeEventListener(
          "pokemon-advisor:open",
          handleOpen
        );
      };
    },
    []
  );

  /* =======================================================
     AUTO SCROLL
     ======================================================= */

  useEffect(
    () => {
      bottomRef.current
        ?.scrollIntoView({
          behavior:
            "smooth",
        });
    },
    [
      messages,
      loading,
    ]
  );

  /* =======================================================
     ASK
     ======================================================= */

  async function ask(
    question:
      string
  ) {
    const clean =
      question.trim();

    if (
      !clean ||
      loading
    ) {
      return;
    }

    setError(
      ""
    );

    const userMessage:
      Message = {
      role:
        "user",

      content:
        clean,
    };

    const previousMessages =
      messages;

    setMessages([
      ...previousMessages,
      userMessage,
    ]);

    setInput(
      ""
    );

    setLoading(
      true
    );

    try {
      /*
        Always reload from localStorage immediately
        before asking so the AI sees the latest edits.
      */
      const roster =
        compactRoster();

      const response =
        await fetch(
          "/api/advisor",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                question:
                  clean,

                roster,

                selectedPokemonId,

                history:
                  previousMessages.slice(
                    -10
                  ),
              }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
            "Advisor request failed."
        );
      }

      setMessages(
        (
          current
        ) => [
          ...current,

          {
            role:
              "assistant",

            content:
              data.answer,
          },
        ]
      );
    } catch (
      requestError
    ) {
      const message =
        requestError instanceof
        Error
          ? requestError.message
          : "Advisor request failed.";

      setError(
        message
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  function handleKeyDown(
    event:
      KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (
      event.key ===
        "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      void ask(
        input
      );
    }
  }

  function clearSelectedPokemon() {
    setSelectedPokemonId(
      null
    );

    setSelectedPokemon(
      null
    );
  }

  function newChat() {
    setMessages(
      []
    );

    setError(
      ""
    );

    clearSelectedPokemon();
  }

  /* =======================================================
     UI
     ======================================================= */

  return (
    <>

      {/* FLOATING BUTTON */}

      <button
        type="button"
        onClick={() => {
          const roster =
            compactRoster();

          setSelectedPokemonId(
            null
          );

          setSelectedPokemon(
            null
          );

          if (
            roster.length >
            0
          ) {
            setOpen(
              true
            );
          } else {
            setOpen(
              true
            );
          }
        }}
        className="fixed bottom-6 right-6 z-[350] rounded-full border border-emerald-700 bg-emerald-500 px-5 py-4 font-bold text-black shadow-2xl transition hover:bg-emerald-400"
      >
        ✨ Ask Advisor
      </button>

      {/* BACKDROP */}

      {open && (

        <button
          type="button"
          aria-label="Close advisor"
          onClick={() =>
            setOpen(
              false
            )
          }
          className="fixed inset-0 z-[390] cursor-default bg-black/50"
        />

      )}

      {/* DRAWER */}

      <aside
        className={
          open
            ? "fixed bottom-0 right-0 top-0 z-[400] flex w-full translate-x-0 flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl transition-transform duration-200 sm:max-w-xl"
            : "fixed bottom-0 right-0 top-0 z-[400] flex w-full translate-x-full flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl transition-transform duration-200 sm:max-w-xl"
        }
      >

        {/* HEADER */}

        <header className="border-b border-zinc-800 p-5">

          <div className="flex items-center justify-between gap-4">

            <div>

              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
                Pokémon Advisor AI
              </div>

              <h2 className="mt-1 text-xl font-bold text-white">
                Ask about your collection
              </h2>

            </div>

            <div className="flex gap-2">

              <button
                type="button"
                onClick={
                  newChat
                }
                className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-400 hover:bg-zinc-800"
              >
                New Chat
              </button>

              <button
                type="button"
                onClick={() =>
                  setOpen(
                    false
                  )
                }
                className="rounded-lg bg-zinc-900 px-3 py-2 text-zinc-300 hover:bg-zinc-800"
              >
                ✕
              </button>

            </div>

          </div>

          {/* SELECTED POKEMON */}

          {selectedPokemon && (

            <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-900 bg-emerald-950/30 px-4 py-3">

              <div>

                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                  Talking about
                </div>

                <div className="mt-1 font-semibold text-white">
                  {selectedPokemon.name}

                  {selectedPokemon.form
                    ? ` (${selectedPokemon.form})`
                    : ""}

                  {selectedPokemon.cp !==
                  null
                    ? ` · ${selectedPokemon.cp} CP`
                    : ""}
                </div>

              </div>

              <button
                type="button"
                onClick={
                  clearSelectedPokemon
                }
                className="text-sm text-zinc-500 hover:text-white"
              >
                Clear
              </button>

            </div>

          )}

        </header>

        {/* MESSAGES */}

        <div className="flex-1 overflow-y-auto p-5">

          {messages.length ===
            0 && (

            <div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">

                <div className="font-semibold text-white">
                  I can analyze the Pokémon actually in your collection.
                </div>

                <div className="mt-2 text-sm leading-6 text-zinc-400">
                  I receive CP, IVs, current moves, shiny/shadow status and current PvPoke rankings when you ask a question.
                </div>

              </div>

              <div className="mt-5">

                <div className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-600">
                  Try asking
                </div>

                <div className="space-y-2">

                  <SuggestionButton
                    onClick={() =>
                      void ask(
                        "What are the 5 Pokémon in my collection I should invest in first?"
                      )
                    }
                  >
                    What should I upgrade first?
                  </SuggestionButton>

                  <SuggestionButton
                    onClick={() =>
                      void ask(
                        "Build me the strongest Great League team you can from my current collection."
                      )
                    }
                  >
                    Build my Great League team
                  </SuggestionButton>

                  <SuggestionButton
                    onClick={() =>
                      void ask(
                        "Which of my shiny Pokémon are actually good investments?"
                      )
                    }
                  >
                    Which shinies are worth building?
                  </SuggestionButton>

                  <SuggestionButton
                    onClick={() =>
                      void ask(
                        "Which Pokémon in my collection most need a move change?"
                      )
                    }
                  >
                    Which moves should I fix?
                  </SuggestionButton>

                </div>

              </div>

            </div>

          )}

          <div className="space-y-4">

            {messages.map(
              (
                message,
                index
              ) => (

                <div
                  key={
                    index
                  }
                  className={
                    message.role ===
                    "user"
                      ? "ml-10 rounded-2xl rounded-br-md bg-emerald-600 p-4 text-sm leading-6 text-white"
                      : "mr-5 rounded-2xl rounded-bl-md border border-zinc-800 bg-zinc-900 p-4 text-sm leading-6 text-zinc-200"
                  }
                >
                  <div className="whitespace-pre-wrap">
                    {message.content}
                  </div>
                </div>

              )
            )}

            {loading && (

              <div className="mr-16 rounded-2xl rounded-bl-md border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">
                Analyzing your collection...
              </div>

            )}

            {error && (

              <div className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
                {error}
              </div>

            )}

            <div
              ref={
                bottomRef
              }
            />

          </div>

        </div>

        {/* INPUT */}

        <footer className="border-t border-zinc-800 bg-zinc-950 p-4">

          <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-3 focus-within:border-emerald-600">

            <textarea
              value={
                input
              }
              onChange={(
                event
              ) =>
                setInput(
                  event.target.value
                )
              }
              onKeyDown={
                handleKeyDown
              }
              rows={
                3
              }
              placeholder={
                selectedPokemon
                  ? `Ask about ${selectedPokemon.name}...`
                  : "Ask about your collection..."
              }
              className="w-full resize-none bg-transparent px-2 py-1 text-sm text-white outline-none placeholder:text-zinc-600"
            />

            <div className="mt-2 flex items-center justify-between">

              <div className="text-[10px] text-zinc-600">
                Enter to send · Shift+Enter for new line
              </div>

              <button
                type="button"
                disabled={
                  loading ||
                  !input.trim()
                }
                onClick={() =>
                  void ask(
                    input
                  )
                }
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Send
              </button>

            </div>

          </div>

        </footer>

      </aside>

    </>
  );
}

/* =========================================================
   SMALL COMPONENT
   ========================================================= */

function SuggestionButton({
  children,
  onClick,
}: {
  children:
    React.ReactNode;

  onClick:
    () => void;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className="block w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-left text-sm text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800"
    >
      {children}
    </button>
  );
}