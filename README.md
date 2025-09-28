# VSCode Biome Monorepo

An unofficial VS Code extension that enables Biome formatting in monorepo environments.

Unlike the official plugin, this extension maps Biome binaries to monorepo workspaces to configure projects that will work properly.

Therefore, this plugin will be maintained until the official plugin supports this functionality.

## Usage

1. If the official Biome plugin is installed, it should be disabled before using this plugin as there may be conflicts.
2. Open the monorepo root folder or the parent folder of multiple projects in VSCode.
3. Add Biome-related settings to the configuration file (.vscode/settings.json) of the opened monorepo root folder. For detailed information about settings, please refer to the [official documentation](https://biomejs.dev/reference/vscode).

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "fronterior.biome-monorepo",
  "editor.codeActionsOnSave": {
    "source.fixAll.biome": "explicit",
    "source.organizeImports.biome": "explicit"
  }
}
```

**_⚠️ Warning: Unlike version 0.0.3, it now works without copying biome.json to the root path!_**

## How It Works

The Biome LSP proxy server searches for biome.json files in the workspaceFolders paths provided by VSCode during server initialization. Therefore, if only the monorepo root folder is open in VSCode, it skips searching for biome.json in subdirectories and uses the root configuration instead. To prevent this, this plugin overrides VSCode's workspaceFolders with paths to projects that have Biome installed, ensuring each folder's biome.json is used.

## Features

- **Automatic Project Detection**: Automatically detects Biome projects in monorepo workspaces
- **Per-Project Binary Management**: Each project uses its own Biome version and configuration
- **Multiple LSP Servers**: Runs separate Language Server Protocol instances for each Biome project

## Commands

- `Biome Monorepo: Restart` - Restart all Biome LSP sessions

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## Plans

- [x] Connect appropriate biome.json per file
- [ ] Automatic plugin restart when needed
- [ ] Windows binary temporary file optimization
- [ ] Yarn PnP support

## Acknowledgments

Based on the official [Biome VS Code Extension](https://github.com/biomejs/biome-vscode) by the Biome team.

## License

MIT
