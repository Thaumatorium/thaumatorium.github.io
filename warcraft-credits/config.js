/**
 * @const {Object<string, string>}
 */
export const gameTitleMap = {
	"wc1_ovh.json": "Warcraft 1: Orcs vs Humans",
	"wc2_btdp.json": "Warcraft 2: Beyond the Dark Portal",
	"wc2_tod.json": "Warcraft 2: Tides of Darkness",
	"wc3_roc.json": "Warcraft 3: Reign of Chaos",
	"wc3_tft.json": "Warcraft 3: The Frozen Throne",
	"wow_0.json": "WoW  (Vanilla)",
	"wow_1_tbc.json": "WoW: The Burning Crusade",
	"wow_2_wotlk.json": "WoW: Wrath of the Lich King",
	"wow_3_cata.json": "WoW: Cataclysm",
	"wow_4_mop.json": "WoW: Mists of Pandaria",
	"wow_5_wod.json": "WoW: Warlords of Draenor",
	"wow_6_legion.json": "WoW: Legion",
	"wow_7_bfa.json": "WoW: Battle for Azeroth",
	"wow_8_shadowlands.json": "WoW: Shadowlands",
	"wow_9_dragonflight.json": "WoW: Dragonflight",
};

export const NODE_TYPE_PERSON = "person";
export const NODE_TYPE_GAME = "game";

export const LINK_TYPE_WORKED_ON = "worked_on";

export const CATEGORY_GAME = "game";
export const CATEGORY_SINGLE_GAME = "single_game";
export const CATEGORY_BOTH = "both";
export const CATEGORY_GAME1_ONLY = "game1_only";
export const CATEGORY_GAME2_ONLY = "game2_only";
export const CATEGORY_OTHER = "other";

export const DEFAULT_ROLE = "Contributor";
export const DEFAULT_ROLE_COLOR = "#95a5a6";

/**
 * @const {Object<string, string>} Map of normalized role names to hex colors.
 * Lowercase keys are recommended for easier lookup.
 */
export const ROLE_COLORS = {
	producer: "#f1c40f",
	"associate producer": "#f39c12",
	"executive producer": "#e67e22",
	"project lead": "#d35400",
	director: "#e74c3c",
	"production director": "#c0392b",
	president: "#8e44ad",
	"vice president": "#9b59b6",
	ceo: "#8e44ad",

	"game designer": "#3498db",
	"lead game designer": "#2980b9",
	"level designer": "#5dade2",
	"quest designer": "#aed6f1",
	"systems designer": "#1abc9c",
	"content designer": "#16a085",
	"narrative designer": "#48c9b0",
	writer: "#45b39d",

	artist: "#2ecc71",
	"lead artist": "#27ae60",
	"art director": "#1f8b4c",
	"concept artist": "#7fecad",
	"3d artist": "#2ecc71",
	"environment artist": "#52be80",
	"character artist": "#7fecad",
	animator: "#82e0aa",
	"technical artist": "#f1c40f",
	"cinematic artist": "#af7ac5",
	"ui artist": "#5dade2",

	programmer: "#34495e",
	"lead programmer": "#2c3e50",
	"senior programmer": "#34495e",
	"software engineer": "#34495e",
	"lead engineer": "#2c3e50",
	"engine programmer": "#5d6d7e",
	"tools programmer": "#85929e",
	"network programmer": "#5d6d7e",
	"server programmer": "#5d6d7e",
	"ui programmer": "#85929e",

	"sound designer": "#e74c3c",
	"audio director": "#c0392b",
	composer: "#ec7063",
	"voice actor": "#f5b7b1",
	voices: "#f5b7b1",
	"voice director": "#c0392b",
	"music & sound": "#ec7063",

	"quality assurance": "#f39c12",
	"qa lead": "#e67e22",
	tester: "#f5cba7",

	localization: "#7f8c8d",
	marketing: "#bdc3c7",
	sales: "#bdc3c7",
	"public relations": "#bdc3c7",
	"community manager": "#95a5a6",
	"customer support": "#aab7b8",
	"it support": "#7f8c8d",
	"web designer": "#5dade2",
	"manual design & layout": "#aed6f1",
	"manual illustrations": "#7fecad",
	"special thanks": "#ecf0f1",
	support: "#b0bec5",
	"registered beta testers": "#bdc3c7",

	[DEFAULT_ROLE.toLowerCase()]: DEFAULT_ROLE_COLOR,
};
