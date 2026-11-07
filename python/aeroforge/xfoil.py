"""Bounded XFOIL execution and conservative single-point label validation."""
from dataclasses import dataclass
import gzip
import hashlib
import math
from pathlib import Path
import re
import subprocess
import time


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def commands(config: dict, geometry_path: str, reynolds: int, alpha: float) -> str:
    """No shell is involved; one ALFA command gives unambiguous failure attribution."""
    if any(c in geometry_path for c in '\n\r'):
        raise ValueError("geometry path must not contain newlines")
    lines = ["PLOP", "G", "", f"LOAD {geometry_path}", "PPAR",
             f"N {config['panel_nodes']}", f"P {config['panel_bunching']}",
             f"T {config['te_le_density_ratio']}", f"R {config['refined_le_density_ratio']}",
             "XT " + " ".join(map(str, config['refined_top'])),
             "XB " + " ".join(map(str, config['refined_bottom'])), "", "", "PANE",
             "PSAV panels.dat", "OPER", f"VISC {reynolds}", f"MACH {config['mach']}",
             f"ITER {config['iteration_limit']}", "VPAR", f"N {config['ncrit']}",
             f"XTR {config['xtr_top']} {config['xtr_bottom']}", "", "PACC", "polar.txt", "",
             f"ALFA {alpha}", "PACC", "", "QUIT", ""]
    return "\n".join(lines)


@dataclass(frozen=True)
class Polar:
    version: str
    mach: float
    reynolds: float
    ncrit: float
    xtr_top: float
    xtr_bottom: float
    rows: tuple[dict, ...]


def parse_polar(text: str) -> Polar:
    """Read the actual XFOIL seven-column polar format, including Fortran exponents."""
    version = re.search(r"XFOIL\s+Version\s+([0-9.]+)", text)
    conditions = re.search(r"Mach\s*=\s*([\d.Ee+\-]+)\s+Re\s*=\s*([\d.Ee+\-]+)\s*e\s*([+\-]?\d+)\s+Ncrit\s*=\s*([\d.Ee+\-]+)", text)
    header = re.search(r"alpha\s+CL\s+CD\s+CDp\s+CM\s+Top_Xtr\s+Bot_Xtr\s*\n\s*[- ]+\n", text)
    transition = re.search(r"xtrf\s*=\s*([\d.]+)\s*\(top\)\s*([\d.]+)\s*\(bottom\)", text)
    if not version or not conditions or not header or not transition:
        raise ValueError("missing XFOIL polar metadata or column header")
    mach, base_re, exponent, ncrit = map(float, conditions.groups())
    rows = []
    for line in text[header.end():].splitlines():
        if not line.strip():
            continue
        tokens = line.split()
        if len(tokens) != 7:
            raise ValueError("malformed polar row")
        try:
            values = [float(x.replace('D', 'E').replace('d', 'e')) for x in tokens]
        except ValueError as error:
            raise ValueError("unparseable polar coefficient") from error
        rows.append(dict(zip(('alpha_deg', 'cl', 'cd', 'cdp', 'cm', 'top_xtr', 'bottom_xtr'), values)))
    return Polar(version.group(1), mach, base_re * 10**exponent, ncrit, *map(float, transition.groups()), tuple(rows))


