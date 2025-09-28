import type { DocumentFilter } from "vscode";

export const supportedLanguages: string[] = [
	"astro",
	"css",
	"graphql",
	"grit",
	"html",
	"javascript",
	"javascriptreact",
	"json",
	"jsonc",
	"snippets",
	"svelte",
	"tailwindcss",
	"typescript",
	"typescriptreact",
	"vue",
];

export const packageJsonFilter: DocumentFilter = {
	scheme: "file",
	pattern: "**/package.json",
};

export const configFileFilter: DocumentFilter = {
	scheme: "file",
	pattern: "**/{.biome{.json,.jsonc}}",
};
