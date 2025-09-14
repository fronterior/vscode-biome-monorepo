**_⚠️ Warning: The plugin is still incomplete with many missing features. Manual configuration is required to apply individual biome.json files in monorepos.
Please refer to Usage for exact usage instructions._**

# VSCode Biome Monorepo

An unofficial VS Code extension that enables Biome formatting in monorepo environments.

Unlike the official plugin, this extension maps Biome binaries to monorepo workspaces to configure projects that will work properly.

Therefore, this plugin will be maintained until the official plugin supports this functionality.

## Usage

1. Open the monorepo root folder or the parent folder of multiple projects in VSCode.
2. Add Biome-related settings to the configuration file (.vscode/settings.json) of the opened monorepo root folder. For detailed information about settings, please refer to the [official documentation](https://biomejs.dev/reference/vscode).
3. Add the biome.json to use at the root of the VSCode workspace(otherwise it will operate with default formatting settings).

```
example/
├── packages/
│   ├── server/
│   │   ├── src/
│   │   └── biome.json
│   └── web/
│       ├── src/
│       └── biome.json
└── biome.json <- Copied from packages/web/biome.json. All source code in packages using biome will operate with this configuration
```

**_⚠️ Warning: The biome.json copied to the root must be deleted after confirming that formatting is applied, as it causes errors by the biome binary when the plugin initializes. This process is essential for the plugin to function properly when VSCode is restarted._**

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

## Features

- **Automatic Project Detection**: Automatically detects Biome projects in monorepo workspaces
- **Per-Project Binary Management**: Each project uses its own Biome version and configuration
- **Multiple LSP Servers**: Runs separate Language Server Protocol instances for each Biome project

## Commands

- `Biome Monorepo: Restart` - Restart all Biome LSP sessions

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## Plans

- [ ] Connect appropriate biome.json per file
- [ ] Yarn PnP support
- [ ] Windows binary temporary file optimization
- [ ] Plugin restart due to lock file updates

## Acknowledgments

Based on the official [Biome VS Code Extension](https://github.com/biomejs/biome-vscode) by the Biome team.

## License

MIT
