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
MYSQL_RUNTIME_DIR = RUNTIME_DIR / "mysql"
MYSQL_DATA_DIR = MYSQL_RUNTIME_DIR / "data"
MYSQL_LOG_FILE = MYSQL_RUNTIME_DIR / "mysql.log"
MYSQL_CONFIG_FILE = MYSQL_RUNTIME_DIR / "my.ini"
MYSQL_PID_FILE = MYSQL_RUNTIME_DIR / "mysql.pid"
SERVER_PID_FILE = RUNTIME_DIR / "backend-terminal.pid"
FFMPEG_LOG_FILE = RUNTIME_DIR / "ffmpeg.log"
STATE_FILE = RUNTIME_DIR / "last-run.json"
BACKEND_DIR = ROOT / "backend"
BACKEND_OUTBOX_DIR = BACKEND_DIR / "outbox"
DB_SCHEMA_FILE = ROOT / "database" / "beautycare.mysql.sql"
VIDEO_FILE = DEMO_DIR / "beautycare-security-demo.mkv"
RUN_SCRIPT_FILE = DEMO_DIR / "run-security-demo.ps1"

BACKEND_WINDOW_TITLE = "BeautyCare Demo Server"
MYSQL_PORT_START = 3407
APP_PORT_START = 3000

DEMO_NAME = "Demo Security User"
DEMO_PHONE = "0923456789"
DEMO_EMAIL = "demo.security@beautycare.local"
ORIGINAL_PASSWORD = "DemoPass1A"
NEW_PASSWORD = "DemoPass2A"

CREATE_NEW_CONSOLE = 0x00000010
CREATE_NO_WINDOW = 0x08000000
SW_RESTORE = 9

user32 = ctypes.windll.user32


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
    for path in (DEMO_DIR, RUNTIME_DIR, MYSQL_RUNTIME_DIR):
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

    raise RuntimeError("ffmpeg.exe not found. Run demo/run-security-demo.ps1 to install it first.")


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
            "Write-Host 'BeautyCare security demo backend' -ForegroundColor Cyan",
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


def browser_viewport_origin(page, browser_label: str) -> tuple[float, float]:
    hwnd = locate_browser_window(browser_label)
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


def wait_for_outbox_token(expected_type: str, timeout: float = 20.0) -> str:
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
                return str(meta["token"])
        time.sleep(0.5)
    raise TimeoutError(f"Timed out while waiting for an outbox token of type '{expected_type}'")


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


