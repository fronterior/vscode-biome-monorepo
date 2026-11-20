import {
	commands,
	type ExtensionContext,
	type Tab,
	TabInputText,
	TabInputTextDiff,
	Uri,
	window,
	workspace,
} from 'vscode';
import { Logger } from './Logger';
import { Session } from './Session';
import { StatusBar } from './StatusBar';
import {
	findBiomeBinaryUri,
	findBiomePackagesByProject,
	findBiomeProjects,
	getVersion,
} from './utils';

/**
 * Folders that never hold a Biome project of their own: dependencies, VCS data
 * and build output that may carry a copy of package.json (e.g. `.next/standalone`).
 */
const PROJECT_SEARCH_EXCLUDE =
	'**/{node_modules,.git,.next,.nuxt,.output,.svelte-kit,.turbo,.vercel,dist,coverage}/**';

const LOCK_FILE_GLOB = '**/{package-lock.json,yarn.lock,pnpm-lock.yaml}';

/**
 * Package managers write lock files several times per install.
 */
const LOCK_FILE_DEBOUNCE_MS = 2000;

type StartMode = 'lazy' | 'eager';

/**
 * Files shown by an editor tab. For a diff, only the side being edited.
 */
const tabUris = (tab: Tab): Uri[] => {
	if (tab.input instanceof TabInputText) {
		return [tab.input.uri];
	}
	if (tab.input instanceof TabInputTextDiff) {
		return [tab.input.modified];
	}
	return [];
};

export class Extension {
	static instance: Extension;

	static getInstance(context?: ExtensionContext) {
		if (!context) {
			throw new Error('Extension context is required');
		}
		Extension.instance ??= new Extension(context);

		return Extension.instance;
	}

	private logger = new Logger('Biome Monorepo');

	private sessions: Session[] = [];

	private lockFileTimer: ReturnType<typeof setTimeout> | undefined;

	private idleTimers = new Map<Session, ReturnType<typeof setTimeout>>();

	private statusBar = new StatusBar();

	/**
	 * Serializes start, stop and restart so that a restart requested while the
	 * extension is still starting doesn't leave orphaned sessions behind.
	 */
	private lifecycle: Promise<void> = Promise.resolve();

	constructor(public context: ExtensionContext) {
		if (workspace.workspaceFolders === undefined) {
			this.logger.error('No workspace folder found.');
			return;
		}
	}

	private get startMode(): StartMode {
		return workspace
			.getConfiguration('biome-monorepo')
			.get<StartMode>('startMode', 'lazy');
	}

	/**
	 * Idle timeout in milliseconds, or 0 to keep sessions running.
	 */
	private get idleTimeout(): number {
		const minutes = workspace
			.getConfiguration('biome-monorepo')
			.get<number>('idleTimeout', 10);

		return Math.max(0, minutes) * 60_000;
	}

	start(): Promise<void> {
		return this.enqueue(() => this.doStart());
	}

	stop(): Promise<void> {
		return this.enqueue(() => this.doStop());
	}

	restart(): Promise<void> {
		return this.enqueue(async () => {
			this.logger.info('Restarting extension...');
			await this.doStop();
			await this.doStart();
		});
	}

	private enqueue(task: () => Promise<void>): Promise<void> {
		const next = this.lifecycle.then(task, task);
		this.lifecycle = next.catch(() => {});

		return next;
	}

	private async doStart() {
		this.logger.info('Starting extension...');
		this.statusBar.start();
		this.statusBar.print({
			text: '$(loading~spin)',
			tooltip: 'Loading Biome Monorepo',
		});

		this.registerListeners();
		await this.createWorkspaceInstances();

		if (this.startMode === 'eager') {
			await Promise.allSettled(this.sessions.map((session) => session.start()));
		} else {
			await this.syncSessions();
		}

		this.updateStatusBar();
		this.logger.info(
			`🚀 Extension started (${this.startMode}): ${this.runningCount()} of ${this.sessions.length} session(s) running.`,
		);
	}

