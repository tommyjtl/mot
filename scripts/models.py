#!/usr/bin/env python3
"""Download Supertonic 3 assets into ./models and serve them for local Motif dev."""

from __future__ import annotations

import argparse
import http.server
import socketserver
import sys
import urllib.error
import urllib.request
from pathlib import Path

HF_BASE = "https://huggingface.co/Supertone/supertonic-3/resolve/main"
DEFAULT_PORT = 8091
ROOT = Path(__file__).resolve().parent.parent
MODEL_DIR = ROOT / "models" / "supertonic-3"

ONNX_ASSETS = [
    "onnx/tts.json",
    "onnx/unicode_indexer.json",
    "onnx/duration_predictor.onnx",
    "onnx/text_encoder.onnx",
    "onnx/vector_estimator.onnx",
    "onnx/vocoder.onnx",
]

VOICE_ASSETS = [
    f"voice_styles/{voice}.json"
    for voice in ("F1", "F2", "F3", "F4", "F5", "M1", "M2", "M3", "M4", "M5")
]

ALL_ASSETS = [*ONNX_ASSETS, *VOICE_ASSETS]


def download_asset(relative_path: str, force: bool = False) -> None:
    destination = MODEL_DIR / relative_path
    destination.parent.mkdir(parents=True, exist_ok=True)

    if destination.exists() and not force:
        size_mb = destination.stat().st_size / (1024 * 1024)
        print(f"skip  {relative_path} ({size_mb:.1f} MB)")
        return

    url = f"{HF_BASE}/{relative_path}"
    print(f"fetch {relative_path}")
    request = urllib.request.Request(url, headers={"User-Agent": "mot-models/1.0"})

    try:
        with urllib.request.urlopen(request) as response:
            data = response.read()
    except urllib.error.HTTPError as error:
        raise SystemExit(f"Failed to download {relative_path}: HTTP {error.code}") from error
    except urllib.error.URLError as error:
        raise SystemExit(f"Failed to download {relative_path}: {error.reason}") from error

    destination.write_bytes(data)
    size_mb = len(data) / (1024 * 1024)
    print(f"saved {relative_path} ({size_mb:.1f} MB)")


def download_all(force: bool = False) -> None:
    print(f"Downloading Supertonic 3 assets to {MODEL_DIR}")
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    for asset in ALL_ASSETS:
        download_asset(asset, force=force)

    print("Done.")


class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(MODEL_DIR), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Cache-Control", "public, max-age=86400")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.end_headers()

    def log_message(self, format: str, *args) -> None:
        print(f"[models] {self.address_string()} - {format % args}")


def serve(port: int) -> None:
    if not MODEL_DIR.exists():
        raise SystemExit(
            f"Model directory not found: {MODEL_DIR}\n"
            "Run: python3 scripts/models.py download"
        )

    with socketserver.TCPServer(("127.0.0.1", port), CORSRequestHandler) as httpd:
        print(f"Serving {MODEL_DIR} at http://127.0.0.1:{port}/")
        print("Press Ctrl+C to stop.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    download_parser = subparsers.add_parser("download", help="Download model assets from Hugging Face")
    download_parser.add_argument(
        "--force",
        action="store_true",
        help="Re-download files even if they already exist",
    )

    serve_parser = subparsers.add_parser("serve", help="Serve the local model directory over HTTP")
    serve_parser.add_argument(
        "--port",
        type=int,
        default=DEFAULT_PORT,
        help=f"Port to listen on (default: {DEFAULT_PORT})",
    )

    args = parser.parse_args()

    if args.command == "download":
        download_all(force=args.force)
        return

    if args.command == "serve":
        serve(args.port)
        return

    parser.error(f"Unknown command: {args.command}")


if __name__ == "__main__":
    main()
