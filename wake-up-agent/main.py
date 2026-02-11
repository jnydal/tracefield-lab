# main.py (MicroPython on ESP32 / ESP32-C3)

import socket
import time
import ubinascii

# ==== Security ====
WAKE_KEY = ""  # must match env.WAKE_KEY in your Cloudflare Worker

# ==== Wake target ====
TARGET_MAC_STR = "10:7C:61:45:79:2C"  # FIX to the real MAC if needed
WOL_PORT = 9

# ==== Behavior ====
COOLDOWN_SECONDS = 60

# ==== HTTP server ====
LISTEN_HOST = "0.0.0.0"
LISTEN_PORT = 80  # align with Worker calling :8080

_last_wake_ts = 0


def parse_mac(mac_str: str) -> bytes:
    parts = mac_str.split(":")
    if len(parts) != 6:
        raise ValueError("MAC must have 6 octets like aa:bb:cc:dd:ee:ff")
    raw = bytes(int(p, 16) for p in parts)
    if len(raw) != 6:
        raise ValueError("Parsed MAC is not 6 bytes")
    return raw


def send_wol(mac_bytes: bytes):
    packet = b"\xff" * 6 + mac_bytes * 16
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        s.sendto(packet, ("255.255.255.255", WOL_PORT))
    finally:
        s.close()


def http_response(conn, status_code: int, body: str, content_type="text/plain; charset=utf-8"):
    reason = {
        200: "OK",
        204: "No Content",
        400: "Bad Request",
        401: "Unauthorized",
        403: "Forbidden",
        404: "Not Found",
        405: "Method Not Allowed",
        429: "Too Many Requests",
        500: "Internal Server Error",
    }.get(status_code, "OK")

    data = body.encode("utf-8")
    headers = [
        "HTTP/1.1 {} {}".format(status_code, reason),
        "Content-Type: {}".format(content_type),
        "Content-Length: {}".format(len(data)),
        "Connection: close",
        "",
        "",
    ]
    conn.send("\r\n".join(headers).encode("utf-8") + data)


def get_header_value(req_bytes: bytes, header_name: str) -> str:
    try:
        text = req_bytes.decode("utf-8", "ignore")
        lines = text.split("\r\n")
        target = header_name.lower()
        for line in lines[1:]:
            if not line:
                break
            if ":" not in line:
                continue
            k, v = line.split(":", 1)
            if k.strip().lower() == target:
                return v.strip()
    except Exception:
        pass
    return ""


def parse_request_line(req_bytes: bytes):
    line = req_bytes.split(b"\r\n", 1)[0].decode("utf-8", "ignore")
    parts = line.split()
    if len(parts) < 2:
        return None, None
    return parts[0], parts[1]


def parse_query(path: str):
    if "?" not in path:
        return path, {}
    route, qs = path.split("?", 1)
    params = {}
    for pair in qs.split("&"):
        if not pair:
            continue
        if "=" in pair:
            k, v = pair.split("=", 1)
        else:
            k, v = pair, ""
        params[k] = v
    return route, params


def serve():
    global _last_wake_ts

    addr = socket.getaddrinfo(LISTEN_HOST, LISTEN_PORT)[0][-1]
    s = socket.socket()
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(addr)
    s.listen(5)

    print("HTTP server listening on :{}".format(LISTEN_PORT))
    print("Endpoint: GET /wake with header x-wake-key: YOUR_SECRET")

    try:
        mac_bytes = parse_mac(TARGET_MAC_STR)
        print("Target MAC:", TARGET_MAC_STR, "->", ubinascii.hexlify(mac_bytes))
    except Exception as e:
        print("ERROR: invalid TARGET_MAC_STR:", e)
        mac_bytes = None

    while True:
        conn, client = s.accept()
        try:
            conn.settimeout(3)
            req = conn.recv(2048)
            if not req:
                continue

            method, raw_path = parse_request_line(req)
            if not method or not raw_path:
                http_response(conn, 400, "Bad Request")
                continue

            if method != "GET":
                http_response(conn, 405, "Method Not Allowed")
                continue

            route, _q = parse_query(raw_path)

            if route != "/wake":
                http_response(conn, 404, "Not Found")
                continue

            key = get_header_value(req, "x-wake-key")
            if not key:
                http_response(conn, 401, "Missing x-wake-key header")
                continue

            if key != WAKE_KEY:
                http_response(conn, 403, "Forbidden")
                continue

            if mac_bytes is None:
                http_response(conn, 500, "Server misconfigured: invalid target MAC")
                continue

            now = time.time()
            if now - _last_wake_ts < COOLDOWN_SECONDS:
                http_response(conn, 429, "Wake suppressed (cooldown). Try again soon.")
                continue

            send_wol(mac_bytes)
            _last_wake_ts = now
            http_response(conn, 200, "OK: Wake packet sent")

        except Exception:
            try:
                http_response(conn, 500, "Internal error")
            except Exception:
                pass
        finally:
            try:
                conn.close()
            except Exception:
                pass


serve()


