"""Run the predeclared Phase 4 experiment once into a new artifact directory."""
from pathlib import Path
import argparse
import sys
root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'python'))
from aeroforge.ml import run_training
parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, default=root / 'artifacts/pilot-surrogate-v1')
args = parser.parse_args()
result = run_training(root, args.output)
raise SystemExit(0 if result['accuracy_targets_passed'] and result['onnx_agreement_passed'] else 1)
