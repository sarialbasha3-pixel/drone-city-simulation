"""
run_sim.py - Desktop launcher that opens Drone City Simulation
directly on the user's interactive Windows screen (WinSta0\\Default).
"""
import ctypes
import os
import sys
import time

class STARTUPINFO(ctypes.Structure):
    _fields_ = [
        ('cb', ctypes.c_ulong),
        ('lpReserved', ctypes.c_wchar_p),
        ('lpDesktop', ctypes.c_wchar_p),
        ('lpTitle', ctypes.c_wchar_p),
        ('dwX', ctypes.c_ulong),
        ('dwY', ctypes.c_ulong),
        ('dwXSize', ctypes.c_ulong),
        ('dwYSize', ctypes.c_ulong),
        ('dwXCountChars', ctypes.c_ulong),
        ('dwYCountChars', ctypes.c_ulong),
        ('dwFillAttribute', ctypes.c_ulong),
        ('dwFlags', ctypes.c_ulong),
        ('wShowWindow', ctypes.c_ushort),
        ('cbReserved2', ctypes.c_ushort),
        ('lpReserved2', ctypes.c_char_p),
        ('hStdInput', ctypes.c_void_p),
        ('hStdOutput', ctypes.c_void_p),
        ('hStdError', ctypes.c_void_p),
    ]

class PROCESS_INFORMATION(ctypes.Structure):
    _fields_ = [
        ('hProcess', ctypes.c_void_p),
        ('hThread', ctypes.c_void_p),
        ('dwProcessId', ctypes.c_ulong),
        ('dwThreadId', ctypes.c_ulong),
    ]

def main():
    si = STARTUPINFO()
    si.cb = ctypes.sizeof(STARTUPINFO)
    si.lpDesktop = 'WinSta0\\Default'
    si.lpTitle = 'Drone Simulation'
    pi = PROCESS_INFORMATION()

    cwd = r'd:\G-P'
    python_exe = r'd:\G-P\.venv\Scripts\python.exe'
    main_py = r'd:\G-P\main.py'

    flags = 0x00000010  # CREATE_NEW_CONSOLE
    cmd = f'"{python_exe}" "{main_py}"'

    success = ctypes.windll.kernel32.CreateProcessW(
        None,
        cmd,
        None,
        None,
        False,
        flags,
        None,
        cwd,
        ctypes.byref(si),
        ctypes.byref(pi)
    )

    if not success:
        err = ctypes.windll.kernel32.GetLastError()
        print(f"[ERROR] Failed to start simulation: error code {err}", flush=True)
        return

    print(f"[RUNNING] Drone Simulation process started on Default Desktop (PID {pi.dwProcessId})", flush=True)
    print("[RUNNING] Window is now open on the interactive screen.", flush=True)

    # Wait for process to finish so background daemon task keeps it alive
    ctypes.windll.kernel32.WaitForSingleObject(pi.hProcess, 0xFFFFFFFF)
    exit_code = ctypes.c_ulong()
    ctypes.windll.kernel32.GetExitCodeProcess(pi.hProcess, ctypes.byref(exit_code))
    print(f"[EXIT] Simulation ended with exit code: {exit_code.value}", flush=True)
    ctypes.windll.kernel32.CloseHandle(pi.hProcess)
    ctypes.windll.kernel32.CloseHandle(pi.hThread)

if __name__ == '__main__':
    main()
