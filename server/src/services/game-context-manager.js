const DEFAULT_STATE = () => ({ characters: {}, activeQuests: [], keyNpcs: {}, location: "" });

const stateTools = [{
  type: "function",
  function: {
    name: "update_game_state",
    description: "Persist confirmed game facts only after they occur. Never infer a player character's thoughts, choices, or unreported dice results.",
    parameters: {
      type: "object",
      properties: {
        location: { type: "string", description: "Current confirmed location, if it changed." },
        characterUpdates: {
          type: "array",
          description: "Only confirmed changes. Send deltas/events, never final HP or a complete inventory.",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              hpDelta: { type: "number", description: "Signed HP change after a confirmed result; damage is negative, healing is positive." },
              temporaryHpSet: { type: "number", description: "A confirmed new temporary HP value. Do not stack temporary HP." },
              inventoryAdd: { type: "array", items: { type: "string" } },
              inventoryRemove: { type: "array", items: { type: "string" } },
              conditionsAdd: { type: "array", items: { type: "string" }, description: "Confirmed conditions gained, excluding Exhaustion and Concentration." },
              conditionsRemove: { type: "array", items: { type: "string" }, description: "Confirmed conditions ended." },
              exhaustionDelta: { type: "number", description: "Signed confirmed Exhaustion-level change. Exhaustion is clamped from 0 to 6 by the server." },
              concentrationStart: { type: "string", description: "Spell or effect newly being concentrated on after it has taken effect." },
              concentrationEnd: { type: "boolean", description: "True only when confirmed concentration ends." },
              resourcesSpent: { type: "array", items: { type: "string" }, description: "Named resources spent once each, for example 'Spell Slot Level 1' or 'Rage'." },
              resourcesRecovered: { type: "array", items: { type: "string" }, description: "Named resources recovered once each." },
              resourcesReset: { type: "array", items: { type: "string" }, description: "Named resources fully restored by a confirmed rest or feature." },
              reason: { type: "string", description: "Short confirmed event that caused the change." },
            },
            required: ["name"],
          },
        },
        questAdd: { type: "array", items: { type: "string" }, description: "Confirmed newly active quests." },
        questRemove: { type: "array", items: { type: "string" }, description: "Confirmed resolved or abandoned quests." },
        keyNpcs: { type: "object", additionalProperties: { type: "string" }, description: "NPC name mapped to a short confirmed role or relationship." },
      },
    },
  },
}];

class GameContextManager {
  constructor(campaign, characters, options = {}) {
    this.campaign = campaign;
    this.maxContextTokens = Number(options.maxContextTokens || 28000);
    this.summarizeThreshold = Number(options.summarizeThreshold ?? 0.65);
    this.keepRecentTurns = Number(options.keepRecentTurns || 20);
    const existing = campaign.context?.persistentState || DEFAULT_STATE();
    this.state = { ...DEFAULT_STATE(), ...existing, characters: { ...(existing.characters || {}) }, keyNpcs: { ...(existing.keyNpcs || {}) } };
    for (const character of characters) {
      const current = this.state.characters[character.name] || {};
      this.state.characters[character.name] = {
        hp: character.hitPoints?.current,
        maxHp: character.hitPoints?.maximum,
        temporaryHp: character.hitPoints?.temporary || 0,
        level: character.level,
        inventory: character.inventory?.map((item) => item.name) || [],
        conditions: [],
        exhaustion: 0,
        concentration: null,
        resourcesUsed: {},
        ...current,
      };
    }
    this.knownCharacterNames = new Set(characters.map((character) => character.name));
    this.summary = campaign.context?.rollingSummary || campaign.campaignState || "";
    this.summarizedMessageCount = campaign.context?.summarizedMessageCount || 0;
  }

  stateBlock() { return `[PERSISTENT GAME STATE — confirmed facts only; do not narrate this block verbatim]\n${JSON.stringify(this.state)}`; }
  summaryBlock() { return this.summary ? `[ROLLING SUMMARY OF EARLIER EVENTS]\n${this.summary}` : null; }

  buildMessages(systemPrompt, recentMessages, userMessage) {
    return [
      { role: "system", content: systemPrompt },
      { role: "system", content: this.stateBlock() },
      ...(this.summaryBlock() ? [{ role: "system", content: this.summaryBlock() }] : []),
      ...recentMessages.map((item) => ({ role: item.role === "player" ? "user" : "assistant", content: item.content })),
      { role: "user", content: userMessage },
    ];
  }

