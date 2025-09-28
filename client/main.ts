import type { ExtensionContext } from "vscode";
import { commands, languages, window, workspace } from "vscode";
import { Extension } from "./Extension";
import { outputChannel } from "./status";

let isActivated = false;
export function activate(context: ExtensionContext) {
	const enabled = workspace
		.getConfiguration("biome-monorepo", window.activeTextEditor?.document)
		.get("enable", true);

	if (!enabled) {
		return;
	}

	isActivated = true;

	Extension.getInstance(context).start();

	outputChannel.appendLine("🚀 Biome Monorepo extension activated");

	context.subscriptions.push(
		outputChannel,
		commands.registerCommand("biome-monorepo.showOutputChannel", () => {
			outputChannel.show();
		}),
	);
}

export function deactivate(context: ExtensionContext) {}
