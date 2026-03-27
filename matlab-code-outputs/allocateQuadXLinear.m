function [omega, omega_sq, T_individual, Q_individual, B] = ...
    allocateQuadXLinear(T_d, L_d, M_d, N_d, kT, kM, l, omega_min, omega_max)
% allocateQuadXLinear
%
% Control allocation for a quadrotor in X configuration with:
%   T_i = kT * omega_i^2
%   Q_i = kM * omega_i^2
%
% Inputs:
%   T_d, L_d, M_d, N_d  - desired total thrust and body moments
%   kT                  - thrust coefficient
%   kM                  - reaction torque coefficient
%   l                   - arm length from CoM to rotor
%   omega_min           - minimum rotor speed [rad/s]
%   omega_max           - maximum rotor speed [rad/s]
%
% Outputs:
%   omega               - [4x1] rotor speeds [rad/s]
%   omega_sq            - [4x1] squared rotor speeds
%   T_individual        - [4x1] individual rotor thrusts
%   Q_individual        - [4x1] individual rotor reaction torques
%   B                   - allocation matrix

    a = l / sqrt(2);

    % Allocation matrix for X configuration
    B = [ kT,      kT,      kT,      kT;
         -a*kT,    a*kT,    a*kT,   -a*kT;
         -a*kT,   -a*kT,    a*kT,    a*kT;
          kM,     -kM,      kM,     -kM ];

    Wd = [T_d; L_d; M_d; N_d];

    % Solve for squared speeds
    omega_sq = B \ Wd;

    % Enforce nonnegative squared speeds
    omega_sq = max(omega_sq, omega_min^2);
    omega_sq = min(omega_sq, omega_max^2);

    omega = sqrt(omega_sq);

    T_individual = kT * omega_sq;
    Q_individual = kM * omega_sq;
    
end