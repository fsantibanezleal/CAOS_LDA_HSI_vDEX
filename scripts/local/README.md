# Local Setup Scripts

This directory contains explicit setup entry points for the two distinct
execution environments used by the repository.

## Environments

- `setup-web.*`: backend + frontend environment
- `setup-pipeline.*`: data-pipeline environment
- `setup-all.*`: both

On Windows, `setup-pipeline.ps1` may create `.venv-pipeline` as a
junction to a shorter physical path under `%LOCALAPPDATA%`. That avoids
long-path failures from large scientific and notebook-adjacent
dependencies while preserving the repo-local command surface.

Use these scripts directly or through `scripts/local.ps1` and
`scripts/local.sh`.

For runtime validation, the repo-level runners expose:

- `smoke`: validates the backend-served SPA on `http://127.0.0.1:8437`
- `smoke-dev`: validates the Vite dev app on `http://127.0.0.1:5437`
