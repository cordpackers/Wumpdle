# Wumpdle

Discord Update API server emulator for patched Discord Desktop applications. Fetches info from Discord if there's no patched version available.

It get stable only for now, new updates would be pushed later.

## Usage

1. Create folder `distribution`, and create folder `cache`, `patched`, `download`, and file `patched_versions.json` and `setup_download.json` inside it.
2. Put patches under `module_name/module_version` or `host/host_version`. Windows is `full.distro/delta.distro`. macOS and Linux are complicated but generally `.zip`, `.dmg`, `.deb`, `.tar.gz`
3. Write your patched versions info in `patched_versions.json`. Here's an example:
```json
{
  "host": {
    "version": [0, 0, 1],
    "sha256": "",
    "files": {
      "windows": {
        "full": "full.distro" // if you use object storage type out the full url, otherwise set filename
      }
    }
  },
  "modules": {
    "discord_desktop_core": {
      "version": 1,
      "sha256": "",
      "files": {
        "windows": {
          "full": "full.distro" // if you use object storage type out the full url, otherwise set filename
        }
      }
    }
  }
}
```
4. Write your setup name in `setup_names.json`. Here's an example:
```json
{
  "windows": "HowdycordSetup.exe"
}
```
5. Put installer files to `download/(os)/`
6. Run `npm run start (port here) (using object storage? boolean here)`