import { NotificationType } from "vscode-languageclient";

export const ExitCalled = new NotificationType<[number, string]>(
	"biome-monorepo/exitCalled",
);
