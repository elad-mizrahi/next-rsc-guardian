# next-rsc-guardian

CLI that discovers Next.js repositories using React 19 and creates patch PRs for RSC-related security fixes.

## Setup

```bash
pnpm install
```

Create a `.env` file with your GitHub token:

```
GITHUB_TOKEN=your_token_here
```

## Usage

### Dry run (default)

Scans repositories and reports vulnerabilities without making changes:

```bash
pnpm start
pnpm start --limit=20
```

### Apply mode

Creates a PR to patch a specific vulnerable repository:

```bash
pnpm start --apply --target=owner/repo-name
```

## Options

| Option                | Description                           |
| --------------------- | ------------------------------------- |
| `--limit=N`           | Number of repos to scan (default: 10) |
| `--target=owner/name` | Target a specific repository          |
| `--apply`             | Create PRs (requires `--target`)      |

## How it works

1. Searches GitHub for repos with React 19 in `package.json`
2. Checks Next.js version against known patched versions
3. Reports vulnerable repos (dry run) or creates upgrade PRs (apply mode)

## Configuration

Security config is in `src/config/rsc-security.json`:

```json
{
  "react": {
    "vulnerableMajors": [19]
  },
  "next": {
    "patchedMinVersionByMinor": {
      "15.2": "15.2.6",
      "15.3": "15.3.6",
      "15.4": "15.4.8"
    }
  }
}
```

## License

ISC
