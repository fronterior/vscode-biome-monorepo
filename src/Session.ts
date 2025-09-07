import { Uri, window } from "vscode";
import {
	type DocumentFilter,
	LanguageClient,
	type LanguageClientOptions,
	type ServerOptions,
	TransportKind,
} from "vscode-languageclient/node";
import { displayName } from "../package.json";
import { supportedLanguages } from "./constants";
import Logger from "./Logger";

export class Session {
	/**
	 * The language client for this session.
	 */
	private client: LanguageClient | undefined;

	public get biomeVersion(): string | undefined {
		return this.client?.initializeResult?.serverInfo?.version;
	}

	logger = new Logger("Biome Monorepo");

	/**
	 * Creates a new LSP session
	 */
	public constructor(
		public readonly version: string,
		public readonly bin: Uri,
		private readonly folders: Uri[],
	) {}

	/**
	 * Starts the LSP session.
	 */
	public async start() {
		this.client = this.createLanguageClient();
		await this.client.start();
	}

	/**
	 * Stops the LSP session.
	 */
	public async stop() {
		this.logger.debug("Stopping LSP session");

		await this.client?.stop();

		this.logger.debug("LSP session stopped");

		this.client = undefined;
	}

	/**
	 * Creates a new language client for the session.
	 */
	private createLanguageClient(): LanguageClient {
		this.logger.debug(`Creating LSP session with ${this.bin.fsPath}`);

		const serverOptions: ServerOptions = {
			command: this.bin.fsPath,
			transport: TransportKind.stdio,
			args: ["lsp-proxy"],
		};

		const outputChannel = window.createOutputChannel(
			`${displayName} (${this.version})- LSP`,
			{
				log: true,
			},
		);

		const clientOptions: LanguageClientOptions = {
			outputChannel: outputChannel,
			traceOutputChannel: outputChannel,
			documentSelector: this.createDocumentSelector(),
		};

		return new LanguageClient(
			"biome-monorepo.lsp",
			"biome-monorepo",
			serverOptions,
			clientOptions,
		);
	}

	/**
	 * Creates the document selector for the language client.
	 */
	private createDocumentSelector(): DocumentFilter[] {
		const folders = this.folders;
		this.logger.info(`folders ${folders.map((folder) => folder.fsPath)}`);

		return supportedLanguages.flatMap((language) =>
			folders.map((folder) => ({
				language,
				scheme: "file",
				pattern: Uri.joinPath(folder, "**", "*").fsPath.replaceAll("\\", "/"),
			})),
		);
	}
}
