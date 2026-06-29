# OpenKB Application Workspace

This directory contains the Python scripts and Docker configuration for running the OpenKB pipeline and wiki synchronizer.

## Setup & Running
This workspace is managed using `uv`. Dependencies are specified in `pyproject.toml`.
To run scripts in the local virtual environment (if desired):
```bash
uv run openkb.py
```
Or use the npm commands from the root directory to run inside the Docker container.
