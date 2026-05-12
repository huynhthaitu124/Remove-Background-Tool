# Repository Guidelines

## Local Notes (Not Committed)
- This file is intentionally ignored by git.
- PyPI token location (path only): `/home/john/.credentials/pypi`.
- Use token as `TWINE_USERNAME=__token__` and `TWINE_PASSWORD` from the file.

## Release Checklist
- Bump version in `setup.py` and `backgroundremover/__init__.py`.
- Update `README.md` if CLI flags or outputs change.
- Build: `python -m build`.
- Upload: `python -m twine upload dist/*`.
- Tag: `git tag vX.Y.Z && git push origin vX.Y.Z`.
- Close related issues with a note to update to the latest release.

## Video Pipeline Fixes (Recent)
- Exact framerate handling for masks.
- Explicit ffmpeg stream mapping for video + optional audio.
- Alpha codec options: `--alpha-codec` and `--alpha-pix-fmt`.

