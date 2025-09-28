import { commands, type ExtensionContext, Uri, workspace } from 'vscode';
import Logger from './Logger';
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

	async init() {
		this.registerCommands();

		await this.createWorkspaceInstances();
		this.start();
	}

	async start() {
		await Promise.all(this.sessions.map((biome) => biome.start()));
	}

	async stop() {
		this.sessions.forEach((biome) => {
			biome.stop();
		});
	}

	private async createWorkspaceInstances(): Promise<void> {
		const projectUris = await workspace.findFiles(
			'**/package.json',
			'**/node_modules/**',
		);
		this.logger.info(`🔍 Found ${projectUris.length} project folder(s).`);

		const biomeProjects = await findBiomeProjects(projectUris);
		this.logger.info(
			`🔍 Found ${biomeProjects.length} biome project folder(s). ${biomeProjects
				.map(({ fsPath }) => fsPath)
				.join(', ')}`,
		);

		// Maps Biome package paths to their associated project paths
		const biomePackages = findBiomePackagesByProject(biomeProjects);

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

	private registerCommands(): void {
		const restartCommand = commands.registerCommand(
			'biome.monorepo.restart',
			async () => {
				await this.stop();
				await this.start();
			},
		);

		this.context.subscriptions.push(restartCommand);
	}
}
