import { type TextDocument, workspace } from "vscode";
import { supportedLanguages } from "./constans";

export class Validator {
	isSupported(textDocument: TextDocument) {
		const config = workspace.getConfiguration(
			"biome-monorepo",
			textDocument.uri,
		);

		if (!config.get<boolean>("enable", true)) {
			return false;
		}

		return supportedLanguages.includes(textDocument.languageId);
	}
}
