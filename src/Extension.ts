import { commands, type ExtensionContext, Uri, workspace } from 'vscode';
import { Logger } from './Logger';
import { Session } from './Session';
import {
	findBiomeBinaryUri,
	findBiomePackagesByProject,
	findBiomeProjects,
	getVersion,
} from './utils';

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

	constructor(public context: ExtensionContext) {
		if (workspace.workspaceFolders === undefined) {
			this.logger.error('No workspace folder found.');
			return;
		}
	}

	async start() {
		this.logger.info('Starting extension...');

		await this.registerListeners();

		await this.createWorkspaceInstances();

		await Promise.all(this.sessions.map((session) => session.start()));
	}

	async stop() {
		this.logger.info('Stopping extension...');
		this.context.subscriptions.forEach((subscription) => {
			subscription.dispose();
		});
		this.context.subscriptions.splice(0);

		await Promise.all(this.sessions.map((session) => session.stop()));
	}

	async restart() {
		this.logger.info('Restarting extension...');
		await this.stop();
		await this.start();
	}

	private async createWorkspaceInstances(): Promise<void> {
		const projectUris = await workspace.findFiles(
			'**/package.json',
			'**/node_modules/**',
		);
		this.logger.info(
			`🔍 Found ${projectUris.length} project folder(s) in workspaces.`,
		);

		const biomeProjects = await findBiomeProjects(projectUris);
		if (!biomeProjects.length) {
			this.logger.warn('No biome project found.');

			return;
		}

		this.logger.info(
			`🔍 Found ${biomeProjects.length} biome project folder(s). `,
		);

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

	private async registerListeners() {
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
		];

		const workspaceListeners = [
			workspace.onDidChangeWorkspaceFolders(() => {
				this.restart();
			}),
		];

		const lockFileNames = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];

		const lockFiles = await workspace.findFiles(
			`**/{${lockFileNames.join(',')}}`,
		);

		const lockFileListeners = lockFiles.map((pattern) => {
			const watcher = workspace.createFileSystemWatcher(pattern.fsPath);
			watcher.onDidChange(() => this.restart());

			return watcher;
		});

		this.context.subscriptions.push(
			...commandListeners,
			...workspaceListeners,
			...lockFileListeners,
		);
	}
}