	private async doStop() {
		this.logger.info('Stopping extension...');
		this.context.subscriptions.forEach((subscription) => {
			subscription.dispose();
		});
		this.context.subscriptions.splice(0);
		clearTimeout(this.lockFileTimer);
		this.clearIdleTimers();

		// Detach the sessions first so that nothing can start them again.
		const sessions = this.sessions;
		this.sessions = [];
		await Promise.allSettled(sessions.map((session) => session.dispose()));

		this.statusBar.stop();
		this.logger.info('🛑 Extension stopped.');
	}

	private async createWorkspaceInstances(): Promise<void> {
		this.logger.time('find all package.json');
		const projectUris = await workspace.findFiles(
			'**/package.json',
			PROJECT_SEARCH_EXCLUDE,
		);
		this.logger.timeEnd('find all package.json');
		this.logger.info(
			`🔍 Found ${projectUris.length} project folder(s) in workspaces.`,
		);

		this.logger.time('find all biome projects');
		const biomeProjects = await findBiomeProjects(projectUris);
		if (!biomeProjects.length) {
			this.logger.warn('No biome project found.');

			return;
		}
		this.logger.timeEnd('find all biome projects');
		this.logger.info(
			`🔍 Found ${biomeProjects.length} biome project folder(s).`,
		);

		this.logger.time('find biome binaries');
		// Maps Biome package paths to their associated project paths
		const biomePackages = findBiomePackagesByProject(biomeProjects);
		if (!Object.keys(biomePackages).length) {
			this.logger.warn(
				'No biome package found in node_modules. Please install it.',
			);
			return;
		}

		const biomeVersionsEntries = await Promise.all(
			Object.keys(biomePackages).map(async (biomePackage) => {
				return [
					biomePackage,
					await getVersion(Uri.file(biomePackage)),
				] as const;
			}),
		);
		const biomeVersionMap = Object.fromEntries(biomeVersionsEntries);

		const biomeBinaryUris = await Promise.all(
			Object.keys(biomePackages).map(async (biomePackage) => {
				const binary = await findBiomeBinaryUri(Uri.file(biomePackage));
				if (!binary) {
					// The @biomejs/biome package has a dependency on the @biomejs/cli-* package, so this should not be reached unless manually deleted.
					this.logger.warn(
						`No binary found for ${biomePackage}. It appears that node_modules is not properly installed. Please reinstall it.`,
					);
				}

				return [biomePackage, binary] as const;
			}),
		);

		const biomeBinaryMap = Object.fromEntries(biomeBinaryUris);
		this.logger.timeEnd('find biome binaries');

		// Flatten Biome instances
		this.sessions = Object.keys(biomePackages)
			.map((biomePackage) => {
				const binary = biomeBinaryMap[biomePackage];
				if (!binary) {
					return null;
				}
				const projectFolders = biomePackages[biomePackage];

				const biomeVersion = biomeVersionMap[biomePackage];
				return new Session(biomeVersion, binary, projectFolders);
			})
			.filter(Boolean) as Session[];
	}

	/**
	 * Finds the session owning the file: the one with the deepest project
	 * folder that contains it.
	 */
	private findSession(uri: Uri): Session | undefined {
		if (uri.scheme !== 'file') {
			return undefined;
		}

		let best: Session | undefined;
		let bestDepth = -1;

		for (const session of this.sessions) {
			const depth = session.matchDepth(uri);
			if (depth > bestDepth) {
				best = session;
				bestDepth = depth;
			}
		}

		return best;
	}

	/**
	 * Sessions that have at least one file open in an editor tab.
	 *
	 * Tabs are used instead of `workspace.textDocuments`: other extensions load
	 * documents in the background, which would start sessions nobody looks at.
	 */
	private sessionsWithOpenTabs(): Set<Session> {
		const result = new Set<Session>();

		for (const group of window.tabGroups.all) {
			for (const tab of group.tabs) {
				for (const uri of tabUris(tab)) {
					const session = this.findSession(uri);
					if (session) {
						result.add(session);
					}
				}
			}
		}

		return result;
	}

