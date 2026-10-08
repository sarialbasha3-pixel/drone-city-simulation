"""
launch_simulation.py - Master launcher for Drone City Simulation
Launches the simulation on the interactive user desktop (WinSta0\\Default)
with a visible console window and full graphics output.
"""
import ctypes
import os
import sys

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

def launch():
    si = STARTUPINFO()
    si.cb = ctypes.sizeof(STARTUPINFO)
    si.lpDesktop = 'WinSta0\\Default'
    si.lpTitle = 'Drone Simulation Console'
    pi = PROCESS_INFORMATION()

    cwd = r'd:\G-P'
    python_exe = r'd:\G-P\.venv\Scripts\python.exe'
    main_py = r'd:\G-P\main.py'
    log_file = r'd:\G-P\simulation.log'

    # Launch with a new console window on the interactive desktop
    # CREATE_NEW_CONSOLE = 0x00000010
    cmd = f'cmd.exe /k "title Drone Simulation Console && cd /d "{cwd}" && "{python_exe}" "{main_py}""'

    success = ctypes.windll.kernel32.CreateProcessW(
        None,
        cmd,
        None,
        None,
        False,
        0x00000010,
        None,
        cwd,
        ctypes.byref(si),
        ctypes.byref(pi)
    )

    if success:
        print(f"[LAUNCH SUCCESS] Drone Simulation started!")
        print(f"[LAUNCH SUCCESS] Process ID (cmd): {pi.dwProcessId}")
        ctypes.windll.kernel32.CloseHandle(pi.hProcess)
        ctypes.windll.kernel32.CloseHandle(pi.hThread)
        return pi.dwProcessId
    else:
        err = ctypes.windll.kernel32.GetLastError()
        print(f"[LAUNCH FAILED] Error code: {err}")
        return None

if __name__ == '__main__':
    launch()
