import { StatusBarAlignment, type StatusBarItem, window } from 'vscode';

export class StatusBar {
	private statusBarItem: StatusBarItem;

	constructor() {
		this.statusBarItem = window.createStatusBarItem(
			'status',
			StatusBarAlignment.Right,
			100,
		);
	}

	print(options: Partial<Pick<StatusBarItem, 'text' | 'tooltip' | 'command'>>) {
		Object.assign(this.statusBarItem, options);
		this.statusBarItem.name = 'Biome Monorepo';
		this.statusBarItem.command = 'biome-monorepo.showCommands';
	}

	reset() {
		this.print({
			text: '$(biome-logo)',
			tooltip: 'Biome Monorepo',
			command: 'biome-monorepo.showCommands',
		});
	}

	start() {
		this.print({ text: '$(biome-logo)' });
		this.statusBarItem.show();
	}

	stop() {
		this.statusBarItem.hide();
	}
}
