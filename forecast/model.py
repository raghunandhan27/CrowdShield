"""
CrowdShield Predictive Crowd Forecasting Engine
System Version: 2.0 (VBYLD Hackathon Edition)
PyTorch LSTM Forecaster + Persistence & Linear-Trend Baselines.
Predicts crowd density 10 minutes (t10) and 15 minutes (t15) into the future.
"""

import math
import numpy as np
import torch
import torch.nn as nn


class ForecasterLSTM(nn.Module):
    """
    2-Layer Recurrent LSTM for multi-step crowd density forecasting.
    Input shape: (batch_size, sequence_length=30, num_features=5)
      Features: [density, speed, conflict, sin(time_of_day), cos(time_of_day)]
    Output shape: (batch_size, horizon=2)
      Head predicts: [density at +10 min, density at +15 min]
    """
    def __init__(self, n_in: int = 5, hid: int = 64, horizon: int = 2):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=n_in,
            hidden_size=hid,
            num_layers=2,
            dropout=0.2,
            batch_first=True
        )
        self.fc = nn.Sequential(
            nn.Linear(hid, 32),
            nn.ReLU(),
            nn.Linear(32, horizon)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out, _ = self.lstm(x)
        # Take last time step output
        last_step = out[:, -1, :]
        return self.fc(last_step)


def baseline_persistence(recent_history: np.ndarray) -> np.ndarray:
    """Baseline 1: Persistence model ('it stays as it is')."""
    last_density = recent_history[-1, 0]
    return np.array([last_density, last_density])


def baseline_linear_trend(recent_history: np.ndarray, steps_ahead: list = [20, 30]) -> np.ndarray:
    """
    Baseline 2: Linear trend extrapolation over past 15 minutes.
    steps_ahead: 20 steps (+10m @ 30s) and 30 steps (+15m @ 30s)
    """
    densities = recent_history[:, 0]
    n = len(densities)
    if n < 2:
        return np.array([densities[-1], densities[-1]])
    
    # Simple linear regression slope
    x = np.arange(n)
    slope = float(np.polyfit(x, densities, 1)[0])
    
    t10 = max(0.0, densities[-1] + slope * (steps_ahead[0] / n))
    t15 = max(0.0, densities[-1] + slope * (steps_ahead[1] / n))
    return np.array([round(t10, 2), round(t15, 2)])
