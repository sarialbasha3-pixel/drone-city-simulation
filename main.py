"""
Top-level entry point for the Drone City Simulation.
Allows running 'python main.py' directly from the root workspace (d:\G-P).
"""
import os
import sys

# Pre-import torch before Panda3D
import torch

root_dir = os.path.dirname(os.path.abspath(__file__))
drone_sim_dir = os.path.join(root_dir, "drone_sim")

if root_dir not in sys.path:
    sys.path.insert(0, root_dir)
if drone_sim_dir not in sys.path:
    sys.path.insert(0, drone_sim_dir)

os.chdir(drone_sim_dir)

from drone_sim.main import main

if __name__ == "__main__":
    main()
