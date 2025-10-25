# VSCode Biome Monorepo

An unofficial VS Code extension that enables Biome formatting in monorepo environments.

Unlike the official plugin, this extension maps Biome binaries to monorepo workspaces to configure projects that will work properly.

Therefore, this plugin will be maintained until the official plugin supports this functionality.

## Prerequisites

This plugin discovers projects based on package.json files across VSCode workspaces. Before using it, add @biomejs/biome as a dependency in your project's package.json and install the package using your package manager.

## Usage

1. If the official Biome plugin is installed, it should be disabled before using this plugin as there may be conflicts.
2. Open the monorepo root folder or the parent folder of multiple projects in VSCode.
3. Add Biome-related settings to the configuration file (.vscode/settings.json) of the opened monorepo root folder. For detailed information about settings, please refer to the [official documentation](https://biomejs.dev/reference/vscode).
4. If you modify any biome.json file, please restart the plugin.

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

- The Biome LSP proxy server searches for biome.json files in the workspaceFolders paths provided by VSCode during server initialization.
- Therefore, if only the monorepo root folder is open in VSCode, it skips searching for biome.json in subdirectories and uses the root configuration instead.
- To prevent this, this plugin overrides VSCode's workspaceFolders with paths to projects that have Biome installed, ensuring each folder's biome.json is used.

## ⚠️ Differences from the Official Plugin

This plugin is currently tailored to specific personal use cases. To clarify terminology: "VSCode workspace" refers to folders opened in VSCode, while "sub-project" or "project" refers to package manager workspaces (npm, yarn, pnpm, etc.). Here are the key behavioral differences from the official plugin:

- Searches for package.json files across all open VSCode workspaces and connects only sub-paths of projects using `@biomejs/biome` to the Biome LSP. This means the extension won't work if packages aren't installed.
- Only performs diagnostics on files within sub-projects that use Biome in the monorepo. To enable Biome diagnostics across all projects, ensure the VSCode workspace root has a package.json with `@biomejs/biome` installed.
- Unsaved new files won't be formatted until they're saved within a project that uses Biome.

## Features

- **Automatic Project Detection**: Automatically detects Biome projects in monorepo workspaces
- **Per-Project Binary Management**: Each project uses its own Biome version and configuration
- **Multiple LSP Servers**: Runs separate Language Server Protocol instances for each Biome project

## Commands

- `Biome Monorepo: Restart` - Restart all Biome LSP sessions
- `Biome Monorepo: Show Output Channel` - Show the Biome Monorepo output channel
- `Biome Monorepo: Fix all auto-fixable Problems` - Fix all auto-fixable Problems in focused file

## ESLint + Prettier Migration Guide

If your project currently uses ESLint and Prettier and you need to migrate to Biome gradually, this guide is for you. During the migration period, you'll need to configure the plugins as follows:

- [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode): Use as the default formatter until migration is complete, as it has high compatibility with Biome
- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint): Use for diagnostics in projects not yet using Biome
- [Biome Monorepo](https://marketplace.visualstudio.com/items?itemName=fronterior.biome-monorepo): Use for diagnostics in projects using Biome

### Configuring settings.json

- `eslint.workingDirectories`: Specify an array of paths to projects using ESLint. For more details, refer to the [vscode-eslint documentation](https://github.com/microsoft/vscode-eslint)
- `editor.defaultFormatter`: `esbenp.prettier-vscode`

Since this plugin only targets projects with Biome as a dependency, formatting and linting won't work in projects still using Prettier.
To solve this, restrict ESLint diagnostics to projects using ESLint and use Prettier as the editor's default formatter.
To support formatting via Prettier during the migration, add a `.prettierrc` file to Biome projects that matches Biome's formatting configuration.
This ensures proper linting and formatting per project during the migration process.
Here's an example of the final configuration:

#### Folder Structure

```
packages/
├─ server/
│  ├─ .eslintrc
│  └─ .prettierrc
├─ client/
│  ├─ biome.json
│  └─ .prettierrc
└─ utils/
   ├─ .eslintrc
   └─ .prettierrc
```

#### settings.json Example

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.biome": "explicit",
    "source.organizeImports.biome": "explicit",
    "source.fixAll.eslint": "explicit"
  },
  "eslint.format.enable": true,
  "eslint.workingDirectories": ["./packages/server", "./packages/utils"]
}
```

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## Plans

- [x] Connect appropriate biome.json per file
- [x] Automatic plugin restart when needed
- [ ] Replace full scan with on-demand detection
- [ ] Windows binary temporary file optimization
- [ ] Yarn PnP support

## Acknowledgments

Based on the official [Biome VS Code Extension](https://github.com/biomejs/biome-vscode) by the Biome team.

## License

MIT
