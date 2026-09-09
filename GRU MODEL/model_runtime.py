from __future__ import annotations

import csv
from pathlib import Path
from typing import Iterable, Optional

import numpy as np
import torch
import torch.nn as nn


FEATURE_ORDER = [
    "feat_gx_rad_s",
    "feat_gy_rad_s",
    "feat_gz_rad_s",
    "feat_ax_m_s2",
    "feat_ay_m_s2",
    "feat_az_m_s2",
    "feat_eskf_vx_m_s",
    "feat_eskf_vy_m_s",
    "feat_eskf_vz_m_s",
    "feat_rot6d_r11",
    "feat_rot6d_r21",
    "feat_rot6d_r31",
    "feat_rot6d_r12",
    "feat_rot6d_r22",
    "feat_rot6d_r32",
    "feat_sigma_px_m",
    "feat_sigma_py_m",
    "feat_sigma_pz_m",
    "feat_sigma_vx_m_s",
    "feat_sigma_vy_m_s",
    "feat_sigma_vz_m_s",
    "feat_sigma_theta_x_rad",
    "feat_sigma_theta_y_rad",
    "feat_sigma_theta_z_rad",
]

TARGET_ORDER = ["target_dvx_m_s", "target_dvy_m_s", "target_dvz_m_s"]
WINDOW_STEPS = 101
WINDOW_HZ = 100.0
WINDOW_DURATION_S = 1.0


class ProjectGhostGRUV3(nn.Module):
    """Exact GRU V3 checkpoint architecture reconstructed from the frozen state_dict.

    Verified against the saved validation rollout: the ReLU head reproduces the
    checkpoint validation macro-flight RMSE (about 2.23975 m/s under the saved
    metric definition).
    """

    def __init__(
        self,
        input_size: int = 24,
        hidden_size: int = 128,
        num_layers: int = 2,
        rnn_dropout: float = 0.2,
        head_hidden_size: int = 64,
        head_dropout: float = 0.1,
        output_size: int = 3,
    ) -> None:
        super().__init__()
        self.rnn = nn.GRU(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=rnn_dropout,
        )
        self.layer_norm = nn.LayerNorm(hidden_size)
        self.head = nn.Sequential(
            nn.Linear(hidden_size, head_hidden_size),
            nn.ReLU(),
            nn.Dropout(head_dropout),
            nn.Linear(head_hidden_size, output_size),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        seq, _ = self.rnn(x)
        h = self.layer_norm(seq[:, -1, :])
        return self.head(h)


def _read_norm_csv(path: Path, name_column: str) -> tuple[list[str], np.ndarray, np.ndarray]:
    names: list[str] = []
    means: list[float] = []
    stds: list[float] = []
    with path.open("r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            names.append(row[name_column])
            means.append(float(row["train_mean"]))
            stds.append(float(row["train_std"]))
    return names, np.asarray(means, dtype=np.float32), np.asarray(stds, dtype=np.float32)


class GRUV3Runtime:
    def __init__(self, package_root: Optional[str | Path] = None, device: str = "cpu") -> None:
        root = Path(package_root or Path(__file__).resolve().parent)
        self.root = root
        self.device = torch.device(device)

        model_path = root / "model" / "PROJECT_GHOST_GRU_V3_BEST_VALIDATION.pt"
        input_norm_path = root / "config" / "PROJECT_GHOST_GRU_V3_INPUT_NORMALIZATION_TRAIN_ONLY.csv"
        target_norm_path = root / "config" / "PROJECT_GHOST_GRU_V3_TARGET_NORMALIZATION_TRAIN_ONLY.csv"

        input_names, self.input_mean, self.input_std = _read_norm_csv(input_norm_path, "feature_name")
        target_names, self.target_mean, self.target_std = _read_norm_csv(target_norm_path, "target_name")
        if input_names != FEATURE_ORDER:
            raise RuntimeError(f"Input feature order mismatch: {input_names}")
        if target_names != TARGET_ORDER:
            raise RuntimeError(f"Target order mismatch: {target_names}")

        try:
            checkpoint = torch.load(model_path, map_location=self.device, weights_only=True)
        except TypeError:
            # Compatibility fallback for older PyTorch. Only use this bundled,
            # trusted checkpoint; torch pickle loading must not be used on untrusted files.
            checkpoint = torch.load(model_path, map_location=self.device)

        cfg = checkpoint["config"]
        self.model = ProjectGhostGRUV3(
            input_size=int(cfg["input_size"]),
            hidden_size=int(cfg["hidden_size"]),
            num_layers=int(cfg["num_layers"]),
            rnn_dropout=float(cfg["rnn_dropout"]),
            head_hidden_size=int(cfg["head_hidden_size"]),
            head_dropout=float(cfg["head_dropout"]),
            output_size=int(cfg["output_size"]),
        ).to(self.device)
        self.model.load_state_dict(checkpoint["model_state_dict"], strict=True)
        self.model.eval()

        self.checkpoint_epoch = int(checkpoint.get("epoch", -1))
        self.validation_macro_flight_rmse_m_s = float(
            checkpoint.get("validation_macro_flight_rmse_m_s", float("nan"))
        )

    def infer_delta_v(self, raw_window_101x24: Iterable[Iterable[float]]) -> np.ndarray:
        x = np.asarray(raw_window_101x24, dtype=np.float32)
        if x.shape != (WINDOW_STEPS, len(FEATURE_ORDER)):
            raise ValueError(f"Expected raw feature window shape (101, 24), got {x.shape}")
        if not np.isfinite(x).all():
            raise ValueError("Input contains NaN or infinity")

        x_norm = (x - self.input_mean) / self.input_std
        xt = torch.from_numpy(x_norm[None, :, :]).to(self.device)
        with torch.inference_mode():
            pred_norm = self.model(xt).cpu().numpy()[0]
        delta_v = pred_norm * self.target_std + self.target_mean
        return delta_v.astype(np.float32)

    def infer(self, raw_window_101x24: Iterable[Iterable[float]], eskf_velocity_m_s=None) -> dict:
        delta_v = self.infer_delta_v(raw_window_101x24)
        result = {
            "delta_v_m_s": delta_v.tolist(),
            "prediction_norm_m_s": float(np.linalg.norm(delta_v)),
            "window_shape": [101, 24],
            "feature_order": FEATURE_ORDER,
        }
        if eskf_velocity_m_s is not None:
            v = np.asarray(eskf_velocity_m_s, dtype=np.float32)
            if v.shape != (3,):
                raise ValueError("eskf_velocity_m_s must contain exactly 3 values")
            result["pseudo_velocity_m_s"] = (v + delta_v).tolist()
        return result


if __name__ == "__main__":
    runtime = GRUV3Runtime()
    print("GRU V3 runtime loaded")
    print("Expected input: raw 101 x 24 window at 100 Hz")
    print("Checkpoint epoch:", runtime.checkpoint_epoch)
    print("Stored validation macro-flight RMSE:", runtime.validation_macro_flight_rmse_m_s)
