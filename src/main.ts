import type { ExtensionContext } from 'vscode';
import { Extension } from './Extension';

export const activate = async (context: ExtensionContext) => {
	await Extension.getInstance(context).init();
};

export const deactivate = async () => {
	await Extension.getInstance().stop();
};
