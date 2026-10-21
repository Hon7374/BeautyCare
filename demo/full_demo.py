from __future__ import annotations

import ctypes
import json
import os
import shutil
import socket
import subprocess
import sys
import time
from ctypes import wintypes
from pathlib import Path

import bcrypt
import pyautogui
import pyotp
import requests
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
DEMO_DIR = ROOT / "demo"
RUNTIME_DIR = DEMO_DIR / "runtime"
CODE_SOURCE_DIR = RUNTIME_DIR / "code-source"
MYSQL_RUNTIME_DIR = RUNTIME_DIR / "mysql"
MYSQL_DATA_DIR = MYSQL_RUNTIME_DIR / "data"
MYSQL_LOG_FILE = MYSQL_RUNTIME_DIR / "mysql.log"
MYSQL_CONFIG_FILE = MYSQL_RUNTIME_DIR / "my.ini"
MYSQL_PID_FILE = MYSQL_RUNTIME_DIR / "mysql.pid"
SERVER_PID_FILE = RUNTIME_DIR / "backend-terminal.pid"
FFMPEG_LOG_FILE = RUNTIME_DIR / "ffmpeg.log"
STATE_FILE = RUNTIME_DIR / "full-demo-last-run.json"
BACKEND_DIR = ROOT / "backend"
BACKEND_OUTBOX_DIR = BACKEND_DIR / "outbox"
DB_SCHEMA_FILE = ROOT / "database" / "beautycare.mysql.sql"
VIDEO_FILE = DEMO_DIR / "beautycare-full-demo.mkv"
RUN_SCRIPT_FILE = DEMO_DIR / "run-full-demo.ps1"
RESULTS_FILE = DEMO_DIR / "demo-results.md"
README_FILE = DEMO_DIR / "README-full-demo.md"
RECORDING_TOOL = "ffmpeg gdigrab desktop capture"

BACKEND_WINDOW_TITLE = "BeautyCare Demo Server"
MYSQL_PORT_START = 3407
APP_PORT_START = 3000

DEMO_NAME = "Demo Full User"
UPDATED_DEMO_NAME = "Demo Full User Updated"
DEMO_PHONE = "0934567890"
DEMO_EMAIL = "demo.full@beautycare.local"
ORIGINAL_PASSWORD = "DemoPass1A"
NEW_PASSWORD = "DemoPass2A"
ADMIN_EMAIL = "khucmai51@gmail.com"
ADMIN_PASSWORD = "123456"
BOOKING_NOTE = "Full demo booking"
ADMIN_BOOKING_NOTE = "Confirmed in full demo"

CREATE_NEW_CONSOLE = 0x00000010
CREATE_NO_WINDOW = 0x08000000
SW_MINIMIZE = 6
SW_RESTORE = 9
HWND_TOPMOST = -1
HWND_NOTOPMOST = -2
SWP_NOSIZE = 0x0001
SWP_NOMOVE = 0x0002

user32 = ctypes.windll.user32
ACTIVE_BROWSER_HWND: int | None = None


class RECT(ctypes.Structure):
    _fields_ = [
        ("left", ctypes.c_long),
        ("top", ctypes.c_long),
        ("right", ctypes.c_long),
        ("bottom", ctypes.c_long),
    ]


def log(message: str) -> None:
    print(f"[demo] {message}", flush=True)


def ensure_runtime_dirs() -> None:
    for path in (DEMO_DIR, RUNTIME_DIR, CODE_SOURCE_DIR, MYSQL_RUNTIME_DIR):
        path.mkdir(parents=True, exist_ok=True)


def set_dpi_awareness() -> None:
    try:
        user32.SetProcessDPIAware()
    except Exception:
        pass


def read_pid(pid_file: Path) -> int | None:
    try:
        return int(pid_file.read_text(encoding="utf-8").strip())
    except Exception:
        return None


def write_pid(pid_file: Path, pid: int) -> None:
    pid_file.parent.mkdir(parents=True, exist_ok=True)
    pid_file.write_text(str(pid), encoding="utf-8")


