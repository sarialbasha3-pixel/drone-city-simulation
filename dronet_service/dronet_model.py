"""
PULP-DroNet v3 Architecture (PyTorch implementation)
Based on: https://github.com/pulp-platform/pulp-dronet/tree/master/tiny-pulp-dronet-v3
Authors: Lorenzo Lamberti, Daniele Palossi, Lorenzo Bellone (University of Bologna, ETH Zurich)
"""

import os
import torch
import torch.nn as nn


class ResBlock(nn.Module):
    """
    Residual Block involving two 3x3 convolutions with ReLU6 activations,
    Batch Normalization, and a 1x1 stride-2 bypass shortcut.
    """
    def __init__(self, in_channels: int, out_channels: int, stride: int = 2, bypass: bool = True):
        super().__init__()
        self.has_bypass = bypass
        self.conv1 = nn.Conv2d(
            in_channels=in_channels,
            out_channels=out_channels,
            kernel_size=3,
            stride=stride,
            padding=1,
            dilation=1,
            groups=1,
            bias=False,
            padding_mode='zeros'
        )
        self.conv2 = nn.Conv2d(
            in_channels=out_channels,
            out_channels=out_channels,
            kernel_size=3,
            stride=1,
            padding=1,
            dilation=1,
            groups=1,
            bias=False,
            padding_mode='zeros'
        )
        self.bn1 = nn.BatchNorm2d(num_features=out_channels, eps=1e-05, momentum=0.1, affine=True, track_running_stats=True)
        self.bn2 = nn.BatchNorm2d(num_features=out_channels, eps=1e-05, momentum=0.1, affine=True, track_running_stats=True)
        self.relu1 = nn.ReLU6(inplace=False)
        self.relu2 = nn.ReLU6(inplace=False)

        if bypass:
            self.bypass = nn.Conv2d(
                in_channels=in_channels,
                out_channels=out_channels,
                kernel_size=1,
                stride=stride,
                padding=0,
                dilation=1,
                groups=1,
                bias=False,
                padding_mode='zeros'
            )
            self.bn_bypass = nn.BatchNorm2d(num_features=out_channels, eps=1e-05, momentum=0.1, affine=True, track_running_stats=True)
            self.relu3 = nn.ReLU6(inplace=False)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        identity = x
        out = self.conv1(x)
        out = self.bn1(out)
        out = self.relu1(out)

        out = self.conv2(out)
        out = self.bn2(out)
        out = self.relu2(out)

        if self.has_bypass:
            bypass_out = self.bypass(identity)
            bypass_out = self.bn_bypass(bypass_out)
            bypass_out = self.relu3(bypass_out)
            out = out + bypass_out
        return out


class DronetV3(nn.Module):
    """
    PULP-DroNet CNN architecture.
    Input: (B, 1, 200, 200) grayscale image, normalized in range [0, 1].
    Outputs:
      - steering: Float tensor of shape (B,) - steering angle / yaw-rate
      - collision: Float tensor of shape (B,) - collision probability in [0, 1]
    """
    def __init__(self, depth_mult: float = 1.0, bypass: bool = True):
        super().__init__()
        first_conv_channels = int(32 * depth_mult)

        # First convolution: 5x5 kernel, stride 2 -> 100x100
        self.first_conv = nn.Conv2d(
            in_channels=1,
            out_channels=first_conv_channels,
            kernel_size=5,
            stride=2,
            padding=2,
            dilation=1,
            groups=1,
            bias=False,
            padding_mode='zeros'
        )
        self.bn1 = nn.BatchNorm2d(num_features=first_conv_channels, eps=1e-05, momentum=0.1, affine=True, track_running_stats=True)
        self.relu1 = nn.ReLU6(inplace=False)

        # Max Pooling: 2x2, stride 2 -> 50x50
        self.pool = nn.MaxPool2d(kernel_size=2, stride=2, padding=0, dilation=1, return_indices=False, ceil_mode=False)

        # Three ResBlocks
        # Block 1: 32 -> 32 channels, stride 2 -> 25x25
        self.Block1 = ResBlock(first_conv_channels, first_conv_channels, stride=2, bypass=bypass)
        # Block 2: 32 -> 64 channels, stride 2 -> 13x13
        self.Block2 = ResBlock(first_conv_channels, first_conv_channels * 2, stride=2, bypass=bypass)
        # Block 3: 64 -> 128 channels, stride 2 -> 7x7
        self.Block3 = ResBlock(first_conv_channels * 2, first_conv_channels * 4, stride=2, bypass=bypass)

        # Fully connected layer
        fc_size = (first_conv_channels * 4) * 7 * 7
        self.fc = nn.Linear(in_features=fc_size, out_features=2, bias=False)
        self.sig = nn.Sigmoid()

    def forward(self, x: torch.Tensor):
        out = self.first_conv(x)
        out = self.bn1(out)
        out = self.relu1(out)

        out = self.pool(out)

        out = self.Block1(out)
        out = self.Block2(out)
        out = self.Block3(out)

        out = out.flatten(1)
        out = self.fc(out)

        steer = out[:, 0]
        coll = self.sig(out[:, 1])
        return steer, coll


def load_dronet_model(weights_path: str, device: str = "cpu") -> DronetV3:
    """Instantiate DronetV3 and load pre-trained weights."""
    model = DronetV3(depth_mult=1.0, bypass=True)
    if os.path.exists(weights_path):
        checkpoint = torch.load(weights_path, map_location=device)
        if isinstance(checkpoint, dict) and 'state_dict' in checkpoint:
            checkpoint = checkpoint['state_dict']
        model.load_state_dict(checkpoint)
        print(f"[PULP-DroNet] Successfully loaded weights from {weights_path}")
    else:
        print(f"[PULP-DroNet] Warning: Weights file not found at {weights_path}, using default model.")
    model.to(device)
    model.eval()
    return model
