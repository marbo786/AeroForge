"""Fit and freeze a pressure graph using only train and validation labels."""
import argparse
import json
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
import torch
from torch import nn

from run_pressure_dataset import DATA, PLAN, load_plan, sha256, write_json
from aeroforge.pressure_metrics import score_pressure


CANDIDATES = ("direct", "mirrored")


def read_partition(data, split, plan):
    folder = data / split
    manifest = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
    if set(manifest["geometry_ids"]) != set(plan["splits"][split]):
        raise ValueError(f"unexpected geometry groups in {split}")
    for filename, digest in manifest["sha256"].items():
        if sha256(folder / filename) != digest:
            raise ValueError(f"partition hash does not match {split}/{filename}")
    with np.load(folder / "profiles.npz", allow_pickle=False) as arrays:
        partition = dict(arrays)
    expected = np.asarray([manifest["geometry_ids"][code] for code in partition["geometry_codes"]])
    if not np.array_equal(expected, partition["geometry_ids"]):
        raise ValueError(f"geometry ID mismatch in {split}")
    return partition


def features(partition):
    codes = partition["geometry_codes"]
    return np.column_stack((
        [int(code[0]) for code in codes],
        [int(code[1]) for code in codes],
        [int(code[2:]) for code in codes],
        partition["alpha"],
        partition["reynolds"],
    )).astype(np.float32)


class PressureModel(nn.Module):
    def __init__(self, candidate):
        super().__init__()
        self.mirrored = candidate == "mirrored"
        width = 128 if self.mirrored else 96
        self.regressor = nn.Sequential(
            nn.Linear(7, width), nn.SiLU(),
            nn.Linear(width, width), nn.SiLU(),
            nn.Linear(width, width), nn.SiLU(),
            nn.Linear(width, 257 if self.mirrored else 514),
        )
        self.register_buffer("surface_sign", torch.tensor([1.0, -1.0]).reshape(1, 2, 1))

    def forward(self, inputs):
        m, p, t, alpha, reynolds = inputs.split(1, dim=-1)
        safe_p = torch.clamp(p, min=2)
        nose_camber_slope = m / safe_p
        tail_camber_slope = m / (10 - safe_p)
        inputs = torch.cat((
            m / 4, m * (p - 4) / 8, (t - 13) / 5, alpha / 6,
            torch.log(reynolds / 250000), nose_camber_slope, tail_camber_slope,
        ), dim=-1)
        if self.mirrored:
            # Reflection swaps surfaces and negates camber, angle and camber slopes.
            sign = torch.cat((
                self.surface_sign.expand(-1, -1, 2),
                torch.ones_like(self.surface_sign), self.surface_sign,
                torch.ones_like(self.surface_sign), self.surface_sign.expand(-1, -1, 2),
            ), dim=-1)
            cp = self.regressor(inputs[:, None] * sign)
        else:
            cp = self.regressor(inputs).reshape(-1, 2, 257)
        shared_nose = cp[:, :, :1].mean(dim=1, keepdim=True).expand(-1, 2, -1)
        return torch.cat((shared_nose, cp[:, :, 1:]), dim=-1)


def score_ratio(metrics, plan):
    return max(
        metrics[side][key] / limit
        for side in ("upper", "lower")
        for key, limit in plan["limits"].items() if key != "parity_max"
    )


def fit(candidate, train, val, plan, epochs):
    torch.manual_seed(plan["seed"])
    model = PressureModel(candidate)
    optimizer = torch.optim.AdamW(model.parameters(), lr=0.002, weight_decay=0.0001)
    schedule = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, epochs, eta_min=0.0001)
    train_x = torch.from_numpy(features(train))
    train_y = torch.from_numpy(train["profiles"][..., 2].astype(np.float32))
    val_x = torch.from_numpy(features(val))
    weights = np.ones_like(train["station"], dtype=np.float32)
    weights[train["station"] <= plan["nose_end"]] = 2.0
    weights[train["station"] >= plan["tail_start"]] = 1.5
    weights = torch.from_numpy(weights)
    best = None
    for epoch in range(1, epochs + 1):
        for indices in torch.randperm(len(train_x)).split(128):
            predicted = model(train_x[indices])
            target = train_y[indices]
            residual = predicted - target
            loss = (weights * (residual.square() + 0.05 * residual.abs())).mean()
            loss += 0.05 * (predicted.amin(dim=-1) - target.amin(dim=-1)).square().mean()
            optimizer.zero_grad(set_to_none=True)
            loss.backward()
            optimizer.step()
        schedule.step()
        if epoch % 20 != 0 and epoch != epochs:
            continue
        with torch.inference_mode():
            predicted = model(val_x).numpy()
        metrics = score_pressure(predicted, val["profiles"], val["geometry_ids"], val["station"], plan)
        ratio = score_ratio(metrics, plan)
        if best is None or ratio < best["worst_gate_ratio"]:
            best = {"epoch": epoch, "worst_gate_ratio": ratio, "metrics": metrics}
            best_state = {name: value.detach().clone() for name, value in model.state_dict().items()}
        if epoch % 100 == 0 or epoch == epochs:
            print(f"{candidate}: epoch {epoch}, validation ratio {ratio:.3f}, best {best['worst_gate_ratio']:.3f}", flush=True)
    model.load_state_dict(best_state)
    return model.eval(), best