def kill_process_tree(pid: int | None) -> None:
    if not pid:
        return
    subprocess.run(
        ["taskkill", "/PID", str(pid), "/T", "/F"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )


def cleanup_previous_demo_processes() -> None:
    for pid_file in (MYSQL_PID_FILE, SERVER_PID_FILE):
        kill_process_tree(read_pid(pid_file))
        try:
            pid_file.unlink()
        except FileNotFoundError:
            pass


def is_port_open(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.3)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def find_free_port(start: int, attempts: int = 25) -> int:
    for port in range(start, start + attempts):
        if not is_port_open(port):
            return port
    raise RuntimeError(f"Could not find a free port starting from {start}")


def run_command(
    command: list[str],
    *,
    cwd: Path | None = None,
    input_bytes: bytes | None = None,
    capture_output: bool = False,
    creationflags: int = 0,
) -> subprocess.CompletedProcess:
    return subprocess.run(
        command,
        cwd=str(cwd) if cwd else None,
        input=input_bytes,
        stdout=subprocess.PIPE if capture_output else None,
        stderr=subprocess.STDOUT if capture_output else None,
        creationflags=creationflags,
        check=True,
    )


def find_ffmpeg_path() -> Path:
    candidates: list[Path] = []
    from_path = shutil.which("ffmpeg")
    if from_path:
        candidates.append(Path(from_path))

    winget_root = Path(os.environ["LOCALAPPDATA"]) / "Microsoft" / "WinGet" / "Packages"
    if winget_root.exists():
        candidates.extend(winget_root.rglob("ffmpeg.exe"))

    for candidate in candidates:
        if candidate.exists():
            return candidate

    raise RuntimeError("ffmpeg.exe not found. Run demo/run-full-demo.ps1 to install it first.")


def find_mysql_binaries() -> tuple[Path, Path, Path]:
    base = Path(r"C:\Program Files\MySQL\MySQL Server 8.0\bin")
    mysqld = base / "mysqld.exe"
    mysql = base / "mysql.exe"
    mysqladmin = base / "mysqladmin.exe"

    missing = [str(path) for path in (mysqld, mysql, mysqladmin) if not path.exists()]
    if missing:
        raise RuntimeError(f"Missing MySQL binaries: {', '.join(missing)}")

    return mysqld, mysql, mysqladmin


def find_browser() -> tuple[Path, str]:
    candidates = [
        (Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"), "Chrome"),
        (Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"), "Chrome"),
        (Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"), "Edge"),
        (Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"), "Edge"),
    ]

    for path, label in candidates:
        if path.exists():
            return path, label

    raise RuntimeError("No supported desktop browser found. Chrome or Edge is required.")


def find_node_path() -> Path:
    node_path = shutil.which("node")
    if not node_path:
        raise RuntimeError("node.exe was not found in PATH.")
    return Path(node_path)


def ensure_backend_dependencies() -> None:
    if (BACKEND_DIR / "node_modules").exists():
        return

    log("backend/node_modules is missing. Running npm install...")
    run_command(["npm", "install"], cwd=BACKEND_DIR)


def mysql_config_text(port: int, mysqld_path: Path) -> str:
    basedir = mysqld_path.parent.parent.as_posix()
    datadir = MYSQL_DATA_DIR.as_posix()
    logfile = MYSQL_LOG_FILE.as_posix()
    pidfile = (MYSQL_RUNTIME_DIR / "mysqld.pid").as_posix()

    return "\n".join(
        [
            "[mysqld]",
            f"basedir={basedir}",
            f"datadir={datadir}",
            "bind-address=127.0.0.1",
            f"port={port}",
            "character-set-server=utf8mb4",
            "collation-server=utf8mb4_unicode_ci",
            "default-time-zone=+00:00",
            f"log-error={logfile}",
            f"pid-file={pidfile}",
        ]
    )


def wait_for(condition, timeout: float, interval: float, description: str) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if condition():
            return
        time.sleep(interval)
    raise TimeoutError(f"Timed out while waiting for {description}")


def initialize_demo_mysql(mysqld: Path, mysql: Path, mysqladmin: Path, db_port: int) -> subprocess.Popen:
    log(f"Preparing demo MySQL instance on port {db_port}...")

    if MYSQL_DATA_DIR.exists():
        shutil.rmtree(MYSQL_DATA_DIR)
    MYSQL_DATA_DIR.mkdir(parents=True, exist_ok=True)

    MYSQL_CONFIG_FILE.write_text(mysql_config_text(db_port, mysqld), encoding="utf-8")
    MYSQL_LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

    init_command = [
        str(mysqld),
        f"--basedir={mysqld.parent.parent}",
        f"--datadir={MYSQL_DATA_DIR}",
        "--initialize-insecure",
        f"--log-error={MYSQL_LOG_FILE}",
    ]
    run_command(init_command, capture_output=True, creationflags=CREATE_NO_WINDOW)

    log_handle = open(MYSQL_LOG_FILE, "ab")
    process = subprocess.Popen(
        [str(mysqld), f"--defaults-file={MYSQL_CONFIG_FILE}", "--console"],
        stdout=log_handle,
        stderr=subprocess.STDOUT,
        cwd=str(MYSQL_RUNTIME_DIR),
        creationflags=CREATE_NO_WINDOW,
    )
    write_pid(MYSQL_PID_FILE, process.pid)

    def mysql_ready() -> bool:
        if process.poll() is not None:
            return False
        result = subprocess.run(
            [
                str(mysqladmin),
                "--protocol=tcp",
                "-h",
                "127.0.0.1",
                "-P",
                str(db_port),
                "-u",
                "root",
                "ping",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
            creationflags=CREATE_NO_WINDOW,
        )
        return result.returncode == 0

    wait_for(mysql_ready, timeout=40, interval=1.0, description="demo MySQL to accept TCP connections")

    log("Importing project schema into demo MySQL...")
    with DB_SCHEMA_FILE.open("rb") as sql_input:
        run_command(
            [
                str(mysql),
                "--protocol=tcp",
                "-h",
                "127.0.0.1",
                "-P",
                str(db_port),
                "-u",
                "root",
                "--default-character-set=utf8mb4",
            ],
            input_bytes=sql_input.read(),
            creationflags=CREATE_NO_WINDOW,
        )

    return process


def sql_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("'", "''")


def create_demo_user(mysql: Path, db_port: int) -> None:
    log("Creating a fresh demo user for the security flow...")
    password_hash = bcrypt.hashpw(ORIGINAL_PASSWORD.encode("utf-8"), bcrypt.gensalt(rounds=10)).decode("utf-8")
    sql = f"""
USE beautycare;
INSERT INTO users (name, phone, email, password, role, member, email_verified, twofa_enabled, twofa_secret)
VALUES (
  '{sql_escape(DEMO_NAME)}',
  '{sql_escape(DEMO_PHONE)}',
  '{sql_escape(DEMO_EMAIL)}',
  '{sql_escape(password_hash)}',
  'user',
  'silver',
  0,
  0,
  NULL
);
"""
    run_command(
        [
            str(mysql),
            "--protocol=tcp",
            "-h",
            "127.0.0.1",
            "-P",
            str(db_port),
            "-u",
            "root",
            "--default-character-set=utf8mb4",
        ],
        input_bytes=sql.encode("utf-8"),
        creationflags=CREATE_NO_WINDOW,
    )


def clear_outbox() -> None:
    BACKEND_OUTBOX_DIR.mkdir(parents=True, exist_ok=True)
    for item in BACKEND_OUTBOX_DIR.glob("*.json"):
        item.unlink()


def ps_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def write_backend_bootstrap_script(app_port: int, db_port: int, node_path: Path) -> Path:
    script_path = RUNTIME_DIR / "start-backend-demo.ps1"
    app_url = f"http://localhost:{app_port}"

    script_text = "\n".join(
        [
            "$ErrorActionPreference = 'Stop'",
            f"$host.UI.RawUI.WindowTitle = {ps_literal(BACKEND_WINDOW_TITLE)}",
            f"Set-Location {ps_literal(str(BACKEND_DIR))}",
            f"$env:PORT = {ps_literal(str(app_port))}",
            "$env:DB_HOST = '127.0.0.1'",
            f"$env:DB_PORT = {ps_literal(str(db_port))}",
            "$env:DB_USER = 'root'",
            "$env:DB_PASSWORD = ''",
            "$env:DB_NAME = 'beautycare'",
            f"$env:API_BASE_URL = {ps_literal(app_url)}",
            f"$env:FRONTEND_URL = {ps_literal(app_url)}",
            f"$env:PUBLIC_APP_URL = {ps_literal(app_url)}",
            f"$env:CORS_ORIGINS = {ps_literal(app_url)}",
            "$env:AUTH_DEMO_MODE = 'false'",
            "$env:EMAIL_DELIVERY_MODE = 'outbox'",
            "$env:EMAIL_FALLBACK_TO_OUTBOX = 'true'",
            "$env:PAYMENTS_MODE = 'mock'",
            "Clear-Host",
            "Write-Host 'BeautyCare full demo backend' -ForegroundColor Cyan",
            f"Write-Host 'App URL: {app_url}' -ForegroundColor Yellow",
            f"Write-Host 'Demo DB port: {db_port}' -ForegroundColor DarkCyan",
            f"Write-Host 'Outbox: {BACKEND_OUTBOX_DIR}' -ForegroundColor Gray",
            "Write-Host ''",
            f"& {ps_literal(str(node_path))} server.js",
        ]
    )
    script_path.write_text(script_text, encoding="utf-8")
    return script_path


def start_backend_terminal(app_port: int, db_port: int, node_path: Path) -> subprocess.Popen:
    script_path = write_backend_bootstrap_script(app_port, db_port, node_path)
    log("Starting backend in a visible PowerShell window...")
    process = subprocess.Popen(
        [
            "powershell.exe",
            "-ExecutionPolicy",
            "Bypass",
            "-NoProfile",
            "-NoExit",
            "-File",
            str(script_path),
        ],
        creationflags=CREATE_NEW_CONSOLE,
    )
    write_pid(SERVER_PID_FILE, process.pid)
    return process


def wait_for_backend(app_port: int) -> None:
    app_url = f"http://127.0.0.1:{app_port}/api/health"

    def backend_ready() -> bool:
        try:
            response = requests.get(app_url, timeout=1.0)
            return response.ok
        except requests.RequestException:
            return False

    wait_for(backend_ready, timeout=90, interval=1.0, description="backend health endpoint")


def get_primary_screen_size() -> tuple[int, int]:
    return user32.GetSystemMetrics(0), user32.GetSystemMetrics(1)


def start_recording(ffmpeg_path: Path, screen_width: int, screen_height: int) -> subprocess.Popen:
    if VIDEO_FILE.exists():
        VIDEO_FILE.unlink()

    ffmpeg_log = open(FFMPEG_LOG_FILE, "ab")
    command = [
        str(ffmpeg_path),
        "-y",
        "-f",
        "gdigrab",
        "-framerate",
        "30",
        "-offset_x",
        "0",
        "-offset_y",
        "0",
        "-video_size",
        f"{screen_width}x{screen_height}",
        "-draw_mouse",
        "1",
        "-i",
        "desktop",
        "-vf",
        "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,format=yuv420p",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-crf",
        "24",
        str(VIDEO_FILE),
    ]

    log("Starting desktop recording...")
    process = subprocess.Popen(
        command,
        stdin=subprocess.PIPE,
        stdout=ffmpeg_log,
        stderr=subprocess.STDOUT,
        creationflags=CREATE_NO_WINDOW,
    )
    time.sleep(2.0)
    if process.poll() is not None:
        raise RuntimeError("ffmpeg failed to start desktop recording. See demo/runtime/ffmpeg.log")
    return process


def start_window_recording(ffmpeg_path: Path, hwnd: int) -> subprocess.Popen:
    if VIDEO_FILE.exists():
        VIDEO_FILE.unlink()

    ffmpeg_log = open(FFMPEG_LOG_FILE, "ab")
    command = [
        str(ffmpeg_path),
        "-y",
        "-f",
        "gdigrab",
        "-framerate",
        "30",
        "-draw_mouse",
        "1",
        "-i",
        f"hwnd={hwnd}",
        "-vf",
        "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,format=yuv420p",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-crf",
        "24",
        str(VIDEO_FILE),
    ]

    log("Starting browser-window recording...")
    process = subprocess.Popen(
        command,
        stdin=subprocess.PIPE,
        stdout=ffmpeg_log,
        stderr=subprocess.STDOUT,
        creationflags=CREATE_NO_WINDOW,
    )
    time.sleep(2.0)
    if process.poll() is not None:
        raise RuntimeError("ffmpeg failed to start browser-window recording. See demo/runtime/ffmpeg.log")
    return process


def stop_recording(process: subprocess.Popen | None) -> None:
    if process is None or process.poll() is not None:
        return

    log("Stopping desktop recording...")
    try:
        assert process.stdin is not None
        process.stdin.write(b"q\n")
        process.stdin.flush()
        process.wait(timeout=15)
    except Exception:
        process.kill()
        process.wait(timeout=5)


def list_visible_windows() -> list[tuple[int, str, tuple[int, int, int, int]]]:
    windows: list[tuple[int, str, tuple[int, int, int, int]]] = []

    @ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
    def callback(hwnd: int, _lparam: int) -> bool:
        if not user32.IsWindowVisible(hwnd):
            return True

        length = user32.GetWindowTextLengthW(hwnd)
        if length == 0:
            return True

        buffer = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buffer, length + 1)
        title = buffer.value.strip()
        if not title:
            return True

        rect = RECT()
        user32.GetWindowRect(hwnd, ctypes.byref(rect))
        windows.append((hwnd, title, (rect.left, rect.top, rect.right, rect.bottom)))
        return True

    user32.EnumWindows(callback, 0)
    return windows


def wait_for_window(title_match: str, timeout: float = 20.0) -> int:
    deadline = time.time() + timeout
    while time.time() < deadline:
        for hwnd, title, _rect in list_visible_windows():
            if title_match.lower() in title.lower():
                return hwnd
        time.sleep(0.5)
    raise TimeoutError(f"Could not find a visible window containing '{title_match}'")


def get_window_rect(hwnd: int) -> tuple[int, int, int, int]:
    rect = RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(rect))
    return rect.left, rect.top, rect.right, rect.bottom


def move_window(hwnd: int, x: int, y: int, width: int, height: int) -> None:
    user32.ShowWindow(hwnd, SW_RESTORE)
    user32.MoveWindow(hwnd, x, y, width, height, True)
    user32.SetForegroundWindow(hwnd)


def set_window_topmost(hwnd: int, enabled: bool = True) -> None:
    insert_after = HWND_TOPMOST if enabled else HWND_NOTOPMOST
    user32.SetWindowPos(hwnd, insert_after, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE)


def minimize_window(hwnd: int) -> None:
    user32.ShowWindow(hwnd, SW_MINIMIZE)


def locate_browser_window(browser_label: str) -> int:
    candidates = []
    for hwnd, title, _rect in list_visible_windows():
        lower = title.lower()
        if "beautycare" in lower and browser_label.lower() in lower:
            candidates.append(hwnd)
    if candidates:
        return candidates[-1]

    for hwnd, title, _rect in list_visible_windows():
        lower = title.lower()
        if browser_label.lower() in lower:
            candidates.append(hwnd)
    if candidates:
        return candidates[-1]

    raise RuntimeError(f"Could not locate the {browser_label} browser window.")


def wait_for_new_browser_window(browser_label: str, existing_hwnds: set[int], timeout: float = 20.0) -> int:
    deadline = time.time() + timeout
    while time.time() < deadline:
        for hwnd, title, _rect in list_visible_windows():
            lower = title.lower()
            if hwnd in existing_hwnds:
                continue
            if browser_label.lower() in lower:
                return hwnd
        time.sleep(0.5)
    return locate_browser_window(browser_label)


def browser_viewport_origin(page, browser_label: str) -> tuple[float, float]:
    hwnd = ACTIVE_BROWSER_HWND or locate_browser_window(browser_label)
    left, top, right, bottom = get_window_rect(hwnd)
    metrics = page.evaluate(
        """() => ({
            outerWidth: window.outerWidth,
            innerWidth: window.innerWidth,
            outerHeight: window.outerHeight,
            innerHeight: window.innerHeight
        })"""
    )

    border_x = max((metrics["outerWidth"] - metrics["innerWidth"]) / 2.0, 0)
    chrome_y = max(metrics["outerHeight"] - metrics["innerHeight"], 0)
    return left + border_x, top + chrome_y


def hover_locator(page, locator, browser_label: str, duration: float = 0.35) -> None:
    locator.wait_for(state="visible", timeout=10000)
    locator.scroll_into_view_if_needed()
    page.wait_for_timeout(150)

    box = locator.bounding_box()
    if not box:
        raise RuntimeError("Could not determine locator bounding box.")

    viewport_left, viewport_top = browser_viewport_origin(page, browser_label)
    x = viewport_left + box["x"] + (box["width"] / 2.0)
    y = viewport_top + box["y"] + (box["height"] / 2.0)
    pyautogui.moveTo(x, y, duration=duration)
    time.sleep(0.15)


def click_locator(page, selector: str, browser_label: str, wait_after: float = 0.8) -> None:
    locator = page.locator(selector)
    hover_locator(page, locator, browser_label)
    locator.click()
    time.sleep(wait_after)


def type_into(page, selector: str, value: str, browser_label: str, clear: bool = True) -> None:
    locator = page.locator(selector)
    hover_locator(page, locator, browser_label)
    locator.click()
    time.sleep(0.15)
    if clear:
        page.keyboard.press("Control+A")
        page.keyboard.press("Backspace")
    page.keyboard.type(value, delay=55)
    time.sleep(0.2)


def write_code_source_file(filename: str, lines: list[str]) -> Path:
    path = CODE_SOURCE_DIR / filename
    path.write_text("\n".join(lines).strip() + "\n", encoding="utf-8")
    return path


def show_code_source_overlay(page, title: str, lines: list[str], pause_seconds: float = 2.8) -> None:
    page.evaluate(
        """payload => {
            const existing = document.getElementById('demo-code-source-overlay');
            if (existing) existing.remove();

            const overlay = document.createElement('div');
            overlay.id = 'demo-code-source-overlay';
            overlay.style.position = 'fixed';
            overlay.style.inset = '0';
            overlay.style.zIndex = '2147483647';
            overlay.style.pointerEvents = 'none';
            overlay.style.background = 'rgba(15, 23, 42, 0.18)';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'flex-start';
            overlay.style.justifyContent = 'center';
            overlay.style.padding = '48px';

            const card = document.createElement('div');
            card.style.width = 'min(1080px, 92vw)';
            card.style.background = 'rgba(255,255,255,0.97)';
            card.style.border = '1px solid rgba(148,163,184,0.35)';
            card.style.borderRadius = '24px';
            card.style.boxShadow = '0 24px 60px rgba(15, 23, 42, 0.22)';
            card.style.padding = '28px 32px';
            card.style.fontFamily = "Consolas, 'Courier New', monospace";
            card.style.color = '#0f172a';
            card.style.backdropFilter = 'blur(8px)';

            const heading = document.createElement('div');
            heading.textContent = payload.title;
            heading.style.fontSize = '24px';
            heading.style.fontWeight = '700';
            heading.style.marginBottom = '18px';
            card.appendChild(heading);

            for (const rawLine of payload.lines) {
                if (!rawLine) {
                    const spacer = document.createElement('div');
                    spacer.style.height = '12px';
                    card.appendChild(spacer);
                    continue;
                }
                const line = document.createElement('div');
                line.textContent = rawLine;
                line.style.fontSize = '18px';
                line.style.lineHeight = '1.55';
                line.style.marginBottom = '8px';
                line.style.whiteSpace = 'pre-wrap';
                line.style.wordBreak = 'break-word';
                card.appendChild(line);
            }

            overlay.appendChild(card);
            document.body.appendChild(overlay);
        }""",
        {"title": title, "lines": lines},
    )
    pause(pause_seconds)
    page.evaluate(
        """() => {
            const overlay = document.getElementById('demo-code-source-overlay');
            if (overlay) overlay.remove();
        }"""
    )
    time.sleep(0.3)


def wait_for_outbox_record(expected_type: str, timeout: float = 20.0) -> tuple[str, Path, dict]:
    deadline = time.time() + timeout
    while time.time() < deadline:
        files = sorted(BACKEND_OUTBOX_DIR.glob("*.json"), key=lambda path: path.stat().st_mtime, reverse=True)
        for file in files:
            try:
                payload = json.loads(file.read_text(encoding="utf-8"))
            except Exception:
                continue

            meta = payload.get("meta") or {}
            if meta.get("type") == expected_type and meta.get("token"):
                return str(meta["token"]), file, payload
        time.sleep(0.5)
    raise TimeoutError(f"Timed out while waiting for an outbox token of type '{expected_type}'")


def wait_for_outbox_token(expected_type: str, timeout: float = 20.0) -> str:
    token, _file, _payload = wait_for_outbox_record(expected_type, timeout=timeout)
    return token


def seed_browser_profile(profile_dir: Path) -> None:
    default_dir = profile_dir / "Default"
    default_dir.mkdir(parents=True, exist_ok=True)

    preferences = {
        "autofill": {
            "credit_card_enabled": False,
            "profile_enabled": False,
        },
        "browser": {
            "check_default_browser": False,
        },
        "credentials_enable_service": False,
        "distribution": {
            "skip_first_run_ui": True,
        },
        "profile": {
            "password_manager_enabled": False,
        },
        "translate": {
            "enabled": False,
        },
    }

    local_state = {
        "browser": {
            "enabled_labs_experiments": [],
        }
    }

    (default_dir / "Preferences").write_text(json.dumps(preferences, indent=2), encoding="utf-8")
    (profile_dir / "Local State").write_text(json.dumps(local_state, indent=2), encoding="utf-8")


def save_state(app_port: int, db_port: int, browser_path: Path) -> None:
    payload = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "video": str(VIDEO_FILE),
        "script": str(RUN_SCRIPT_FILE),
        "appUrl": f"http://localhost:{app_port}",
        "dbPort": db_port,
        "browser": str(browser_path),
        "demoUser": {
            "email": DEMO_EMAIL,
            "phone": DEMO_PHONE,
        },
    }
    STATE_FILE.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def pause(seconds: float = 1.2) -> None:
    time.sleep(seconds)


def click_target(page, locator, browser_label: str, wait_after: float = 0.8) -> None:
    hover_locator(page, locator, browser_label)
    locator.click()
    time.sleep(wait_after)


def dismiss_browser_popup() -> None:
    pyautogui.press("esc")
    time.sleep(0.25)


def enter_browser_fullscreen(hwnd: int) -> None:
    user32.SetForegroundWindow(hwnd)
    time.sleep(0.25)
    pyautogui.press("f11")
    time.sleep(0.8)


def select_option(page, selector: str, value: str, browser_label: str, wait_after: float = 0.8) -> None:
    locator = page.locator(selector)
    hover_locator(page, locator, browser_label)
    locator.select_option(value=value)
    time.sleep(wait_after)


def set_page_zoom(page, factor: float) -> None:
    page.evaluate(
        """zoomFactor => {
            document.body.style.zoom = String(zoomFactor);
        }""",
        factor,
    )
    time.sleep(0.3)


def fit_page_to_window(page, width: int, height: int) -> None:
    viewport_width = max(1280, int(width) - 24)
    viewport_height = max(720, int(height) - 120)
    page.set_viewport_size({"width": viewport_width, "height": viewport_height})
    time.sleep(0.4)


def apply_demo_auth_layout(page) -> None:
    page.evaluate(
        """() => {
            let styleTag = document.getElementById('demo-auth-layout');
            if (!styleTag) {
                styleTag = document.createElement('style');
                styleTag.id = 'demo-auth-layout';
                document.head.appendChild(styleTag);
            }
            styleTag.textContent = `
                .auth-shell { grid-template-columns: 1fr 1fr !important; }
                .auth-hero { padding: 32px !important; }
                .auth-hero .hero-card { max-width: 640px !important; }
                .auth-panel {
                    justify-content: flex-start !important;
                    align-items: center !important;
                    padding: 32px !important;
                }
                .auth-box { width: min(560px, 100%) !important; }
            `;
        }"""
    )
    time.sleep(0.3)


def fresh_totp_code(totp: pyotp.TOTP, min_remaining: int = 8) -> str:
    remaining = 30 - (int(time.time()) % 30)
    if remaining < min_remaining:
        time.sleep(remaining + 1)
    return totp.now()


def append_result(results: list[dict[str, str]], group: str, feature: str, status: str, detail: str) -> None:
    results.append(
        {
            "group": group,
            "feature": feature,
            "status": status,
            "detail": detail,
        }
    )


def write_results_markdown(
    results: list[dict[str, str]],
    *,
    app_port: int,
    db_port: int,
    browser_path: Path,
) -> None:
    skipped = [
        {
            "group": "cart/order/payment",
            "feature": "External checkout completion",
            "reason": "Skipped in automation because the active repo flow depends on payment-provider style checkout and no provider callback was required for this local desktop demo.",
        },
        {
            "group": "membership",
            "feature": "Membership purchase flow",
            "reason": "Skipped because it leads into payment/provider flows that are outside the stable local demo path.",
        },
        {
            "group": "admin",
            "feature": "Discounts, subscriptions, reports, vouchers CRUD",
            "reason": "Skipped to keep the recorded flow compact after covering the more critical user + booking + security + admin-confirmation path.",
        },
    ]

    pass_items = [item for item in results if item["status"] == "pass"]
    fail_items = [item for item in results if item["status"] == "fail"]

    lines = [
        "# BeautyCare Full Demo Results",
        "",
        f"- Run time: `{time.strftime('%Y-%m-%d %H:%M:%S')}`",
        f"- Recording tool: `{RECORDING_TOOL}`",
        f"- App URL: `http://localhost:{app_port}`",
        f"- Demo DB port: `{db_port}`",
        f"- Browser: `{browser_path}`",
        f"- Video: `{VIDEO_FILE}`",
        f"- Script: `{RUN_SCRIPT_FILE}`",
        "",
        "## Passed",
        "",
    ]

    if pass_items:
        for item in pass_items:
            lines.append(f"- `{item['group']}` {item['feature']}: {item['detail']}")
    else:
        lines.append("- No successful steps were recorded.")

    lines.extend(["", "## Failed", ""])
    if fail_items:
        for item in fail_items:
            lines.append(f"- `{item['group']}` {item['feature']}: {item['detail']}")
    else:
        lines.append("- None")

    lines.extend(["", "## Skipped", ""])
    for item in skipped:
        lines.append(f"- `{item['group']}` {item['feature']}: {item['reason']}")

    RESULTS_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")


def run_demo_flow(app_port: int, browser_path: Path, browser_label: str) -> list[dict[str, str]]:
    global ACTIVE_BROWSER_HWND
    results: list[dict[str, str]] = []
    profile_dir = RUNTIME_DIR / "browser-profile"
    if profile_dir.exists():
        shutil.rmtree(profile_dir)
    profile_dir.mkdir(parents=True, exist_ok=True)
    seed_browser_profile(profile_dir)

    screen_width, screen_height = get_primary_screen_size()
    terminal_width = max(320, int(screen_width * 0.24))
    browser_width = max(820, screen_width - terminal_width)

    terminal_hwnd = wait_for_window(BACKEND_WINDOW_TITLE, timeout=20.0)
    move_window(terminal_hwnd, 0, 0, terminal_width, screen_height)
    pause(1.0)

    with sync_playwright() as playwright:
        existing_hwnds = {hwnd for hwnd, _title, _rect in list_visible_windows()}
        context = playwright.chromium.launch_persistent_context(
            user_data_dir=str(profile_dir),
            executable_path=str(browser_path),
            headless=False,
            viewport=None,
            chromium_sandbox=True,
            ignore_default_args=["--enable-automation"],
            args=[
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-gpu",
                "--disable-gpu-compositing",
                "--disable-notifications",
                "--disable-session-crashed-bubble",
                "--disable-features=Translate,TranslateUI,AutofillServerCommunication,PasswordGeneration,PasswordManagerOnboarding",
                "--force-device-scale-factor=1",
                "--high-dpi-support=1",
                f"--window-size={browser_width},{screen_height}",
                f"--window-position={terminal_width},0",
            ],
        )
        try:
            page = context.pages[0] if context.pages else context.new_page()
            page.goto(f"http://localhost:{app_port}/index.html", wait_until="domcontentloaded")
            page.wait_for_load_state("networkidle")
            browser_hwnd = wait_for_new_browser_window(browser_label, existing_hwnds, timeout=20.0)
            ACTIVE_BROWSER_HWND = browser_hwnd
            move_window(browser_hwnd, terminal_width, 0, browser_width, screen_height)
            set_window_topmost(browser_hwnd, True)
            fit_page_to_window(page, browser_width, screen_height)

            pause(2.0)
            page.mouse.wheel(0, 900)
            pause(1.2)
            page.mouse.wheel(0, -900)
            pause(1.0)
            append_result(results, "public", "Landing page", "pass", "Opened the public homepage and showed featured sections.")

            minimize_window(terminal_hwnd)
            pause(0.8)
            move_window(browser_hwnd, 0, 0, screen_width, screen_height)
            set_window_topmost(browser_hwnd, True)
            enter_browser_fullscreen(browser_hwnd)
            fit_page_to_window(page, screen_width, screen_height)
            pause(1.2)

            click_target(page, page.locator("#navLoginBtn"), browser_label, wait_after=0.8)
            page.wait_for_url(f"http://localhost:{app_port}/login.html", timeout=15000)
            fit_page_to_window(page, screen_width, screen_height)
            apply_demo_auth_layout(page)
            set_page_zoom(page, 1.0)
            pause(1.0)
            click_target(page, page.locator('a[href="register.html"]').first, browser_label, wait_after=0.8)
            page.wait_for_url(f"http://localhost:{app_port}/register.html", timeout=15000)
            fit_page_to_window(page, screen_width, screen_height)
            apply_demo_auth_layout(page)
            set_page_zoom(page, 1.0)
            pause(1.0)

            type_into(page, "#name", DEMO_NAME, browser_label, clear=True)
            type_into(page, "#phone", DEMO_PHONE, browser_label, clear=True)
            type_into(page, "#email", DEMO_EMAIL, browser_label, clear=True)
            type_into(page, "#password", ORIGINAL_PASSWORD, browser_label, clear=True)
            click_locator(page, "#btnRegister", browser_label, wait_after=1.0)
            dismiss_browser_popup()
            page.wait_for_url(f"http://localhost:{app_port}/user/services.html", timeout=20000)
            fit_page_to_window(page, screen_width, screen_height)
            set_page_zoom(page, 1.0)
            pause(1.6)
            append_result(results, "auth", "Register", "pass", f"Created `{DEMO_EMAIL}` via the real register form.")

            page.locator("#serviceList .service-card").first.wait_for(state="visible", timeout=20000)
            page.mouse.wheel(0, 520)
            pause(1.0)
            page.mouse.wheel(0, -520)
            pause(0.8)
            categories = page.locator("#svcCats .cat-item")
            if categories.count() > 1:
                click_target(page, categories.nth(1), browser_label, wait_after=0.8)
                pause(0.8)
            type_into(page, "#q", "massage", browser_label, clear=True)
            pause(1.0)
            type_into(page, "#q", "", browser_label, clear=True)
            pause(1.0)
            append_result(results, "services", "Browse and filter services", "pass", "Filtered service categories and search on the user services page.")

            click_target(page, page.locator('a[href*="/user/service-detail.html"]').first, browser_label, wait_after=1.0)
            page.wait_for_function("() => window.location.pathname === '/user/service-detail.html'", timeout=15000)
            pause(1.8)
            append_result(results, "services", "Service detail", "pass", "Opened a real service detail page from the listing.")

            click_locator(page, "#btnBook", browser_label, wait_after=1.0)
            page.wait_for_url(f"http://localhost:{app_port}/user/booking.html", timeout=15000)
            pause(1.0)

            available_days = page.locator("#bkCalendar .day-chip:not(.full)")
            available_days.first.wait_for(state="visible", timeout=10000)
            click_target(page, available_days.first, browser_label, wait_after=0.8)

            first_slot = page.evaluate(
                """() => {
                    const options = Array.from(document.querySelectorAll('#bkTime option'));
                    const match = options.find((option) => !option.disabled && option.value);
                    return match ? match.value : '';
                }"""
            )
            if not first_slot:
                raise RuntimeError("Could not find an available booking time slot.")
            select_option(page, "#bkTime", first_slot, browser_label, wait_after=0.4)
            type_into(page, "#bkNote", BOOKING_NOTE, browser_label, clear=True)
            click_locator(page, "#bkSubmit", browser_label, wait_after=1.0)
            page.wait_for_function(
                """note => {
                    const body = document.getElementById('myBookingsBody');
                    return !!body && body.innerText.includes(note);
                }""",
                arg=BOOKING_NOTE,
                timeout=15000,
            )
            pause(1.2)
            append_result(results, "booking", "Create booking", "pass", f"Created a user booking with note `{BOOKING_NOTE}`.")

            click_locator(page, 'a[data-nav="profile.html"]', browser_label, wait_after=1.0)
            page.wait_for_url(f"http://localhost:{app_port}/user/profile.html", timeout=15000)
            pause(0.8)
            type_into(page, "#pfName", UPDATED_DEMO_NAME, browser_label, clear=True)
            click_locator(page, "#btnSaveProfile", browser_label, wait_after=1.0)
            page.wait_for_function(
                """expected => {
                    const raw = localStorage.getItem('user');
                    if (!raw) return false;
                    try { return JSON.parse(raw).name === expected; } catch (_) { return false; }
                }""",
                arg=UPDATED_DEMO_NAME,
                timeout=10000,
            )
            pause(1.0)
            append_result(results, "account", "Update profile", "pass", f"Updated the profile name to `{UPDATED_DEMO_NAME}`.")

            click_locator(page, 'a[data-nav="security.html"]', browser_label, wait_after=1.0)
            page.wait_for_url(f"http://localhost:{app_port}/user/security.html", timeout=15000)
            pause(1.0)

            clear_outbox()
            click_locator(page, "#btnRequestVerifyEmail", browser_label, wait_after=1.0)
            verify_token, verify_file, _verify_payload = wait_for_outbox_record("verify-email", timeout=20.0)
            verify_source_lines = [
                f"Source folder: {BACKEND_OUTBOX_DIR}",
                f"Source file: {verify_file}",
                "Field used in UI: meta.token",
                "",
                f"Token to paste: {verify_token}",
            ]
            write_code_source_file("email-verify-source.txt", ["EMAIL VERIFY CODE SOURCE", "", *verify_source_lines])
            show_code_source_overlay(
                page,
                "Email Verify Code Source",
                verify_source_lines,
            )
            type_into(page, "#verifyToken", verify_token, browser_label, clear=True)
            click_locator(page, "#btnVerifyEmailToken", browser_label, wait_after=1.0)
            page.wait_for_function(
                """() => {
                    const raw = localStorage.getItem('user');
                    if (!raw) return false;
                    try { return JSON.parse(raw).email_verified === true; } catch (_) { return false; }
                }""",
                timeout=10000,
            )
            pause(1.0)
            append_result(results, "security", "Verify email", "pass", "Requested a verification token from outbox and completed email verification.")

            click_locator(page, "#btnSetup2FA", browser_label, wait_after=1.0)
            page.wait_for_function("() => Boolean(document.getElementById('twofaSecret')?.value)", timeout=10000)
            secret = page.locator("#twofaSecret").input_value().strip()
            if not secret:
                raise RuntimeError("2FA secret was not rendered in the UI.")

            totp = pyotp.TOTP(secret)
            enable_otp = fresh_totp_code(totp, min_remaining=16)
            enable_otp_lines = [
                "Secret source: current Security page field #twofaSecret",
                f"Secret shown on page: {secret}",
                "Code generation: pyotp.TOTP(secret).now()",
                "",
                f"OTP to paste now: {enable_otp}",
            ]
            write_code_source_file("twofa-enable-source.txt", ["2FA ENABLE CODE SOURCE", "", *enable_otp_lines])
            show_code_source_overlay(
                page,
                "2FA Enable Code Source",
                enable_otp_lines,
            )
            type_into(page, "#twofaOtp", enable_otp, browser_label, clear=True)
            click_locator(page, "#btnEnable2FA", browser_label, wait_after=1.0)
            page.wait_for_function(
                """() => {
                    const raw = localStorage.getItem('user');
                    if (!raw) return false;
                    try { return JSON.parse(raw).twofa_enabled === true; } catch (_) { return false; }
                }""",
                timeout=10000,
            )
            pause(1.0)
            append_result(results, "security", "Enable 2FA", "pass", "Generated a TOTP secret and enabled 2FA from the account security page.")

            type_into(page, "#currentPassword", ORIGINAL_PASSWORD, browser_label, clear=True)
            type_into(page, "#newPassword", NEW_PASSWORD, browser_label, clear=True)
            type_into(page, "#confirmNewPassword", NEW_PASSWORD, browser_label, clear=True)
            click_locator(page, "#btnChangePassword", browser_label, wait_after=1.0)
            dismiss_browser_popup()
            page.wait_for_url(f"http://localhost:{app_port}/login.html", timeout=20000)
            fit_page_to_window(page, screen_width, screen_height)
            apply_demo_auth_layout(page)
            set_page_zoom(page, 1.0)
            pause(1.2)
            append_result(results, "security", "Change password", "pass", "Changed the password through the UI and was redirected to login.")

            type_into(page, "#email", DEMO_EMAIL, browser_label, clear=True)
            type_into(page, "#password", NEW_PASSWORD, browser_label, clear=True)
            click_locator(page, "#btnLogin", browser_label, wait_after=1.0)
            dismiss_browser_popup()
            page.wait_for_function(
                """() => {
                    const box = document.getElementById('otpBox');
                    return !!box && window.getComputedStyle(box).display !== 'none';
                }""",
                timeout=10000,
            )
            pause(0.8)
            login_otp = fresh_totp_code(totp, min_remaining=16)
            login_otp_lines = [
                "Secret source: saved secret from Security page setup step",
                f"Secret used: {secret}",
                "Code generation: pyotp.TOTP(secret).now()",
                "",
                f"OTP to paste now: {login_otp}",
            ]
            write_code_source_file("twofa-login-source.txt", ["2FA LOGIN CODE SOURCE", "", *login_otp_lines])
            show_code_source_overlay(
                page,
                "2FA Login Code Source",
                login_otp_lines,
            )
            apply_demo_auth_layout(page)
            fit_page_to_window(page, screen_width, screen_height)
            set_page_zoom(page, 1.0)
            type_into(page, "#otp", login_otp, browser_label, clear=True)
            click_locator(page, "#btnLogin", browser_label, wait_after=1.0)
            dismiss_browser_popup()
            page.wait_for_url(f"http://localhost:{app_port}/user/services.html", timeout=20000)
            pause(1.0)
            append_result(results, "auth", "Login with 2FA", "pass", "Logged in again using the new password plus a live OTP code.")

            click_locator(page, 'a[data-nav="security.html"]', browser_label, wait_after=1.0)
            page.wait_for_url(f"http://localhost:{app_port}/user/security.html", timeout=15000)
            pause(0.8)
            disable_otp = fresh_totp_code(totp, min_remaining=16)
            disable_otp_lines = [
                "Secret source: saved secret from Security page setup step",
                f"Secret used: {secret}",
                "Code generation: pyotp.TOTP(secret).now()",
                "",
                f"OTP to paste now: {disable_otp}",
            ]
            write_code_source_file("twofa-disable-source.txt", ["2FA DISABLE CODE SOURCE", "", *disable_otp_lines])
            show_code_source_overlay(
                page,
                "2FA Disable Code Source",
                disable_otp_lines,
            )
            type_into(page, "#twofaOtp", disable_otp, browser_label, clear=True)
            click_locator(page, "#btnDisable2FA", browser_label, wait_after=1.0)
            page.wait_for_function(
                """() => {
                    const raw = localStorage.getItem('user');
                    if (!raw) return false;
                    try { return JSON.parse(raw).twofa_enabled === false; } catch (_) { return false; }
                }""",
                timeout=10000,
            )
            pause(1.0)
            append_result(results, "security", "Disable 2FA", "pass", "Disabled 2FA after proving the OTP login flow.")

            click_locator(page, ".js-logout", browser_label, wait_after=1.0)
            page.wait_for_url(f"http://localhost:{app_port}/login.html", timeout=15000)
            fit_page_to_window(page, screen_width, screen_height)
            apply_demo_auth_layout(page)
            set_page_zoom(page, 1.0)
            pause(0.8)
            append_result(results, "auth", "Logout", "pass", "Logged out cleanly before switching to the admin flow.")

            type_into(page, "#email", ADMIN_EMAIL, browser_label, clear=True)
            type_into(page, "#password", ADMIN_PASSWORD, browser_label, clear=True)
            click_locator(page, "#btnLogin", browser_label, wait_after=1.0)
            dismiss_browser_popup()
            page.wait_for_url(f"http://localhost:{app_port}/admin/users.html", timeout=20000)
            fit_page_to_window(page, screen_width, screen_height)
            set_page_zoom(page, 1.0)
            pause(1.0)
            append_result(results, "admin", "Admin login", "pass", f"Signed in as `{ADMIN_EMAIL}`.")

            type_into(page, "#searchUsers", DEMO_EMAIL, browser_label, clear=True)
            page.wait_for_function(
                """email => {
                    const body = document.getElementById('usersBody');
                    return !!body && body.innerText.includes(email);
                }""",
                arg=DEMO_EMAIL,
                timeout=10000,
            )
            pause(0.8)
            append_result(results, "admin", "Find demo user", "pass", "Searched the admin users table for the newly registered account.")

            click_locator(page, 'a[data-nav="bookings.html"]', browser_label, wait_after=1.0)
            page.wait_for_url(f"http://localhost:{app_port}/admin/bookings.html", timeout=15000)
            pause(1.0)
            type_into(page, "#searchBookings", DEMO_EMAIL, browser_label, clear=True)
            page.wait_for_function("() => document.querySelector('#bookingsBody .js-update-booking') !== null", timeout=10000)
            booking_id = page.locator("#bookingsBody .js-update-booking").first.get_attribute("data-id")
            if not booking_id:
                raise RuntimeError("Could not locate the booking row in the admin table.")
            select_option(page, f"#bkSt_{booking_id}", "confirmed", browser_label, wait_after=0.4)
            type_into(page, f"#bkNote_{booking_id}", ADMIN_BOOKING_NOTE, browser_label, clear=True)
            click_target(page, page.locator(f'.js-update-booking[data-id="{booking_id}"]'), browser_label, wait_after=1.2)
            page.wait_for_function(
                """email => {
                    const rows = Array.from(document.querySelectorAll('#bookingsBody tr'));
                    const row = rows.find((item) => item.innerText.includes(email));
                    if (!row) return false;
                    const select = row.querySelector('select');
                    return !!select && select.value === 'confirmed';
                }""",
                arg=DEMO_EMAIL,
                timeout=12000,
            )
            pause(1.0)
            append_result(results, "admin", "Confirm booking", "pass", "Confirmed the user's booking and saved an admin note from the admin console.")

            click_locator(page, 'a[data-nav="services.html"]', browser_label, wait_after=1.0)
            page.wait_for_url(f"http://localhost:{app_port}/admin/services.html", timeout=15000)
            page.wait_for_function("() => document.querySelectorAll('#servicesBody tr').length > 0", timeout=10000)
            pause(1.0)
            append_result(results, "admin", "View service management", "pass", "Opened the admin services management table.")

            click_locator(page, ".js-logout", browser_label, wait_after=1.0)
            page.wait_for_url(f"http://localhost:{app_port}/login.html", timeout=15000)
            fit_page_to_window(page, screen_width, screen_height)
            apply_demo_auth_layout(page)
            set_page_zoom(page, 1.0)
            pause(0.8)

            type_into(page, "#email", DEMO_EMAIL, browser_label, clear=True)
            type_into(page, "#password", NEW_PASSWORD, browser_label, clear=True)
            click_locator(page, "#btnLogin", browser_label, wait_after=1.0)
            dismiss_browser_popup()
            page.wait_for_url(f"http://localhost:{app_port}/user/services.html", timeout=20000)
            fit_page_to_window(page, screen_width, screen_height)
            set_page_zoom(page, 1.0)
            pause(1.0)
            append_result(results, "auth", "Login after disabling 2FA", "pass", "Logged in with password only after turning 2FA off.")

            click_locator(page, 'a[data-nav="booking.html"]', browser_label, wait_after=1.0)
            page.wait_for_url(f"http://localhost:{app_port}/user/booking.html", timeout=15000)
            page.wait_for_function(
                """note => {
                    const body = document.getElementById('myBookingsBody');
                    return !!body && body.innerText.includes(note);
                }""",
                arg=ADMIN_BOOKING_NOTE,
                timeout=15000,
            )
            pause(1.0)
            append_result(results, "booking", "See confirmed booking", "pass", "Returned as the user and saw the admin-confirmed booking with its note.")

            page.once("dialog", lambda dialog: dialog.accept())
            click_target(page, page.locator("#myBookingsBody .js-cancel").first, browser_label, wait_after=1.0)
            page.wait_for_function(
                """note => {
                    const body = document.getElementById('myBookingsBody');
                    if (!body) return false;
                    if (body.innerText.includes('ChÆ°a cÃ³ lá»‹ch háº¹n nÃ o.')) return true;
                    return !body.innerText.includes(note);
                }""",
                arg=BOOKING_NOTE,
                timeout=15000,
            )
            pause(1.2)
            append_result(results, "booking", "Cancel booking", "pass", "Cancelled the booking from the user booking page.")

            click_locator(page, ".js-logout", browser_label, wait_after=1.0)
            page.wait_for_url(f"http://localhost:{app_port}/login.html", timeout=15000)
            fit_page_to_window(page, screen_width, screen_height)
            apply_demo_auth_layout(page)
            set_page_zoom(page, 1.0)
            pause(1.0)
            append_result(results, "auth", "Final logout", "pass", "Finished the demo on the login page while the app kept running.")
        finally:
            ACTIVE_BROWSER_HWND = None
            context.close()

    return results


def main() -> int:
    set_dpi_awareness()
    ensure_runtime_dirs()
    pyautogui.FAILSAFE = False
    pyautogui.PAUSE = 0.05

    ensure_backend_dependencies()
    cleanup_previous_demo_processes()

    ffmpeg_path = find_ffmpeg_path()
    mysqld, mysql, mysqladmin = find_mysql_binaries()
    browser_path, browser_label = find_browser()
    node_path = find_node_path()

    db_port = find_free_port(MYSQL_PORT_START)
    app_port = find_free_port(APP_PORT_START)

    mysql_process = initialize_demo_mysql(mysqld, mysql, mysqladmin, db_port)
    clear_outbox()
    save_state(app_port, db_port, browser_path)

    screen_width, screen_height = get_primary_screen_size()
    recording_process: subprocess.Popen | None = None
    results: list[dict[str, str]] = []

    try:
        recording_process = start_recording(ffmpeg_path, screen_width, screen_height)
        start_backend_terminal(app_port, db_port, node_path)
        wait_for_backend(app_port)
        time.sleep(2.0)
        results = run_demo_flow(app_port, browser_path, browser_label)
    except (PlaywrightTimeoutError, TimeoutError, RuntimeError, requests.RequestException) as error:
        log(f"Demo failed: {error}")
        append_result(results, "run", "Full demo execution", "fail", str(error))
        raise
    finally:
        stop_recording(recording_process)
        if mysql_process.poll() is not None:
            log("Warning: the demo MySQL process stopped unexpectedly.")
        write_results_markdown(results, app_port=app_port, db_port=db_port, browser_path=browser_path)

    print()
    print(f"Video: {VIDEO_FILE}")
    print(f"Script: {RUN_SCRIPT_FILE}")
    print(f"Results: {RESULTS_FILE}")
    print(f"Recorder: {RECORDING_TOOL}")
    print(f"Run again: powershell -ExecutionPolicy Bypass -File {RUN_SCRIPT_FILE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

