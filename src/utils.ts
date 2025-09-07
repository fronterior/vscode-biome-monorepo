import { createRequire } from "node:module";
import { FileType, Uri, type WorkspaceFolder, workspace } from "vscode";
import { Utils } from "vscode-uri";
import {
	platformSpecificBinaryName,
	platformSpecificNodePackageName,
} from "./constants";

/**
 * Checks whether a file exists
 *
 * This function checks whether a file exists at the given URI using VS Code's
 * FileSystem API.
 *
 * @param uri URI of the file to check
 * @returns Whether the file exists
 */
export const fileExists = async (uri: Uri): Promise<boolean> => {
	try {
		const stat = await workspace.fs.stat(uri);
		return (stat.type & FileType.File) > 0;
	} catch (_err) {
		return false;
	}
};

/**
 * Finds projects that have Biome dependency from the given package.json list
 *
 * Simply considers projects using Biome if they have @biomejs/biome in package.json.
 * May need to verify if using biome.json in the project path is more appropriate.
 *
 * @param uris List of package.json URIs
 * @returns List of project URIs that have @biomejs/biome as dependency
 */
export const findBiomeProjects = async (uris: Uri[]) => {
	const result: Uri[] = [];

	for (const uri of uris) {
		try {
			if (!(await fileExists(uri))) {
				continue;
			}

			const packageJsonString = (await workspace.fs.readFile(uri)).toString();
			const { dependencies, devDependencies, peerDependencies } =
				JSON.parse(packageJsonString);
			if (
				(dependencies && "@biomejs/biome" in dependencies) ||
				(devDependencies && "@biomejs/biome" in devDependencies) ||
				(peerDependencies && "@biomejs/biome" in peerDependencies)
			) {
				result.push(uri);
			}
		} catch {}
	}

	return result;
};

/**
 * Finds the Biome binary URI
 *
 * Finds the Biome binary used by @biomejs/biome package.json using createRequire.
 * Needs to be modified to inject require for Yarn PnP environment usage.
 *
 * @param uri URI of @biomejs/biome package.json
 * @returns URI of the Biome binary
 */
export const findBiomeBinaryUri = async (uri: Uri) => {
	try {
		// Create a require function scoped to @biomejs/biome package.
		const biomePackageRequire = createRequire(uri.fsPath);

		// Resolve the path to the platform-specific @biomejs/cli-* package.
		const pathToBiomeCliPackage = Utils.dirname(
			Uri.file(
				biomePackageRequire.resolve(
					`${platformSpecificNodePackageName}/package.json`,
				),
			),
		);

		// Resolve the path to the biome binary.
		const biome = Uri.joinPath(
			pathToBiomeCliPackage,
			platformSpecificBinaryName,
		);

		if (await fileExists(biome)) {
			return biome;
		}

		return null;
	} catch {
		return null;
	}
};

/**
 * Finds @biomejs/biome packages used by projects and returns a mapped object.
 * Needs to be modified to inject require for Yarn PnP environment usage.
 *
 * @param uris List of workspace project URIs that have @biomejs/biome as dependency
 * @returns Map object of actual Biome package paths to their associated project lists
 */
export const findBiomePackagesByProject = (uris: Uri[]) => {
	const result: Record<string, Uri[]> = {};

	for (const uri of uris) {
		const packageDir = Utils.dirname(uri);
		const projectRequire = createRequire(uri.fsPath);

		try {
			const biomePackagePath = projectRequire.resolve(
				"@biomejs/biome/package.json",
			);

			result[biomePackagePath] = [
				...(result[biomePackagePath] ?? []),
				packageDir,
			];
		} catch {}
	}

	return result;
};

/**
 * Gets the version of a node_modules package
 */
export const getVersion = async (uri: Uri) => {
	try {
		const projectRequire = createRequire(uri.fsPath);
		const packageJson = projectRequire(uri.fsPath);

		return packageJson.version ?? "unknown";
	} catch {
		return "unknown";
	}
};

export const findPnpFileInPath = async (uri: Uri) => {
	let parent = Utils.dirname(uri);
	let current = uri;

	while (current.fsPath !== parent.fsPath) {
		if (
			(await fileExists(Uri.joinPath(current, ".pnp.cjs"))) ||
			(await fileExists(Uri.joinPath(current, ".pnp.js")))
		) {
			return current;
		}

		current = Utils.dirname(current);
		parent = Utils.dirname(current);
	}

	return null;
};

export const findPnpWorkspaceFolders = async (
	workspaceFolders: readonly WorkspaceFolder[],
) => {
	const result: WorkspaceFolder[] = [];

	for (const folder of workspaceFolders) {
		if (await findPnpFileInPath(folder.uri)) {
			result.push(folder);
		}
	}

	return result;
};
