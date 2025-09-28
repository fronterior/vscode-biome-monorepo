import path from "node:path";
import {
	type ClientCapabilities,
	CodeAction,
	CodeActionKind,
	Command,
	createConnection,
	Diagnostic,
	DidChangeConfigurationNotification,
	DocumentDiagnosticReportKind,
	type FullDocumentDiagnosticReport,
	Message,
	NotebookDocuments,
	Position,
	ProposedFeatures,
	Range,
	type ResponseMessage,
	type ServerCapabilities,
	TextDocumentEdit,
	TextDocumentSyncKind,
	TextDocuments,
	TextEdit,
	uinteger,
	VersionedTextDocumentIdentifier,
	WorkspaceChange,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

import { URI } from "vscode-uri";
import { getExtension } from "../shared/languages";
import { ExitCalled } from "../shared/messages";
import { getFileSystemPath, getUri } from "./paths";

// The connection to use. Code action requests get removed from the queue if
// canceled.
const connection: ProposedFeatures.Connection = createConnection(
	ProposedFeatures.all,
	{
		connectionStrategy: {
			cancelUndispatched: (message: Message) => {
				// Code actions can safely be cancel on request.
				if (
					Message.isRequest(message) &&
					message.method === "textDocument/codeAction"
				) {
					const response: ResponseMessage = {
						jsonrpc: message.jsonrpc,
						id: message.id,
						result: null,
					};
					return response;
				}
				return undefined;
			},
		},
		maxParallelism: 1,
	},
);

// Set when handling the initialize request.
let clientCapabilities: ClientCapabilities;

const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// The notebooks manager is using the normal document manager for the cell documents.
// So all validating will work out of the box since normal document events will fire.
const notebooks = new NotebookDocuments(documents);

const nodeExit = process.exit;
process.exit = ((code?: number): void => {
	const stack = new Error("stack");
	void connection.sendNotification(ExitCalled, [code ? code : 0, stack.stack]);
	setTimeout(() => {
		nodeExit(code);
	}, 1000);
}) as any;

process.on("uncaughtException", (error: any) => {
	let message: string | undefined;
	if (error) {
		if (typeof error.stack === "string") {
			message = error.stack;
		} else if (typeof error.message === "string") {
			message = error.message;
		} else if (typeof error === "string") {
			message = error;
		}
		if (message === undefined || message.length === 0) {
			try {
				message = JSON.stringify(error, undefined, 4);
			} catch (e) {
				// Should not happen.
			}
		}
	}
	console.error("Uncaught exception received.");
	if (message) {
		console.error(message);
	}
});

/**
 * Infers a file path for a given URI / TextDocument. If the document is a notebook
 * cell document it uses the file path from the notebook with a corresponding
 * extension (e.g. TypeScript -> ts)
 */
function inferFilePath(
	documentOrUri: string | TextDocument | URI | undefined,
): string | undefined {
	if (!documentOrUri) {
		return undefined;
	}
	const uri = getUri(documentOrUri);
	if (uri.scheme === "file") {
		return getFileSystemPath(uri);
	}

	const notebookDocument = notebooks.findNotebookDocumentForCell(
		uri.toString(),
	);
	if (notebookDocument !== undefined) {
		const notebookUri = URI.parse(notebookDocument.uri);
		if (notebookUri.scheme === "file") {
			const filePath = getFileSystemPath(uri);
			if (filePath !== undefined) {
				const textDocument = documents.get(uri.toString());
				if (textDocument !== undefined) {
					const extension = getExtension(textDocument.languageId);
					if (extension !== undefined) {
						const extname = path.extname(filePath);
						if (extname.length === 0 && filePath[0] === ".") {
							return `${filePath}.${extension}`;
						} else if (extname.length > 0 && extname !== extension) {
							return `${filePath.substring(0, filePath.length - extname.length)}.${extension}`;
						}
					}
				}
			}
		}
	}
	return undefined;
}

documents.onDidClose(async (event) => {
	const document = event.document;
	const uri = document.uri;
	// ESLint.removeSettings(uri);
	// SaveRuleConfigs.remove(uri);
	// CodeActions.remove(uri);
	// ESLint.unregisterAsFormatter(document);
});

function environmentChanged() {
	// ESLint.clearSettings();
	// RuleSeverities.clear();
	// SaveRuleConfigs.clear();
	// ESLint.clearFormatters();
	connection.languages.diagnostics.refresh().catch(() => {
		connection.console.error("Failed to refresh diagnostics");
	});
}

namespace CommandIds {
	export const applySingleFix: string = "biome-monorepo.applySingleFix";
	export const applySuggestion: string = "biome-monorepo.applySuggestion";
	export const applySameFixes: string = "biome-monorepo.applySameFixes";
	export const applyAllFixes: string = "biome-monorepo.applyAllFixes";
	export const applyDisableLine: string = "biome-monorepo.applyDisableLine";
	export const applyDisableFile: string = "biome-monorepo.applyDisableFile";
	export const openRuleDoc: string = "biome-monorepo.openRuleDoc";
}

connection.onInitialize((params, _cancel, progress) => {
	progress.begin("Initializing Biome Monorepo Server");
	const syncKind: TextDocumentSyncKind = TextDocumentSyncKind.Incremental;
	clientCapabilities = params.capabilities;
	progress.done();
	const capabilities: ServerCapabilities = {
		textDocumentSync: {
			openClose: true,
			change: syncKind,
			willSaveWaitUntil: false,
			save: {
				includeText: false,
			},
		},
		workspace: {
			workspaceFolders: {
				supported: true,
			},
		},
		executeCommandProvider: {
			commands: [
				CommandIds.applySingleFix,
				CommandIds.applySuggestion,
				CommandIds.applySameFixes,
				CommandIds.applyAllFixes,
				CommandIds.applyDisableLine,
				CommandIds.applyDisableFile,
				CommandIds.openRuleDoc,
			],
		},
		diagnosticProvider: {
			identifier: "biome-monorepo",
			interFileDependencies: false,
			workspaceDiagnostics: false,
		},
	};

	if (
		clientCapabilities.textDocument?.codeAction?.codeActionLiteralSupport
			?.codeActionKind.valueSet !== undefined
	) {
		capabilities.codeActionProvider = {
			codeActionKinds: [
				CodeActionKind.QuickFix,
				`${CodeActionKind.SourceFixAll}.biome-monorepo`,
			],
		};
	}

	return { capabilities };
});

connection.onInitialized(() => {
	if (
		clientCapabilities.workspace?.didChangeConfiguration
			?.dynamicRegistration === true
	) {
		connection.onDidChangeConfiguration((_params) => {
			environmentChanged();
		});
		void connection.client.register(
			DidChangeConfigurationNotification.type,
			undefined,
		);
	}

	if (clientCapabilities.workspace?.workspaceFolders === true) {
		connection.workspace.onDidChangeWorkspaceFolders((_params) => {
			environmentChanged();
		});
	}
});