	/**
	 * Starts sessions that have open tabs and schedules the others to stop.
	 */
	private async syncSessions(): Promise<void> {
		if (this.startMode === 'eager') {
			return;
		}

		const starts: Promise<void>[] = [];

		for (const session of this.sessionsWithOpenTabs()) {
			this.cancelIdleTimer(session);
			if (!session.isRunning) {
				starts.push(session.start());
			}
		}

		if (starts.length) {
			await Promise.allSettled(starts);
			this.updateStatusBar();
		}

		// Tabs may have been closed while the sessions were starting.
		const wanted = this.sessionsWithOpenTabs();
		for (const session of this.sessions) {
			if (session.isRunning && !wanted.has(session)) {
				this.scheduleIdleStop(session);
			}
		}
	}

	private scheduleIdleStop(session: Session): void {
		const timeout = this.idleTimeout;
		if (timeout === 0 || this.idleTimers.has(session)) {
			return;
		}

		this.idleTimers.set(
			session,
			setTimeout(async () => {
				this.idleTimers.delete(session);
				if (this.sessionsWithOpenTabs().has(session)) {
					return;
				}

				this.logger.info(`💤 ${session.name} is idle.`);
				await session.stop();
				this.updateStatusBar();
			}, timeout),
		);
	}

	private cancelIdleTimer(session: Session): void {
		clearTimeout(this.idleTimers.get(session));
		this.idleTimers.delete(session);
	}

	private clearIdleTimers(): void {
		for (const timer of this.idleTimers.values()) {
			clearTimeout(timer);
		}
		this.idleTimers.clear();
	}

	private runningCount(): number {
		return this.sessions.filter((session) => session.isRunning).length;
	}

	private updateStatusBar(): void {
		const running = this.sessions.filter((session) => session.isRunning);
		this.statusBar.print({
			text: `$(biome-logo) ${running.length}`,
			tooltip: running.length
				? `Biome Monorepo: ${running.map((session) => session.name).join(', ')}`
				: 'Biome Monorepo: no running sessions',
		});
	}

	private handleLockFileChange(uri: Uri): void {
		if (uri.fsPath.includes('node_modules')) {
			return;
		}

		clearTimeout(this.lockFileTimer);
		this.lockFileTimer = setTimeout(() => {
			this.logger.info(`🔒 ${uri.fsPath} changed, restarting.`);
			this.restart();
		}, LOCK_FILE_DEBOUNCE_MS);
	}

	private registerListeners() {
		const commandListeners = [
			commands.registerCommand('biome-monorepo.restart', () => {
				this.restart();
			}),
			commands.registerCommand('biome-monorepo.showOutputChannel', () => {
				this.logger.show();
			}),
			commands.registerCommand('biome-monorepo.executeAutofix', () => {
				commands.executeCommand('editor.action.sourceAction', {
					kind: 'source.fixAll.biome',
					apply: 'first',
				});
			}),
			commands.registerCommand('biome-monorepo.showCommands', async () => {
				const items = [
					{
						label: '$(wrench) Fix all auto-fixable Problems',
						command: 'biome-monorepo.executeAutofix',
					},
					{
						label: '$(refresh) Restart',
						command: 'biome-monorepo.restart',
					},
					{
						label: '$(output) Show Output Channel',
						command: 'biome-monorepo.showOutputChannel',
					},
				];

				const selected = await window.showQuickPick(items, {
					placeHolder: 'Select a Biome Monorepo command',
				});

				if (selected) {
					commands.executeCommand(selected.command);
				}
			}),
		];

		const workspaceListeners = [
			workspace.onDidChangeWorkspaceFolders(() => {
				this.restart();
			}),
			window.tabGroups.onDidChangeTabs(() => {
				this.syncSessions();
			}),
			workspace.onDidChangeConfiguration((event) => {
				if (event.affectsConfiguration('biome-monorepo.startMode')) {
					this.restart();
				} else if (event.affectsConfiguration('biome-monorepo.idleTimeout')) {
					this.clearIdleTimers();
					this.syncSessions();
				}
			}),
		];

		const lockFileWatcher = workspace.createFileSystemWatcher(LOCK_FILE_GLOB);
		lockFileWatcher.onDidChange((uri) => this.handleLockFileChange(uri));
		lockFileWatcher.onDidCreate((uri) => this.handleLockFileChange(uri));

		this.context.subscriptions.push(
			...commandListeners,
			...workspaceListeners,
			lockFileWatcher,
		);
	}
}
