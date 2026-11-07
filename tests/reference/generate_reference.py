"""Independent Decimal oracle for committed station fixtures, not production code.

Uses 60-digit arithmetic, factored camber equations, and slope normalization
instead of atan/sin/cos. No production geometry module is imported.
"""
from decimal import Decimal as D, localcontext
import json
from pathlib import Path


def build_reference():
    cases = []
    with localcontext() as context:
        context.prec = 60
        for code in ("0012", "2412", "4418", "6618"):
            m, p, t = D(code[0]) / 100, D(code[1]) / 10, D(code[2:]) / 100
            points = []
            for text in ("0", "0.0001", "0.1", "0.25", "0.4", "0.6", "0.75", "1"):
                x = D(text)
                if m == 0:
                    yc = slope = D(0)
                elif x <= p:
                    yc = m * x * (2 * p - x) / (p * p)
                    slope = 2 * m * (p - x) / (p * p)
                else:
                    yc = m * (1 - x) * (1 + x - 2 * p) / ((1 - p) ** 2)
                    slope = 2 * m * (p - x) / ((1 - p) ** 2)
                # Scaled coefficients independently written from the PDAS convention.
                yt = t * (D('1.4845') * x.sqrt() - D('.630') * x - D('1.758') * x**2
                          + D('1.4215') * x**3 - D('.5075') * x**4)
                normal = (1 + slope * slope).sqrt()
                dx, dy = yt * slope / normal, yt / normal
                points.append({"x": float(x), "camber": float(yc), "slope": float(slope),
                               "halfThickness": float(yt),
                               "upper": [float(x - dx), float(yc + dy)],
                               "lower": [float(x + dx), float(yc - dy)]})
            cases.append({"code": code, "stations": points})
    return {"provenance": "60-digit Decimal analytic oracle; see generate_reference.py and docs/PHYSICS.md. Not solver/experimental data.",
            "absoluteTolerance": 1e-13, "cases": cases}


if __name__ == "__main__":
    Path(__file__).with_name("naca4-stations.json").write_text(json.dumps(build_reference(), indent=2) + "\n", encoding="utf-8")
