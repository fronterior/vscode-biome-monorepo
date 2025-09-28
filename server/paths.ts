import fs from "node:fs";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from "vscode-uri";

export function getFileSystemPath(uri: URI): string {
	let result = uri.fsPath;
	if (process.platform === "win32" && result.length >= 2 && result[1] === ":") {
		// Node by default uses an upper case drive letter and ESLint uses
		// === to compare paths which results in the equal check failing
		// if the drive letter is lower case in th URI. Ensure upper case.
		result = result[0].toUpperCase() + result.substr(1);
	}
	if (process.platform === "win32" || process.platform === "darwin") {
		try {
			const realpath = fs.realpathSync.native(result);
			// Only use the real path if only the casing has changed.
			if (realpath.toLowerCase() === result.toLowerCase()) {
				result = realpath;
			}
		} catch {
			// Silently ignore errors from `fs.realpathSync` to handle scenarios where
			// the file being linted is not yet written to disk. This occurs in editors
			// such as Neovim for non-written buffers.
		}
	}
	return result;
}

export function getUri(documentOrUri: string | TextDocument | URI): URI {
	return typeof documentOrUri === "string"
		? URI.parse(documentOrUri)
		: documentOrUri instanceof URI
			? documentOrUri
			: URI.parse(documentOrUri.uri);
}
