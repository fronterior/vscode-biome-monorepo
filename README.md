# VSCode Biome Monorepo

An unofficial VS Code extension that enables Biome formatting in monorepo environments.

Unlike the official plugin, this extension maps Biome binaries to monorepo workspaces to configure projects that will work properly.

Therefore, this plugin will be maintained until the official plugin supports this functionality.

## Usage

Open the monorepo root folder in VSCode. Add Biome-related settings to the configuration file (.vscode/settings.json) of the opened monorepo root folder. For detailed information about settings, please refer to the [official documentation](https://biomejs.dev/reference/vscode).

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.biome": "explicit",
    "source.organizeImports.biome": "explicit"
  }
}
```

## Features

- **Automatic Project Detection**: Automatically detects Biome projects in monorepo workspaces
- **Per-Project Binary Management**: Each project uses its own Biome version and configuration
- **Multiple LSP Servers**: Runs separate Language Server Protocol instances for each Biome project

## Commands

- `Biome Monorepo: Restart` - Restart all Biome LSP sessions

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## Plans

- Yarn PnP support
- Windows binary temporary file optimization

## Acknowledgments

Based on the official [Biome VS Code Extension](https://github.com/biomejs/biome-vscode) by the Biome team.

## License

MIT