def ort_session(graph):
    options = ort.SessionOptions()
    options.intra_op_num_threads = 1
    options.inter_op_num_threads = 1
    return ort.InferenceSession(str(graph), options, providers=["CPUExecutionProvider"])


def train(data, output, epochs):
    torch.set_num_threads(2)
    plan = load_plan()
    provenance = json.loads((data / "provenance.json").read_text(encoding="utf-8"))
    if provenance["plan_sha256"] != sha256(PLAN):
        raise ValueError("dataset was generated under a different plan")
    training = read_partition(data, "train", plan)
    validation = read_partition(data, "validation", plan)
    if set(training["geometry_ids"]) & set(validation["geometry_ids"]):
        raise ValueError("training and validation geometry IDs overlap")
    output.mkdir(parents=True, exist_ok=False)
    trials = {}
    for candidate in CANDIDATES:
        model, trials[candidate] = fit(candidate, training, validation, plan, epochs)
        torch.save(model.state_dict(), output / f"{candidate}.pt")
        write_json(output / "validation.json", trials)

    selected = min(trials, key=lambda candidate: trials[candidate]["worst_gate_ratio"])
    model = PressureModel(selected).eval()
    model.load_state_dict(torch.load(output / f"{selected}.pt", weights_only=True))
    graph = output / "pressure-v1.onnx"
    torch.onnx.export(
        model, torch.zeros((2, 5)), str(graph), dynamo=False, opset_version=17,
        input_names=["features"], output_names=["cp"],
        dynamic_axes={"features": {0: "batch"}, "cp": {0: "batch"}},
    )
    onnx.checker.check_model(str(graph))
    indices = np.linspace(0, len(validation["ids"]) - 1, num=24, dtype=int)
    vectors = features(validation)[indices]
    with torch.inference_mode():
        source = model(torch.from_numpy(vectors)).numpy()
    exported = ort_session(graph).run(["cp"], {"features": vectors})[0]
    if source.shape != exported.shape or source.shape != (len(indices), 2, 257) or not np.isfinite(exported).all():
        raise ValueError("ONNX pressure parity shape or values are invalid")
    write_json(output / "parity.json", {
        "ids": validation["ids"][indices].tolist(),
        "features": vectors.tolist(), "shape": list(source.shape), "cp": source.tolist(),
    })
    write_json(output / "selection.json", {
        "selected": selected, "epochs_per_candidate": epochs,
        "plan_sha256": sha256(PLAN), "trainer_sha256": sha256(Path(__file__)),
        "score_sha256": sha256(Path(score_pressure.__code__.co_filename)),
        "fit_partition_sha256": {
            split: sha256(data / split / "manifest.json") for split in ("train", "validation")
        },
        "model_sha256": sha256(output / f"{selected}.pt"), "onnx_sha256": sha256(graph),
        "onnx_bytes": graph.stat().st_size, "source_onnx_max_abs": float(np.max(np.abs(source - exported))),
        "parity_vectors_sha256": sha256(output / "parity.json"),
        "validation_sha256": sha256(output / "validation.json"),
        "torch": torch.__version__, "onnx": onnx.__version__, "onnxruntime": ort.__version__,
    })
    print(f"Frozen {selected} using validation data. Graph has {graph.stat().st_size:,} bytes.", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=DATA)
    parser.add_argument("--output", type=Path, default=DATA / "model")
    parser.add_argument("--epochs", type=int, default=600)
    args = parser.parse_args()
    if args.epochs < 20:
        parser.error("--epochs must be at least 20")
    train(args.data, args.output, args.epochs)
