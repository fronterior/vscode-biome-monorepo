import * as path from "node:path";
import { Uri, window } from "vscode";
import {
	type DocumentFilter,
	type InitializeParams,
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

		return new BiomeMonorepoLanguageClient(
			"biome-monorepo.lsp",
			"biome-monorepo",
			serverOptions,
			clientOptions,
			this.folders,
		);
	}

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

class BiomeMonorepoLanguageClient extends LanguageClient {
	constructor(
		id: string,
		name: string,
		serverOptions: ServerOptions,
		clientOptions: LanguageClientOptions,
		private biomeWorkspaceFolders: Uri[],
	) {
		super(id, name, serverOptions, clientOptions);
	}

	/**
	 * The Biome LSP proxy server searches for biome.json files
	 * in the workspaceFolders paths provided by VSCode during server initialization.
	 * If only the monorepo root folder is open in VSCode, it skips searching for
	 * biome.json in subdirectories and uses the root configuration instead.
	 * To prevent this, this implementation overrides VSCode's workspaceFolders with paths to
	 * projects that have Biome installed, ensuring each folder's biome.json is used.
	 */
	protected fillInitializeParams(params: InitializeParams): void {
		params.workspaceFolders = this.biomeWorkspaceFolders.map((folder) => ({
			uri: folder.toString(),
			name: path.basename(folder.fsPath),
		}));

		super.fillInitializeParams({
			...params,
		});
	}
}