  applyStateUpdate(update = {}) {
    if (typeof update.location === "string" && update.location.trim()) this.state.location = update.location.trim();
    const cleanList = (items) => Array.isArray(items) ? items.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()) : [];
    const questAdd = cleanList(update.questAdd);
    const questRemove = new Set(cleanList(update.questRemove));
    if (questAdd.length || questRemove.size) {
      this.state.activeQuests = [...new Set([...this.state.activeQuests.filter((quest) => !questRemove.has(quest)), ...questAdd])].slice(0, 30);
    }
    if (update.keyNpcs && typeof update.keyNpcs === "object") this.state.keyNpcs = { ...this.state.keyNpcs, ...update.keyNpcs };
    for (const change of update.characterUpdates || []) {
      const name = typeof change?.name === "string" ? change.name.trim() : "";
      if (!name || !this.knownCharacterNames.has(name)) continue;
      const current = this.state.characters[name];
      const maxHp = Math.max(0, Number(current.maxHp) || 0);
      const currentHp = Math.max(0, Math.min(maxHp, Number(current.hp) || 0));
      const hpDelta = Number(change.hpDelta);
      const nextHp = Number.isFinite(hpDelta) ? Math.max(0, Math.min(maxHp, currentHp + hpDelta)) : currentHp;
      const temporaryHpSet = Number(change.temporaryHpSet);
      const inventory = [...(Array.isArray(current.inventory) ? current.inventory : [])];
      for (const item of cleanList(change.inventoryRemove)) {
        const index = inventory.findIndex((stored) => stored.toLowerCase() === item.toLowerCase());
        if (index >= 0) inventory.splice(index, 1);
      }
      inventory.push(...cleanList(change.inventoryAdd));
      const conditions = new Set(cleanList(current.conditions));
      for (const condition of cleanList(change.conditionsRemove)) conditions.delete(condition);
      for (const condition of cleanList(change.conditionsAdd)) conditions.add(condition);
      const exhaustionDelta = Number(change.exhaustionDelta);
      const exhaustion = Number.isFinite(exhaustionDelta)
        ? Math.max(0, Math.min(6, (Number(current.exhaustion) || 0) + exhaustionDelta))
        : Math.max(0, Math.min(6, Number(current.exhaustion) || 0));
      const resourcesUsed = { ...(current.resourcesUsed || {}) };
      for (const resource of cleanList(change.resourcesSpent)) resourcesUsed[resource] = Math.max(0, (Number(resourcesUsed[resource]) || 0) + 1);
      for (const resource of cleanList(change.resourcesRecovered)) resourcesUsed[resource] = Math.max(0, (Number(resourcesUsed[resource]) || 0) - 1);
      for (const resource of cleanList(change.resourcesReset)) resourcesUsed[resource] = 0;
      this.state.characters[name] = {
        ...current,
        hp: nextHp,
        temporaryHp: Number.isFinite(temporaryHpSet) ? Math.max(0, temporaryHpSet) : Math.max(0, Number(current.temporaryHp) || 0),
        inventory: inventory.slice(0, 100),
        conditions: [...conditions].slice(0, 30),
        exhaustion,
        concentration: change.concentrationEnd === true ? null : (typeof change.concentrationStart === "string" && change.concentrationStart.trim() ? change.concentrationStart.trim() : current.concentration || null),
        resourcesUsed,
      };
    }
  }

  async persistUsage(usage) {
    const promptTokens = Number(usage?.prompt_tokens || 0);
    this.campaign.context = this.campaign.context || {};
    this.campaign.context.persistentState = this.state;
    this.campaign.context.rollingSummary = this.summary;
    this.campaign.context.summarizedMessageCount = this.summarizedMessageCount;
    this.campaign.context.lastPromptTokens = promptTokens;
    this.campaign.context.lastContextRatio = promptTokens / this.maxContextTokens;
    this.campaign.markModified("context");
    await this.campaign.save();
    return promptTokens / this.maxContextTokens;
  }

  async summarizeIfNeeded(allMessages, usage, summarize) {
    const ratio = Number(usage?.prompt_tokens || 0) / this.maxContextTokens;
    const pending = allMessages.slice(this.summarizedMessageCount);
    if (ratio < this.summarizeThreshold || pending.length <= this.keepRecentTurns) return false;
    const toSummarize = pending.slice(0, pending.length - this.keepRecentTurns);
    const transcript = toSummarize.map((item) => `${item.role === "player" ? "PLAYER" : "DM"}: ${item.content}`).join("\n");
    this.summary = await summarize(`Existing rolling summary:\n${this.summary || "(none)"}\n\nNew events to merge:\n${transcript}\n\nWrite one concise Thai-English RPG summary. Preserve only confirmed locations, NPCs, unresolved quests, combat outcomes, active conditions, concentration, spent or restored resources, and consequences. Never invent player feelings, thoughts, or choices. Maximum 220 words.`);
    this.summarizedMessageCount += toSummarize.length;
    this.campaign.context.rollingSummary = this.summary;
    this.campaign.context.summarizedMessageCount = this.summarizedMessageCount;
    this.campaign.markModified("context");
    await this.campaign.save();
    return true;
  }
}

module.exports = { GameContextManager, stateTools };
