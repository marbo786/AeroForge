from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'python'))
from aeroforge.recovery import tune
raise SystemExit(0 if tune(ROOT) else 1)
