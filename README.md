# VSCode Biome Monorepo

An unofficial VS Code extension that enables Biome formatting in monorepo environments.

Unlike the official plugin, this extension maps Biome binaries to monorepo workspaces to configure projects that will work properly.

Therefore, this plugin will be maintained until the official plugin supports this functionality.

## Features

- **Automatic Project Detection**: Automatically detects Biome projects in monorepo workspaces
- **Per-Project Binary Management**: Each project uses its own Biome version and configuration
- **Multiple LSP Servers**: Runs separate Language Server Protocol instances for each Biome project
- **Yarn PnP Support**: Full support for Yarn Plug'n'Play workspaces
- **Restart Command**: Easily restart all Biome sessions with a single command

## Commands

- `Biome Monorepo: Restart` - Restart all Biome LSP sessions

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## Plans

- Enhanced Yarn PnP support
- Windows binary temporary file optimization

## Acknowledgments

Based on the official [Biome VS Code Extension](https://github.com/biomejs/biome-vscode) by the Biome team.

## License

MIT
