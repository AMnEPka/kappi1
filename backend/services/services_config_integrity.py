"""
services/services_config_integrity.py
SSH operations for afick-based configuration integrity checking.
"""

import asyncio
import re
import paramiko
from typing import Tuple, Optional
from datetime import datetime, timezone

from config.config_init import logger, decrypt_password, db, encrypt_password
from utils.db_utils import prepare_for_mongo

SSH_CONNECT_TIMEOUT = 10
SSH_COMMAND_TIMEOUT = 120


def _connect_ssh(ip: str, port: int, username: str, auth_type: str,
                 password: Optional[str], ssh_key: Optional[str]) -> paramiko.SSHClient:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    if auth_type == "password":
        decrypted = decrypt_password(password) if password else ""
        ssh.connect(
            hostname=ip, port=port, username=username,
            password=decrypted,
            timeout=SSH_CONNECT_TIMEOUT,
            banner_timeout=SSH_CONNECT_TIMEOUT,
            auth_timeout=SSH_CONNECT_TIMEOUT,
        )
    else:
        from io import StringIO
        decrypted_key = decrypt_password(ssh_key)
        key_file = StringIO(decrypted_key)
        for loader in (paramiko.RSAKey, paramiko.DSSKey, paramiko.ECDSAKey, paramiko.Ed25519Key):
            try:
                pkey = loader.from_private_key(key_file)
                break
            except Exception:
                key_file = StringIO(decrypted_key)
        else:
            raise ValueError("Не удалось загрузить SSH-ключ")
        ssh.connect(
            hostname=ip, port=port, username=username,
            pkey=pkey,
            timeout=SSH_CONNECT_TIMEOUT,
            banner_timeout=SSH_CONNECT_TIMEOUT,
            auth_timeout=SSH_CONNECT_TIMEOUT,
        )
    return ssh


def _exec(ssh: paramiko.SSHClient, command: str, timeout: int = SSH_COMMAND_TIMEOUT) -> Tuple[int, str, str]:
    _, stdout, stderr = ssh.exec_command(command, timeout=timeout)
    exit_code = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    return exit_code, out, err


def _parse_init_output(output: str) -> Tuple[Optional[int], Optional[str]]:
    """Extract file count and MD5 hash from `afick -i` output."""
    files_count = None
    config_hash = None
    m = re.search(r"(\d+)\s+files\s+entered", output)
    if m:
        files_count = int(m.group(1))
    m = re.search(r"MD5 hash of /var/lib/afick/afick\s*=>\s*(\S+)", output)
    if m:
        config_hash = m.group(1)
    return files_count, config_hash


def _parse_check_output(output: str) -> Tuple[Optional[int], Optional[int], Optional[str]]:
    """Extract scanned count, changed count, and MD5 hash from `afick -k` output."""
    scanned = None
    changed = None
    config_hash = None
    m = re.search(r"(\d+)\s+files\s+scanned,\s+(\d+)\s+changed", output)
    if m:
        scanned = int(m.group(1))
        changed = int(m.group(2))
    m = re.search(r"MD5 hash of /var/lib/afick/afick\s*=>\s*(\S+)", output)
    if m:
        config_hash = m.group(1)
    return scanned, changed, config_hash


async def initialize_host(host_doc: dict) -> dict:
    """
    SSH into host, check afick, run `sudo afick -i`, read /etc/afick.conf.
    Returns dict with results to update in DB.
    """
    ip = host_doc["ip_address"]
    port = host_doc.get("port", 22)
    username = host_doc["username"]
    auth_type = host_doc["auth_type"]
    password = host_doc.get("password")
    ssh_key = host_doc.get("ssh_key")

    def _do():
        ssh = _connect_ssh(ip, port, username, auth_type, password, ssh_key)
        try:
            exit_code, out, err = _exec(ssh, "which afick || command -v afick")
            if exit_code != 0:
                return {"success": False, "error": "Пакет afick не установлен на хосте"}

            exit_code, out, err = _exec(ssh, "sudo afick -i", timeout=300)
            combined = out + "\n" + err
            if exit_code != 0 and "init on an already existing database" not in combined:
                return {"success": False, "error": f"afick -i завершился с ошибкой (код {exit_code}): {err or out}"}

            files_count, config_hash = _parse_init_output(combined)

            # /etc/afick.conf often requires root; prefer sudo, fallback to plain cat
            exit_code2, conf_out, conf_err = _exec(
                ssh, "sudo cat /etc/afick.conf || cat /etc/afick.conf"
            )
            afick_conf = conf_out if exit_code2 == 0 and conf_out is not None else None

            return {
                "success": True,
                "files_count": files_count,
                "config_hash": config_hash,
                "afick_config_content": afick_conf,
                "raw_output": combined,
            }
        finally:
            ssh.close()

    loop = asyncio.get_event_loop()
    try:
        result = await loop.run_in_executor(None, _do)
    except Exception as e:
        logger.exception("Config integrity init failed for %s: %s", ip, e)
        result = {"success": False, "error": str(e)}

    now = datetime.now(timezone.utc)
    host_id = host_doc["id"]
    if result["success"]:
        update = {
            "is_monitored": True,
            "monitored_files_count": result.get("files_count"),
            "config_hash": result.get("config_hash"),
            "afick_config_content": result.get("afick_config_content"),
            "initialized_at": now.isoformat(),
            "last_check_at": now.isoformat(),
            "changed_files_count": 0,
        }
        await db.config_integrity_hosts.update_one({"id": host_id}, {"$set": update})
    return {"host_id": host_id, **result}


async def check_host(host_doc: dict) -> dict:
    """
    SSH into host and run `afick -k`, parse output.
    Returns dict with results.
    """
    ip = host_doc["ip_address"]
    port = host_doc.get("port", 22)
    username = host_doc["username"]
    auth_type = host_doc["auth_type"]
    password = host_doc.get("password")
    ssh_key = host_doc.get("ssh_key")

    def _do():
        ssh = _connect_ssh(ip, port, username, auth_type, password, ssh_key)
        try:
            exit_code, out, err = _exec(ssh, "sudo afick -k", timeout=300)
            combined = out + "\n" + err
            scanned, changed, config_hash = _parse_check_output(combined)
            return {
                "success": True,
                "scanned": scanned,
                "changed": changed,
                "config_hash": config_hash,
                "raw_output": combined,
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
        finally:
            ssh.close()

    loop = asyncio.get_event_loop()
    try:
        result = await loop.run_in_executor(None, _do)
    except Exception as e:
        logger.exception("Config integrity check failed for %s: %s", ip, e)
        result = {"success": False, "error": str(e)}

    now = datetime.now(timezone.utc)
    host_id = host_doc["id"]
    if result["success"]:
        update = {
            "monitored_files_count": result.get("scanned"),
            "changed_files_count": result.get("changed"),
            "config_hash": result.get("config_hash"),
            "last_check_at": now.isoformat(),
        }
        await db.config_integrity_hosts.update_one({"id": host_id}, {"$set": update})
    return {"host_id": host_id, **result}
