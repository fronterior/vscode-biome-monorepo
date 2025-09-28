import {
	type LanguageStatusItem,
	languages,
	type OutputChannel,
	window,
} from "vscode";
import { supportedLanguages } from "./constans";

export const outputChannel: OutputChannel =
	window.createOutputChannel("Biome Monorepo");

const languageStatus: LanguageStatusItem = languages.createLanguageStatusItem(
	"biome-monorepo.languageStatusItem",
	supportedLanguages,
);

languageStatus.name = "Biome";
languageStatus.text = "Biome";
languageStatus.command = {
	title: "Open Biome Monorepo Output",
	command: "biome-monorepo.showOutputChannel",
};
