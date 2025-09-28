import {
	type ExtensionContext,
	LanguageStatusItem,
	languages,
	type TextDocument,
	Uri,
	workspace,
} from "vscode";
import {
	CloseAction,
	ConfigurationParams,
	DiagnosticPullMode,
	DidCloseTextDocumentNotification,
	DidOpenTextDocumentNotification,
	DocumentDiagnosticRequest,
	ErrorHandler,
	ExecuteCommandParams,
	ExecuteCommandRequest,
	LanguageClient,
	type LanguageClientOptions,
	NotebookDocumentSyncRegistrationType,
	RevealOutputChannelOn,
	type ServerOptions,
	State,
	TransportKind,
	VersionedTextDocumentIdentifier,
} from "vscode-languageclient/node";
import {
	configFileFilter,
	packageJsonFilter,
	supportedLanguages,
} from "./constans";
import { isSupported } from "./utils";

export class Extension {
	static instance: Extension;

	static getInstance(context?: ExtensionContext) {
		if (!context) {
			throw new Error("Extension context is required");
		}
		Extension.instance ??= new Extension(context);

		return Extension.instance;
	}

	// private logger = new Logger("Biome Monorepo");

	// private sessions: Session[] = [];

	constructor(public context: ExtensionContext) {}

	start() {
		const syncedDocuments = new Map<string, TextDocument>();
		const serverCalledProcessExit: boolean = false;

		const serverModule = Uri.joinPath(
			this.context.extensionUri,
			"server",
			"out",
			"main.js",
		).fsPath;

		const serverOptions: ServerOptions = {
			run: {
				module: serverModule,
				transport: TransportKind.ipc,
				options: { cwd: process.cwd() },
			},
			debug: {
				module: serverModule,
				transport: TransportKind.ipc,
				options: { cwd: process.cwd() },
			},
		};

		const clientOptions: LanguageClientOptions = {
			documentSelector: [{ scheme: "file" }],
			revealOutputChannelOn: RevealOutputChannelOn.Never,
			initializationOptions: {},
			progressOnInitialization: true,
			synchronize: {
				fileEvents: [
					workspace.createFileSystemWatcher(configFileFilter.pattern ?? ""),
					workspace.createFileSystemWatcher(packageJsonFilter.pattern ?? ""),
				],
			},
			initializationFailedHandler: (error) => {
				// logger.error("Server initialization failed.", error);
				return false;
			},
			errorHandler: {
				error: (error, message, count) => {
					return defaultErrorHandler.error(error, message, count);
				},
				closed: () => {
					if (serverCalledProcessExit) {
						return { action: CloseAction.DoNotRestart };
					}
					return defaultErrorHandler.closed();
				},
			},
			diagnosticPullOptions: {
				onChange: true,
				onSave: true,
				onFocus: true,
				filter: (document, mode) => {
					return !isSupported(document);
				},
				onTabs: false,
			},
			middleware: {
				didOpen: async (document, next) => {
					if (
						languages.match(packageJsonFilter, document) ||
						languages.match(configFileFilter, document) ||
						isSupported(document)
					) {
						const result = next(document);
						syncedDocuments.set(document.uri.toString(), document);

						return result;
					}
				},
				didChange: async (event, next) => {
					if (syncedDocuments.has(event.document.uri.toString())) {
						return next(event);
					}
				},
				willSave: async (event, next) => {
					if (syncedDocuments.has(event.document.uri.toString())) {
						return next(event);
					}
				},
				willSaveWaitUntil: (event, next) => {
					if (syncedDocuments.has(event.document.uri.toString())) {
						return next(event);
					} else {
						return Promise.resolve([]);
					}
				},
				didSave: async (document, next) => {
					if (syncedDocuments.has(document.uri.toString())) {
						return next(document);
					}
				},
				didClose: async (document, next) => {
					const uri = document.uri.toString();
					if (syncedDocuments.has(uri)) {
						syncedDocuments.delete(uri);
						return next(document);
					}
				},
				notebooks: {
					didOpen: (notebookDocument, cells, next) => {
						const result = next(notebookDocument, cells);
						for (const cell of cells) {
							syncedDocuments.set(cell.document.uri.toString(), cell.document);
						}
						return result;
					},
					didChange: (event, next) => {
						if (event.cells?.structure?.didOpen !== undefined) {
							for (const open of event.cells.structure.didOpen) {
								syncedDocuments.set(
									open.document.uri.toString(),
									open.document,
								);
							}
						}
						if (event.cells?.structure?.didClose !== undefined) {
							for (const closed of event.cells.structure.didClose) {
								syncedDocuments.delete(closed.document.uri.toString());
							}
						}
						return next(event);
					},
					didClose: (document, cells, next) => {
						for (const cell of cells) {
							const key = cell.document.uri.toString();
							syncedDocuments.delete(key);
						}
						return next(document, cells);
					},
				},
				provideCodeActions: async (
					document,
					range,
					context,
					token,
					next,
				): Promise<(Command | CodeAction)[] | null | undefined> => {
					// if (!syncedDocuments.has(document.uri.toString())) {
					// 	return [];
					// }
					// if (
					// 	context.only !== undefined &&
					// 	!supportedQuickFixKinds.has(context.only.value)
					// ) {
					// 	return [];
					// }
					// if (
					// 	context.only === undefined &&
					// 	(!context.diagnostics || context.diagnostics.length === 0)
					// ) {
					// 	return [];
					// }
					// const eslintDiagnostics: Diagnostic[] = [];
					// for (const diagnostic of context.diagnostics) {
					// 	if (diagnostic.source === "eslint") {
					// 		eslintDiagnostics.push(diagnostic);
					// 	}
					// }
					// if (context.only === undefined && eslintDiagnostics.length === 0) {
					// 	return [];
					// }
					// const newContext: CodeActionContext = Object.assign({}, context, {
					// 	diagnostics: eslintDiagnostics,
					// });
					// const start = Date.now();
					// const result = await next(document, range, newContext, token);
					// if (context.only?.value.startsWith("source.fixAll")) {
					// 	let performanceInfo = performanceStatus.get(document.languageId);
					// 	if (performanceInfo === undefined) {
					// 		performanceInfo = PerformanceStatus.defaultValue;
					// 		performanceStatus.set(document.languageId, performanceInfo);
					// 	} else {
					// 		performanceInfo.firstReport = false;
					// 	}
					// 	performanceInfo.fixTime = Date.now() - start;
					// 	updateStatusBar(document);
					// }
					// return result;

					return [];
				},
				workspace: {
					didChangeWatchedFile: (event, next) => {
						// validator.clear();
						return next(event);
					},
					didChangeConfiguration: async (sections, next) => {
						return next(sections);
					},
					configuration: (params) => {
						// return readConfiguration(params);
						return {};
					},
				},
			},
		};

		// const client: LanguageClient = new LanguageClient(
		// 	"ESLint",
		// 	serverOptions,
		// 	clientOptions,
		// );
		//
		// const defaultErrorHandler: ErrorHandler =
		// 	client.createDefaultErrorHandler();
	}
}
