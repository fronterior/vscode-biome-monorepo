type LanguageConfig = {
	ext: string;
	lineComment: string;
	blockComment: [string, string];
};

const languageId2Config: Map<string, LanguageConfig> = new Map([
	["javascript", { ext: "js", lineComment: "//", blockComment: ["/*", "*/"] }],
	[
		"javascriptreact",
		{ ext: "jsx", lineComment: "//", blockComment: ["/*", "*/"] },
	],
	["typescript", { ext: "ts", lineComment: "//", blockComment: ["/*", "*/"] }],
	[
		"typescriptreact",
		{ ext: "tsx", lineComment: "//", blockComment: ["/*", "*/"] },
	],
	["html", { ext: "html", lineComment: "//", blockComment: ["<!--", "-->"] }],
	["vue", { ext: "vue", lineComment: "//", blockComment: ["<!--", "-->"] }],
	[
		"coffeescript",
		{ ext: "coffee", lineComment: "#", blockComment: ["###", "###"] },
	],
	["yaml", { ext: "yaml", lineComment: "#", blockComment: ["#", ""] }],
	["graphql", { ext: "graphql", lineComment: "#", blockComment: ["#", ""] }],
]);

export function getExtension(languageId: string): string | undefined {
	return languageId2Config.get(languageId)?.ext;
}
