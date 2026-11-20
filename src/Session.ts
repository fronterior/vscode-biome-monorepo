import * as path from 'node:path';
import { type LogOutputChannel, Uri, window } from 'vscode';
import {
	type DocumentFilter,
	type InitializeParams,
	LanguageClient,
	type LanguageClientOptions,
	type ServerOptions,
	TransportKind,
} from 'vscode-languageclient/node';
import { displayName } from '../package.json';
import { supportedLanguages } from './constants';
import { Logger } from './Logger';

/**
 * How long to wait for the server to acknowledge shutdown.
 */
const STOP_TIMEOUT_MS = 2000;

/**
 * Pending starts by Biome version.
 *
 * Biome shares one daemon per version. Proxies of the same version started
 * at the same time spawn a daemon each, and the one no client connects to
 * never exits. Starting them one at a time lets the later ones reuse the
 * daemon of the first.
 */
const startsByVersion = new Map<string, Promise<void>>();

function startInTurn(version: string, task: () => Promise<void>) {
	const previous = startsByVersion.get(version) ?? Promise.resolve();
	const next = previous.then(task, task);
	startsByVersion.set(
		version,
		next.catch(() => {}),
	);

	return next;
}

export class Session {
	/**
	 * The language client for this session.
	 */
	private client: LanguageClient | undefined;

	/**
	 * Output channel reused by every start of this session.
	 */
	private outputChannel: LogOutputChannel | undefined;

	/**
	 * Serializes start and stop, which may now be requested at any time.
	 */
	private queue: Promise<void> = Promise.resolve();

	public get biomeVersion(): string | undefined {
		return this.client?.initializeResult?.serverInfo?.version;
	}

	public get isRunning(): boolean {
		return this.client !== undefined;
	}

	/**
	 * Short name for logs and the status bar: the first project folder.
	 */
	public readonly name: string;

	logger = new Logger('Biome Monorepo');

	/**
	 * Creates a new LSP session
	 */
	public constructor(
		public readonly version: string,
		public readonly bin: Uri,
		private readonly folders: Uri[],
	) {
		const label = folders[0] ? path.basename(folders[0].fsPath) : 'unknown';
		this.name = folders.length > 1 ? `${label} +${folders.length - 1}` : label;
	}

	/**
	 * Returns the path length of the deepest session folder containing the
	 * URI, or -1 when the URI is outside of this session.
	 */
	public matchDepth(uri: Uri): number {
		let depth = -1;

		for (const folder of this.folders) {
			const relative = path.relative(folder.fsPath, uri.fsPath);
			const inside =
				relative === '' ||
				(!relative.startsWith('..') && !path.isAbsolute(relative));

			if (inside && folder.fsPath.length > depth) {
				depth = folder.fsPath.length;
			}
		}

		return depth;
	}

	/**
	 * Starts the LSP session. Does nothing if it is already running.
	 */
	public start(): Promise<void> {
		return this.enqueue(async () => {
			if (this.client) {
				return;
			}

			const client = this.createLanguageClient();
			this.client = client;

			try {
				await startInTurn(this.version, () => client.start());
				this.logger.info(`▶️ Started ${this.name} (${this.version}).`);
			} catch (error) {
				this.client = undefined;
				this.logger.error(`Failed to start ${this.name}: ${String(error)}`);
			}
		});
	}

	/**
	 * Stops the LSP session. Does nothing if it isn't running.
	 */
	public stop(): Promise<void> {
		return this.enqueue(() => this.doStop());
	}

	/**
	 * Stops the session and releases its output channel.
	 */
	public async dispose(): Promise<void> {
		await this.stop();
		this.outputChannel?.dispose();
		this.outputChannel = undefined;
	}

	private enqueue(task: () => Promise<void>): Promise<void> {
		const next = this.queue.then(task, task);
		this.queue = next.catch(() => {});

		return next;
	}

	private async doStop() {
		const client = this.client;
		if (!client) {
			return;
		}

		this.logger.debug('Stopping LSP session');
		this.client = undefined;

		try {
			await client.stop(STOP_TIMEOUT_MS);
			this.logger.info(`⏹️ Stopped ${this.name}.`);
		} catch (error) {
			// The language client terminates the server process on its own
			// after a failed shutdown, so there is nothing left to clean up.
			this.logger.warn(`Failed to stop LSP session: ${String(error)}`);
		}
	}

	/**
	 * Creates a new language client for the session.
	 */
	private createLanguageClient(): LanguageClient {
		this.logger.debug(`Creating LSP session with ${this.bin.fsPath}`);

		const serverOptions: ServerOptions = {
			command: this.bin.fsPath,
			transport: TransportKind.stdio,
			args: ['lsp-proxy'],
		};

		this.outputChannel ??= window.createOutputChannel(
			`${displayName} (${this.name}, ${this.version}) - LSP`,
			{
				log: true,
			},
		);
		const clientOptions: LanguageClientOptions = {
			outputChannel: this.outputChannel,
			traceOutputChannel: this.outputChannel,
			documentSelector: this.createDocumentSelector(),
		};

		return new BiomeMonorepoLanguageClient(
			'biome-monorepo.lsp',
			'biome-monorepo',
			serverOptions,
			clientOptions,
			this.folders,
		);
	}

	private createDocumentSelector(): DocumentFilter[] {
		return supportedLanguages.flatMap((language) =>
			this.folders.map((folder) => ({
				language,
				scheme: 'file',
				pattern: Uri.joinPath(folder, '**', '*').fsPath.replaceAll('\\', '/'),
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
