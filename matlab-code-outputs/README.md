# MATLAB Code Outputs

## Purpose

This subproject contains MATLAB-side modeling and control code for a quadrotor simulation pipeline, plus bridge utilities for sending simulation data toward the integration layer.

The folder is intended as the algorithm and control workspace, while the React apps and Node bridge stay in the webapp subproject.

## What Is Inside

Core simulation and control files:

- `simulateQuadMinimalICAO.m` - minimal 6-DoF quadrotor simulation loop (state integration, control loop, plotting)
- `ControlSystem.m` - control architecture draft for demanded acceleration, attitude targets, PD moments, and allocation options
- `desiredAttitudeFromAccel.m` - derives attitude/thrust targets from acceleration demand
- `eulerPDToMoments.m` - Euler-angle PD to body moment command
- `allocateQuadXLinear.m` - linear thrust/moment to rotor speed allocation
- `allocateQuadXNonlinearIterative.m` - nonlinear iterative allocation variant
- `Rx.m`, `Ry.m`, `Rz.m`, `Hat.m`, `Vee.m` - rotation and Lie algebra helpers

Telemetry output utility:

- `JSON_Send.m` - packages payload as JSON and sends via UDP to a configured host/port

Bridge helpers:

- `bridge/interceptor_bridge.c` - UDP receiver in C (diagnostic bridge utility)
- `bridge/interceptor_bridge` - compiled receiver binary
- `bridge/udp_test.py` - packet sniff/inspection helper script

## Typical Workflow

1. Run and tune simulation/control logic in MATLAB using `simulateQuadMinimalICAO.m` and related controllers.
2. Build a telemetry payload and send it with `JSON_Send.m`.
3. Use tools in `bridge/` to inspect or receive UDP traffic during integration tests.
4. Connect normalized outputs into the Node bridge endpoint used by the dashboard stack.

## Notes

- `JSON_Send.m` currently uses a fixed target address and UDP port. If your environment changed, update host and port there first.
- Control gains and physical coefficients are currently engineering values and should be tuned/validated against your target model.
- This folder is MATLAB-focused and intentionally decoupled from npm workspace tooling.