def run_demo_flow(app_port: int, browser_path: Path, browser_label: str) -> None:
    profile_dir = RUNTIME_DIR / "browser-profile"
    if profile_dir.exists():
        shutil.rmtree(profile_dir)
    profile_dir.mkdir(parents=True, exist_ok=True)

    screen_width, screen_height = get_primary_screen_size()
    terminal_width = max(380, int(screen_width * 0.30))
    browser_width = max(820, screen_width - terminal_width)

    terminal_hwnd = wait_for_window(BACKEND_WINDOW_TITLE, timeout=20.0)
    move_window(terminal_hwnd, 0, 0, terminal_width, screen_height)
    time.sleep(1.0)

    with sync_playwright() as playwright:
        context = playwright.chromium.launch_persistent_context(
            user_data_dir=str(profile_dir),
            executable_path=str(browser_path),
            headless=False,
            viewport=None,
            args=[
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-notifications",
                "--disable-session-crashed-bubble",
                "--disable-features=Translate,AutofillServerCommunication",
                "--force-device-scale-factor=1",
                "--high-dpi-support=1",
                f"--window-size={browser_width},{screen_height}",
                f"--window-position={terminal_width},0",
            ],
        )
        try:
            page = context.pages[0] if context.pages else context.new_page()
            page.goto(f"http://localhost:{app_port}/login.html", wait_until="domcontentloaded")
            page.wait_for_load_state("networkidle")
            browser_hwnd = wait_for_window("BeautyCare", timeout=20.0)
            move_window(browser_hwnd, terminal_width, 0, browser_width, screen_height)

            time.sleep(1.5)
            click_locator(page, "#email", browser_label, wait_after=0.2)
            type_into(page, "#email", DEMO_EMAIL, browser_label, clear=True)
            type_into(page, "#password", ORIGINAL_PASSWORD, browser_label, clear=True)
            click_locator(page, "#btnLogin", browser_label, wait_after=1.0)
            page.wait_for_url(f"http://localhost:{app_port}/user/services.html", timeout=20000)
            time.sleep(1.5)

            click_locator(page, 'a[data-nav="security.html"]', browser_label, wait_after=1.0)
            page.wait_for_url(f"http://localhost:{app_port}/user/security.html", timeout=10000)
            time.sleep(1.5)

            type_into(page, "#currentPassword", ORIGINAL_PASSWORD, browser_label, clear=True)
            type_into(page, "#newPassword", NEW_PASSWORD, browser_label, clear=True)
            type_into(page, "#confirmNewPassword", NEW_PASSWORD, browser_label, clear=True)
            click_locator(page, "#btnChangePassword", browser_label, wait_after=1.0)
            page.wait_for_url(f"http://localhost:{app_port}/login.html", timeout=20000)
            time.sleep(1.5)

            type_into(page, "#email", DEMO_EMAIL, browser_label, clear=True)
            type_into(page, "#password", NEW_PASSWORD, browser_label, clear=True)
            click_locator(page, "#btnLogin", browser_label, wait_after=1.0)
            page.wait_for_url(f"http://localhost:{app_port}/user/services.html", timeout=20000)
            time.sleep(1.2)

            click_locator(page, 'a[data-nav="security.html"]', browser_label, wait_after=1.0)
            page.wait_for_url(f"http://localhost:{app_port}/user/security.html", timeout=10000)
            time.sleep(1.0)

            clear_outbox()
            click_locator(page, "#btnRequestVerifyEmail", browser_label, wait_after=1.0)
            verify_token = wait_for_outbox_token("verify-email", timeout=20.0)
            type_into(page, "#verifyToken", verify_token, browser_label, clear=True)
            click_locator(page, "#btnVerifyEmailToken", browser_label, wait_after=1.0)
            page.wait_for_function(
                "() => { const raw = localStorage.getItem('user'); if (!raw) return false; try { return JSON.parse(raw).email_verified === true; } catch (_) { return false; } }",
                timeout=10000,
            )
            time.sleep(1.0)

            click_locator(page, "#btnSetup2FA", browser_label, wait_after=1.0)
            page.wait_for_function(
                "() => Boolean(document.getElementById('twofaSecret')?.value)",
                timeout=10000,
            )
            secret = page.locator("#twofaSecret").input_value().strip()
            if not secret:
                raise RuntimeError("2FA secret was not rendered in the UI.")

            totp = pyotp.TOTP(secret)
            current_code = totp.now()
            type_into(page, "#twofaOtp", current_code, browser_label, clear=True)
            click_locator(page, "#btnEnable2FA", browser_label, wait_after=1.0)
            page.wait_for_function(
                "() => { const raw = localStorage.getItem('user'); if (!raw) return false; try { return JSON.parse(raw).twofa_enabled === true; } catch (_) { return false; } }",
                timeout=10000,
            )
            time.sleep(1.0)

            next_code = totp.at(int(time.time()) + 30)
            type_into(page, "#twofaOtp", next_code, browser_label, clear=True)
            click_locator(page, "#btnDisable2FA", browser_label, wait_after=1.0)
            page.wait_for_function(
                "() => { const raw = localStorage.getItem('user'); if (!raw) return false; try { return JSON.parse(raw).twofa_enabled === false; } catch (_) { return false; } }",
                timeout=10000,
            )
            time.sleep(1.0)

            type_into(page, "#currentPassword", NEW_PASSWORD, browser_label, clear=True)
            type_into(page, "#newPassword", ORIGINAL_PASSWORD, browser_label, clear=True)
            type_into(page, "#confirmNewPassword", ORIGINAL_PASSWORD, browser_label, clear=True)
            click_locator(page, "#btnChangePassword", browser_label, wait_after=1.0)
            page.wait_for_url(f"http://localhost:{app_port}/login.html", timeout=20000)
            time.sleep(1.2)

            type_into(page, "#email", DEMO_EMAIL, browser_label, clear=True)
            type_into(page, "#password", ORIGINAL_PASSWORD, browser_label, clear=True)
            click_locator(page, "#btnLogin", browser_label, wait_after=1.0)
            page.wait_for_url(f"http://localhost:{app_port}/user/services.html", timeout=20000)
            time.sleep(1.0)

            click_locator(page, ".js-logout", browser_label, wait_after=1.0)
            page.wait_for_url(f"http://localhost:{app_port}/login.html", timeout=10000)
            time.sleep(1.5)
        finally:
            context.close()


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
    create_demo_user(mysql, db_port)
    clear_outbox()
    save_state(app_port, db_port, browser_path)

    screen_width, screen_height = get_primary_screen_size()
    recording_process: subprocess.Popen | None = None

    try:
        recording_process = start_recording(ffmpeg_path, screen_width, screen_height)
        start_backend_terminal(app_port, db_port, node_path)
        wait_for_backend(app_port)
        time.sleep(2.0)
        run_demo_flow(app_port, browser_path, browser_label)
    except (PlaywrightTimeoutError, TimeoutError, RuntimeError, requests.RequestException) as error:
        log(f"Demo failed: {error}")
        raise
    finally:
        stop_recording(recording_process)
        if mysql_process.poll() is not None:
            log("Warning: the demo MySQL process stopped unexpectedly.")

    print()
    print(f"Video: {VIDEO_FILE}")
    print(f"Script: {RUN_SCRIPT_FILE}")
    print(f"Run again: powershell -ExecutionPolicy Bypass -File {RUN_SCRIPT_FILE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