def classify(polar_text: str | None, stdout: str, returncode: int | None,
             config: dict, reynolds: int, alpha: float, m: float,
             timed_out: bool = False, launch_error: str | None = None) -> dict:
    result = {"status": "rejected", "converged": False, "eligible": False,
              "reasons": [], "warnings": [], "coefficients": None}
    reasons, warnings = result["reasons"], result["warnings"]
    if timed_out:
        reasons.append("timeout")
    if launch_error:
        reasons.append("launch_error")
    if 'Input not recognized' in stdout or 'command not recognized' in stdout:
        reasons.append('solver_command_error')
    if returncode not in (0, None):
        reasons.append("nonzero_exit")
    if "VISCAL:  Convergence failed" in stdout or re.search(r"VISCAL:\s+Convergence failed", stdout, re.I):
        reasons.append("viscous_nonconvergence")
    if not polar_text:
        reasons.append("missing_polar")
        return result
    try:
        polar = parse_polar(polar_text)
    except ValueError:
        reasons.append("polar_parse_error")
        return result
    if polar.version != config['solver_version'] or not math.isclose(polar.mach, config['mach'], abs_tol=1e-6) or not math.isclose(polar.ncrit, config['ncrit'], abs_tol=1e-6) or not math.isclose(polar.reynolds, reynolds, abs_tol=1):
        reasons.append("solver_metadata_mismatch")
    if not math.isclose(polar.xtr_top, config['xtr_top'], abs_tol=1e-6) or not math.isclose(polar.xtr_bottom, config['xtr_bottom'], abs_tol=1e-6):
        reasons.append('transition_metadata_mismatch')
    if len(polar.rows) != 1:
        reasons.append("missing_or_duplicate_polar_row")
        return result
    row = polar.rows[0]
    # Keep rejected finite coefficients for diagnosis, never as supervised labels.
    result['coefficients'] = {key: value if math.isfinite(value) else None for key, value in row.items()}
    if not all(math.isfinite(x) for x in row.values()):
        reasons.append("nonfinite_coefficient")
    if not math.isclose(row['alpha_deg'], alpha, abs_tol=0.0005):
        reasons.append("angle_mismatch")
    if 'Point added to stored polar' not in stdout or 'Point written to save file' not in stdout:
        reasons.append("missing_convergence_write_evidence")
    if reasons:
        return result
    result['converged'] = True
    if row['cd'] <= 0 or row['cdp'] < 0:
        warnings.append("nonphysical_drag")
    if abs(row['cl']) > 3 or row['cd'] > .2 or abs(row['cm']) > 1:
        warnings.append("extreme_coefficient")
    if not (0 <= row['top_xtr'] <= 1 and 0 <= row['bottom_xtr'] <= 1):
        warnings.append("invalid_transition_location")
    if m == 0 and alpha == 0 and abs(row['cl']) > .01:
        warnings.append("symmetric_zero_lift_anomaly")
    if alpha >= 10:
        warnings.append("unvalidated_stall_region")
    if 'MRCHDU: Convergence failed' in stdout:
        # Internal marching failures may recover before the final Newton solve.
        result['internal_marching_warning'] = True
    result['eligible'] = not warnings
    result['status'] = 'accepted' if result['eligible'] else 'suspect'
    return result


def run_point(executable: Path, directory: Path, command_text: str, timeout: float) -> dict:
    """Persist raw stdout even when the solver times out; never reuse output folders."""
    directory.mkdir(parents=True, exist_ok=False)
    (directory / 'commands.in').write_text(command_text, encoding='ascii')
    start = time.perf_counter()
    code, timed_out, launch_error = None, False, None
    stdout, stderr = b'', b''
    try:
        process = subprocess.run([str(executable)], cwd=directory, input=command_text.encode('ascii'),
                                 capture_output=True, timeout=timeout,
                                 creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        code, stdout, stderr = process.returncode, process.stdout, process.stderr
    except subprocess.TimeoutExpired as error:
        timed_out, stdout, stderr = True, error.stdout or b'', error.stderr or b''
    except OSError as error:
        launch_error = str(error)
    elapsed = time.perf_counter() - start
    for name, content in [('stdout', stdout), ('stderr', stderr)]:
        (directory / f'{name}.txt.gz').write_bytes(gzip.compress(content, mtime=0))
    return {'returncode': code, 'timed_out': timed_out, 'launch_error': launch_error,
            'elapsed_seconds': elapsed, 'stdout': stdout.decode('ascii', errors='replace'),
            'polar_text': (directory / 'polar.txt').read_text(encoding='ascii', errors='replace') if (directory / 'polar.txt').exists() else None}
