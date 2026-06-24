import type { PersonaKey, ScoringVector } from "@/types";

export interface Persona {
  key: PersonaKey;
  label: string;
  description: string;
  scoring: ScoringVector;
}

export const PERSONAS: Record<PersonaKey, Persona> = {
  solo_social: {
    key: "solo_social",
    label: "Solo Social Explorer",
    description: "Traveling alone but here to meet people. Dorms, common areas, late nights.",
    scoring: {
      social: 0.9,
      calm: 0.1,
      scenic: 0.4,
      workation: 0.0,
      adventure: 0.6,
      budget_fit: 0.7,
      room_type_fit: 0.0,
    },
  },

  solo_quiet: {
    key: "solo_quiet",
    label: "Quiet Solo Traveler",
    description: "Solo, but not looking to socialise. Wants peace, nature, and room to think.",
    scoring: {
      social: 0.2,
      calm: 0.9,
      scenic: 0.8,
      workation: 0.2,
      adventure: 0.3,
      budget_fit: 0.5,
      room_type_fit: 0.7,
    },
  },

  friends_getaway: {
    key: "friends_getaway",
    label: "Friends Getaway",
    description:
      "Group of friends, high energy. Shared spaces, group activities, memorable nights.",
    scoring: {
      social: 0.8,
      calm: 0.1,
      scenic: 0.4,
      workation: 0.0,
      adventure: 0.8,
      budget_fit: 0.6,
      room_type_fit: 0.1,
    },
  },

  couple_retreat: {
    key: "couple_retreat",
    label: "Couple Retreat",
    description:
      "Two people, private space is non-negotiable. Scenic, cultural, or just unwinding together.",
    scoring: {
      social: 0.2,
      calm: 0.7,
      scenic: 0.7,
      workation: 0.0,
      adventure: 0.3,
      budget_fit: 0.2,
      room_type_fit: 1.0,
    },
  },

  workation: {
    key: "workation",
    label: "Workation Traveler",
    description:
      "Working remotely and wants a change of scene. Needs wifi, quiet, and a good desk.",
    scoring: {
      social: 0.3,
      calm: 0.8,
      scenic: 0.5,
      workation: 1.0,
      adventure: 0.1,
      budget_fit: 0.2,
      room_type_fit: 0.9,
    },
  },

  budget_backpacker: {
    key: "budget_backpacker",
    label: "Budget Backpacker",
    description:
      "Cost is the constraint. Dorms, flexible on destination and vibe, just wants value.",
    scoring: {
      social: 0.6,
      calm: 0.3,
      scenic: 0.4,
      workation: 0.1,
      adventure: 0.5,
      budget_fit: 1.0,
      room_type_fit: 0.0,
    },
  },
};

export const PERSONA_KEYS = Object.keys(PERSONAS) as PersonaKey[];
