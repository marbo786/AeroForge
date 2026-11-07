"""Source-checkout entry point; no system install required."""
import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'python'))
from aeroforge.pilot import run_pilot

parser = argparse.ArgumentParser(description='Run a bounded, traceable XFOIL pilot; refuses existing output directories.')
parser.add_argument('--config', type=Path, default=ROOT / 'configs/pilot-v1.json')
parser.add_argument('--xfoil', type=Path, default=ROOT / 'tools/xfoil/xfoil.exe')
parser.add_argument('--output', type=Path, default=ROOT / 'data/pilot-v1')
args = parser.parse_args()
report = run_pilot(args.config, args.xfoil, args.output)
print(json.dumps(report, indent=2))
raise SystemExit(0 if report['acceptance_passed'] else 1)
