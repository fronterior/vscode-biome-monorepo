import { type LogOutputChannel, window } from 'vscode';

export class Logger {
	/**
	 * The output channel for logging messages.
	 */
	private outputChannel: LogOutputChannel;

	private timers = new Map<string, number>();

	/**
	 * Creates a new logger for the given Biome instance
	 */
	constructor(private readonly name: string) {
		this.outputChannel = window.createOutputChannel(name, {
			log: true,
		});
	}

	public show(preserveFocus: boolean = false): void {
		this.outputChannel.show(preserveFocus);
	}

	/**
	 * Logs a message to the output channel.
	 *
	 * @param message The message to log.
	 */
	public info(message: string): void {
		this.outputChannel?.info(` ${message}`);
	}

	/**
	 * Logs an error message to the output channel.
	 *
	 * @param message The error message to log.
	 */
	public error(message?: string): void {
		this.outputChannel.error(message ?? '');
	}

	/**
	 * Logs a warning message to the output channel.
	 *
	 * @param message The warning message to log.
	 */
	public warn(message?: string): void {
		this.outputChannel.warn(message ?? '');
	}

	/**
	 * Logs a debug message to the output channel.
	 *
	 * @param message The debug message to log.
	 */
	public debug(message?: string): void {
		this.outputChannel.debug(message ?? '');
	}

	/**
	 * Logs a verbose message to the output channel.
	 *
	 * @param message The verbose message to log.
	 */
	public trace(message?: string): void {
		this.outputChannel.trace(message ?? '');
	}

	public time(label: string): void {
		if (this.timers.has(label)) {
			this.error(`Timer ${label} already exists`);

			return;
		}

		this.timers.set(label, performance.now());
	}

	public timeEnd(label: string, fixed: number = 2): void {
		if (!this.timers.has(label)) {
			this.error(`Timer ${label} does not exist`);

			return;
		}

		const duration = performance.now() - (this.timers.get(label) ?? 0);
		this.info(`⏲ ${label}: ${duration.toFixed(fixed)}ms`);
		this.timers.delete(label);
	}
}
