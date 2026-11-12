import os
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FRONTEND_DIST = ROOT / "frontend" / "dist"
DIST_DIR = ROOT / "build" / "backend-dist"
WORK_DIR = ROOT / "build" / "pyinstaller"


def main():
    if not (FRONTEND_DIST / "index.html").is_file():
        raise SystemExit("Frontend não compilado. Execute npm run build na pasta frontend primeiro.")

    data_separator = ";" if os.name == "nt" else ":"
    command = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--clean",
        "--noconfirm",
        "--onedir",
        "--name",
        "inmoov-backend",
        "--distpath",
        str(DIST_DIR),
        "--workpath",
        str(WORK_DIR),
        "--specpath",
        str(ROOT / "build"),
        "--add-data",
        f"{FRONTEND_DIST}{data_separator}frontend/dist",
    ]

    for package in ("cv2", "cvzone", "mediapipe", "bleak", "uvicorn"):
        command.extend(("--collect-all", package))

    command.append(str(ROOT / "app.py"))
    subprocess.run(command, cwd=ROOT, check=True)


if __name__ == "__main__":
    main()
