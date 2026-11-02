export type MetaProfile = {
    great?: number;
    ultra?: number;
    master?: number;
    raid?: number;
    notes?: string[];
  };
  
  function normalize(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/é/g, "e")
      .replace(/[.'’:]/g, "")
      .replace(/\s+/g, "-");
  }
  
  export function buildMetaKey(
    name: string,
    form?: string
  ) {
    const base = normalize(name);
    const formKey = normalize(form || "");
  
    if (formKey.includes("alolan")) {
      return `alolan-${base}`;
    }
  
    if (formKey.includes("galarian")) {
      return `galarian-${base}`;
    }
  
    if (formKey.includes("hisuian")) {
      return `hisuian-${base}`;
    }
  
    if (formKey.includes("paldean")) {
      return `paldean-${base}`;
    }
  
    return base;
  }
  
  export const META: Record<
    string,
    MetaProfile
  > = {
    azumarill: {
      great: 96,
      notes: ["Top Great League bulky Water/Fairy option"],
    },
    clodsire: {
      great: 97,
      notes: ["Excellent Great League meta pick"],
    },
    lanturn: {
      great: 95,
      notes: ["Excellent Great League generalist"],
    },
    carbink: {
      great: 94,
      notes: ["Bulky Great League staple"],
    },
    feraligatr: {
      great: 93,
      ultra: 91,
      notes: ["Very strong in both Great and Ultra League"],
    },
    mandibuzz: {
      great: 90,
      ultra: 94,
      notes: ["Extremely useful bulky flier/dark type"],
    },
    dunsparce: {
      great: 92,
      notes: ["High-value Great League safe option"],
    },
    morpeko: {
      great: 91,
      notes: ["High-pressure Great League pick"],
    },
    "galarian-stunfisk": {
      great: 92,
      notes: ["Classic Great League steel/ground core piece"],
    },
    gastrodon: {
      great: 89,
      notes: ["Useful anti-electric / anti-steel Great League pick"],
    },
    jumpluff: {
      great: 88,
      notes: ["Bulky Great League grass/flying option"],
    },
    ariados: {
      great: 86,
      notes: ["Useful Great League specialist pick"],
    },
    drapion: {
      great: 87,
      ultra: 90,
      notes: ["Flexible and useful in multiple leagues"],
    },
    annihilape: {
      great: 95,
      ultra: 96,
      notes: ["Very high-priority league Pokémon"],
    },
    sableye: {
      great: 90,
      notes: ["Premium Great League option"],
    },
    "alolan-ninetales": {
      great: 94,
      ultra: 83,
      notes: ["Top Great League ice/fairy threat"],
    },
    talonflame: {
      great: 88,
      ultra: 92,
      notes: ["Excellent in Ultra League and still relevant in Great"],
    },
    poliwrath: {
      great: 92,
      ultra: 93,
      notes: ["Very strong flexible fighter"],
    },
    gligar: {
      great: 91,
      notes: ["Top-tier Great League pick"],
    },
    toxapex: {
      great: 88,
      notes: ["Bulky poison/water Great League specialist"],
    },
    whimsicott: {
      great: 87,
      notes: ["Useful fairy/grass Great League Pokémon"],
    },
    malamar: {
      great: 86,
      ultra: 84,
      notes: ["Interesting anti-meta option"],
    },
    umbreon: {
      ultra: 95,
      notes: ["Top Ultra League bulky dark type"],
    },
    cobalion: {
      ultra: 95,
      notes: ["Top Ultra League steel/fighting option"],
    },
    giratina: {
      ultra: 96,
      notes: ["Very high-value Ultra League legendary"],
    },
    registeel: {
      great: 90,
      ultra: 94,
      notes: ["Classic high-value steel wall"],
    },
    virizion: {
      ultra: 92,
      notes: ["Great Ultra League grass/fighting option"],
    },
    pidgeot: {
      ultra: 92,
      great: 84,
      notes: ["Very solid Ultra League flier"],
    },
    skeledirge: {
      ultra: 90,
      great: 82,
      notes: ["Useful fire/ghost league option"],
    },
    swampert: {
      great: 88,
      ultra: 92,
      raid: 72,
      notes: ["Reliable PvP water/ground threat"],
    },
    medicham: {
      great: 93,
      notes: ["Still a strong Great League investment"],
    },
    quagsire: {
      great: 90,
      notes: ["Very useful Great League ground/water"],
    },
    charjabug: {
      great: 88,
      notes: ["Good Great League electric bug"],
    },
    diggersby: {
      great: 89,
      ultra: 80,
      notes: ["Useful bulky league pick"],
    },
    lickitung: {
      great: 92,
      notes: ["Premium Great League investment"],
    },
    dragonair: {
      great: 88,
      notes: ["Good Great League dragon"],
    },
    dragonite: {
      ultra: 86,
      master: 89,
      raid: 90,
      notes: ["Useful in PvP and PvE"],
    },
    garchomp: {
      master: 92,
      raid: 96,
      notes: ["Excellent Master League and raid investment"],
    },
    metagross: {
      master: 92,
      raid: 97,
      notes: ["Top steel attacker and strong ML pick"],
    },
    excadrill: {
      master: 90,
      raid: 92,
      notes: ["High-value ground/steel investment"],
    },
    dialga: {
      master: 98,
      notes: ["Top Master League legendary"],
    },
    palkia: {
      master: 97,
      notes: ["Top Master League legendary"],
    },
    zygarde: {
      master: 98,
      notes: ["Top Master League investment"],
    },
    mewtwo: {
      master: 95,
      raid: 97,
      notes: ["Extremely high-value attacker and ML pick"],
    },
    groudon: {
      master: 95,
      raid: 98,
      notes: ["Elite ground attacker and Master League option"],
    },
    kyogre: {
      master: 95,
      raid: 98,
      notes: ["Elite water attacker and Master League option"],
    },
    rhyperior: {
      master: 84,
      raid: 94,
      notes: ["Strong raid rock/ground investment"],
    },
    salamence: {
      master: 83,
      raid: 94,
      notes: ["Strong raid dragon attacker"],
    },
    tyranitar: {
      master: 82,
      raid: 93,
      notes: ["Strong dark/rock raid investment"],
    },
    "shadow-mewtwo": {
      raid: 100,
      master: 97,
      notes: ["One of the best possible raid investments in the game"],
    },
    "shadow-metagross": {
      raid: 99,
      master: 93,
      notes: ["Outstanding steel attacker"],
    },
    "shadow-garchomp": {
      raid: 98,
      master: 93,
      notes: ["Top-tier raid attacker"],
    },
  };
  
  export function getMetaProfile(
    name: string,
    form?: string,
    shadow?: boolean
  ) {
    const key = buildMetaKey(name, form);
  
    if (shadow) {
      const shadowKey = `shadow-${key}`;
      if (META[shadowKey]) {
        return META[shadowKey];
      }
    }
  
    return META[key] || null;
  }